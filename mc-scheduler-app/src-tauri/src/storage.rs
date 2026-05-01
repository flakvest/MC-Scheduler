use std::{
  fs,
  io,
  path::{Path, PathBuf},
  process::Command,
  time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, Wry};

const DATA_FILE_NAME: &str = "scheduler.json";
const BACKUP_DIR_NAME: &str = "backups";
const BACKUP_KEEP_COUNT: usize = 5;
const DEFAULT_SCHEDULER_JSON: &str = r#"{
  "version": 1,
  "operators": [],
  "positions": [
    {
      "name": "EXD",
      "shortName": "EXD",
      "requiresALE": true
    },
    {
      "name": "DW",
      "shortName": "DW",
      "requiresALE": false
    },
    {
      "name": "DR",
      "shortName": "DR",
      "requiresALE": false
    }
  ],
  "vacations": {},
  "schedule": {}
}"#;

fn storage_root(app: &AppHandle<Wry>) -> Result<PathBuf, String> {
  app.path()
    .app_data_dir()
    .map_err(|err| format!("Unable to resolve the app data folder: {err}"))
}

fn data_file_path(app: &AppHandle<Wry>) -> Result<PathBuf, String> {
  Ok(storage_root(app)?.join(DATA_FILE_NAME))
}

fn ensure_storage_dirs(app: &AppHandle<Wry>) -> Result<(PathBuf, PathBuf), String> {
  let root = storage_root(app)?;
  let backups = root.join(BACKUP_DIR_NAME);

  fs::create_dir_all(&root)
    .map_err(|err| format!("Unable to create the app data folder: {err}"))?;
  fs::create_dir_all(&backups)
    .map_err(|err| format!("Unable to create the backup folder: {err}"))?;

  Ok((root, backups))
}

fn looks_like_json_object(raw: &str) -> bool {
  let trimmed = raw.trim();
  trimmed.starts_with('{') && trimmed.ends_with('}')
}

fn backup_file_name() -> String {
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos();

  format!("scheduler-{stamp:020}.json")
}

fn temp_file_name() -> String {
  let stamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_nanos();

  format!("scheduler-{stamp:020}.tmp")
}

fn create_backup(data_file: &Path, backup_dir: &Path) -> Result<(), String> {
  let backup_name = backup_file_name();
  let mut backup_path = backup_dir.join(&backup_name);
  let mut collision = 1u32;

  while backup_path.exists() {
    backup_path = backup_dir.join(format!("scheduler-{collision:04}-{backup_name}"));
    collision += 1;
  }

  fs::copy(data_file, &backup_path).map_err(|err| {
    format!(
      "Unable to create a backup at {}: {err}",
      backup_path.display()
    )
  })?;

  Ok(())
}

fn prune_backups(backup_dir: &Path) -> Result<(), String> {
  let mut backups = Vec::new();

  for entry in fs::read_dir(backup_dir)
    .map_err(|err| format!("Unable to read the backup folder: {err}"))?
  {
    let entry = entry.map_err(|err| format!("Unable to read a backup file entry: {err}"))?;
    let path = entry.path();

    let is_backup = path
      .file_name()
      .and_then(|name| name.to_str())
      .map(|name| name.starts_with("scheduler-") && name.ends_with(".json"))
      .unwrap_or(false);

    if is_backup {
      backups.push((entry.file_name().to_string_lossy().into_owned(), path));
    }
  }

  backups.sort_by(|left, right| right.0.cmp(&left.0));

  for (_, path) in backups.into_iter().skip(BACKUP_KEEP_COUNT) {
    if let Err(err) = fs::remove_file(&path) {
      eprintln!("Failed to remove old backup {}: {err}", path.display());
    }
  }

  Ok(())
}

#[tauri::command]
pub fn get_scheduler_storage_paths(
  app: AppHandle<Wry>,
) -> Result<(String, String, String), String> {
  let data_file = data_file_path(&app)?;
  let root = storage_root(&app)?;
  let backup_dir = root.join(BACKUP_DIR_NAME);

  Ok((
    data_file.display().to_string(),
    root.display().to_string(),
    backup_dir.display().to_string(),
  ))
}

#[tauri::command]
pub fn load_scheduler_data(app: AppHandle<Wry>) -> Result<String, String> {
  let data_file = data_file_path(&app)?;

  match fs::read_to_string(&data_file) {
    Ok(contents) if !contents.trim().is_empty() => Ok(contents),
    Ok(_) => Ok(DEFAULT_SCHEDULER_JSON.to_string()),
    Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(DEFAULT_SCHEDULER_JSON.to_string()),
    Err(err) => Err(format!(
      "Unable to read scheduler data from {}: {err}",
      data_file.display()
    )),
  }
}

#[tauri::command]
pub fn save_scheduler_data(app: AppHandle<Wry>, json: String) -> Result<(), String> {
  if !looks_like_json_object(&json) {
    return Err("Scheduler data must be a JSON object.".to_string());
  }

  let (_, backup_dir) = ensure_storage_dirs(&app)?;
  let data_file = data_file_path(&app)?;
  let temp_file = data_file
    .parent()
    .unwrap_or_else(|| Path::new("."))
    .join(temp_file_name());

  if data_file.exists() {
    create_backup(&data_file, &backup_dir)?;
  }

  fs::write(&temp_file, json).map_err(|err| {
    format!(
      "Unable to write temporary scheduler data to {}: {err}",
      temp_file.display()
    )
  })?;

  if data_file.exists() {
    fs::remove_file(&data_file).map_err(|err| {
      format!(
        "Unable to replace scheduler data at {}: {err}",
        data_file.display()
      )
    })?;
  }

  fs::rename(&temp_file, &data_file).map_err(|err| {
    format!(
      "Unable to move scheduler data into place at {}: {err}",
      data_file.display()
    )
  })?;
  prune_backups(&backup_dir)?;

  Ok(())
}

#[tauri::command]
pub fn open_scheduler_data_folder(app: AppHandle<Wry>) -> Result<(), String> {
  let (root, _) = ensure_storage_dirs(&app)?;

  open_folder(&root)
}

#[cfg(target_os = "windows")]
fn open_folder(path: &Path) -> Result<(), String> {
  Command::new("explorer")
    .arg(path)
    .spawn()
    .map(|_| ())
    .map_err(|err| format!("Unable to open the app data folder: {err}"))
}

#[cfg(not(target_os = "windows"))]
fn open_folder(_path: &Path) -> Result<(), String> {
  Err("Opening the app data folder is only implemented on Windows.".to_string())
}

use std::{
    collections::{BTreeMap, BTreeSet},
    fs, io,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::{Map, Value};
use tauri::{AppHandle, Manager, Wry};

const DATA_FILE_NAME: &str = "scheduler.json";
const BACKUP_DIR_NAME: &str = "backups";
const YEARS_DIR_NAME: &str = "years";
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

fn years_dir_path(app: &AppHandle<Wry>) -> Result<PathBuf, String> {
    Ok(storage_root(app)?.join(YEARS_DIR_NAME))
}

fn ensure_storage_dirs(app: &AppHandle<Wry>) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let root = storage_root(app)?;
    let backups = root.join(BACKUP_DIR_NAME);
    let years = root.join(YEARS_DIR_NAME);

    fs::create_dir_all(&root)
        .map_err(|err| format!("Unable to create the app data folder: {err}"))?;
    fs::create_dir_all(&backups)
        .map_err(|err| format!("Unable to create the backup folder: {err}"))?;
    fs::create_dir_all(&years)
        .map_err(|err| format!("Unable to create the yearly schedule folder: {err}"))?;

    Ok((root, backups, years))
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

fn create_backup(contents: &str, backup_dir: &Path) -> Result<(), String> {
    let backup_name = backup_file_name();
    let mut backup_path = backup_dir.join(&backup_name);
    let mut collision = 1u32;

    while backup_path.exists() {
        backup_path = backup_dir.join(format!("scheduler-{collision:04}-{backup_name}"));
        collision += 1;
    }

    fs::write(&backup_path, contents).map_err(|err| {
        format!(
            "Unable to create a backup at {}: {err}",
            backup_path.display()
        )
    })?;

    Ok(())
}

fn parse_json_object(raw: &str, context: &str) -> Result<Map<String, Value>, String> {
    let value: Value = serde_json::from_str(raw)
        .map_err(|err| format!("Unable to parse {context} as JSON: {err}"))?;

    match value {
        Value::Object(object) => Ok(object),
        _ => Err(format!("{context} must be a JSON object.")),
    }
}

fn schedule_year(date: &str) -> Option<String> {
    let year = date.get(0..4)?;

    if date.len() >= 10
        && date.as_bytes().get(4) == Some(&b'-')
        && year.chars().all(|item| item.is_ascii_digit())
    {
        Some(year.to_string())
    } else {
        None
    }
}

fn year_schedule_file(years_dir: &Path, year: &str) -> PathBuf {
    years_dir.join(format!("schedule-{year}.json"))
}

fn extract_schedule(object: &mut Map<String, Value>) -> Map<String, Value> {
    object
        .remove("schedule")
        .and_then(|schedule| match schedule {
            Value::Object(schedule) => Some(schedule),
            _ => None,
        })
        .unwrap_or_default()
}

fn read_yearly_schedules(years_dir: &Path) -> Result<Map<String, Value>, String> {
    let mut schedule = Map::new();

    if !years_dir.exists() {
        return Ok(schedule);
    }

    for entry in fs::read_dir(years_dir)
        .map_err(|err| format!("Unable to read the yearly schedule folder: {err}"))?
    {
        let entry =
            entry.map_err(|err| format!("Unable to read a yearly schedule file entry: {err}"))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().into_owned();

        if !file_name.starts_with("schedule-") || !file_name.ends_with(".json") {
            continue;
        }

        let contents = fs::read_to_string(&path).map_err(|err| {
            format!(
                "Unable to read yearly schedule data from {}: {err}",
                path.display()
            )
        })?;
        let mut year_object = parse_json_object(&contents, &file_name)?;
        let year_schedule = extract_schedule(&mut year_object);

        for (date, day) in year_schedule {
            schedule.insert(date, day);
        }
    }

    Ok(schedule)
}

fn split_schedule_by_year(schedule: Map<String, Value>) -> BTreeMap<String, Map<String, Value>> {
    let mut yearly = BTreeMap::new();

    for (date, day) in schedule {
        if let Some(year) = schedule_year(&date) {
            yearly
                .entry(year)
                .or_insert_with(Map::new)
                .insert(date, day);
        }
    }

    yearly
}

fn write_json_atomically(path: &Path, contents: &str) -> Result<(), String> {
    let temp_file = path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(temp_file_name());

    fs::write(&temp_file, contents).map_err(|err| {
        format!(
            "Unable to write temporary scheduler data to {}: {err}",
            temp_file.display()
        )
    })?;

    if path.exists() {
        fs::remove_file(path).map_err(|err| {
            format!(
                "Unable to replace scheduler data at {}: {err}",
                path.display()
            )
        })?;
    }

    fs::rename(&temp_file, path).map_err(|err| {
        format!(
            "Unable to move scheduler data into place at {}: {err}",
            path.display()
        )
    })?;

    Ok(())
}

fn schedule_file_year(path: &Path) -> Option<String> {
    let file_name = path.file_name()?.to_str()?;
    let year = file_name.strip_prefix("schedule-")?.strip_suffix(".json")?;

    if year.len() == 4 && year.chars().all(|item| item.is_ascii_digit()) {
        Some(year.to_string())
    } else {
        None
    }
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
) -> Result<(String, String, String, String), String> {
    let data_file = data_file_path(&app)?;
    let root = storage_root(&app)?;
    let backup_dir = root.join(BACKUP_DIR_NAME);
    let years_dir = root.join(YEARS_DIR_NAME);

    Ok((
        data_file.display().to_string(),
        root.display().to_string(),
        backup_dir.display().to_string(),
        years_dir.display().to_string(),
    ))
}

#[tauri::command]
pub fn load_scheduler_data(app: AppHandle<Wry>) -> Result<String, String> {
    let data_file = data_file_path(&app)?;
    let years_dir = years_dir_path(&app)?;

    let base_json = match fs::read_to_string(&data_file) {
        Ok(contents) if !contents.trim().is_empty() => contents,
        Ok(_) => DEFAULT_SCHEDULER_JSON.to_string(),
        Err(err) if err.kind() == io::ErrorKind::NotFound => DEFAULT_SCHEDULER_JSON.to_string(),
        Err(err) => Err(format!(
            "Unable to read scheduler data from {}: {err}",
            data_file.display()
        ))?,
    };

    let mut base_object = parse_json_object(&base_json, DATA_FILE_NAME)?;
    let mut schedule = extract_schedule(&mut base_object);
    let yearly_schedule = read_yearly_schedules(&years_dir)?;

    for (date, day) in yearly_schedule {
        schedule.insert(date, day);
    }

    base_object.insert("schedule".to_string(), Value::Object(schedule));

    serde_json::to_string_pretty(&Value::Object(base_object))
        .map_err(|err| format!("Unable to serialize scheduler data: {err}"))
}

#[tauri::command]
pub fn save_scheduler_data(app: AppHandle<Wry>, json: String) -> Result<(), String> {
    if !looks_like_json_object(&json) {
        return Err("Scheduler data must be a JSON object.".to_string());
    }

    let (_, backup_dir, years_dir) = ensure_storage_dirs(&app)?;
    let data_file = data_file_path(&app)?;
    let mut next_data = parse_json_object(&json, "scheduler data")?;
    let schedule = extract_schedule(&mut next_data);
    let yearly_schedules = split_schedule_by_year(schedule);

    if data_file.exists() || years_dir.exists() {
        let current_json = load_scheduler_data(app.clone())?;
        create_backup(&current_json, &backup_dir)?;
    }

    next_data.insert("schedule".to_string(), Value::Object(Map::new()));
    let metadata_json = serde_json::to_string_pretty(&Value::Object(next_data))
        .map_err(|err| format!("Unable to serialize scheduler metadata: {err}"))?;

    let mut active_years = BTreeSet::new();

    for (year, schedule) in yearly_schedules {
        active_years.insert(year.clone());

        let mut year_object = Map::new();
        year_object.insert("version".to_string(), Value::from(1));
        year_object.insert(
            "year".to_string(),
            Value::from(year.parse::<u16>().unwrap_or_default()),
        );
        year_object.insert("schedule".to_string(), Value::Object(schedule));

        let year_json = serde_json::to_string_pretty(&Value::Object(year_object))
            .map_err(|err| format!("Unable to serialize yearly schedule data: {err}"))?;

        write_json_atomically(&year_schedule_file(&years_dir, &year), &year_json)?;
    }

    for entry in fs::read_dir(&years_dir)
        .map_err(|err| format!("Unable to read the yearly schedule folder: {err}"))?
    {
        let entry =
            entry.map_err(|err| format!("Unable to read a yearly schedule file entry: {err}"))?;
        let path = entry.path();

        if let Some(year) = schedule_file_year(&path) {
            if !active_years.contains(&year) {
                fs::remove_file(&path).map_err(|err| {
                    format!(
                        "Unable to remove stale yearly schedule file {}: {err}",
                        path.display()
                    )
                })?;
            }
        }
    }

    write_json_atomically(&data_file, &metadata_json)?;
    prune_backups(&backup_dir)?;

    Ok(())
}

#[tauri::command]
pub fn open_scheduler_data_folder(app: AppHandle<Wry>) -> Result<(), String> {
    let (root, _, _) = ensure_storage_dirs(&app)?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_schedule_entries_by_year() {
        let mut schedule = Map::new();
        schedule.insert("2026-04-01".to_string(), Value::Object(Map::new()));
        schedule.insert("2027-01-15".to_string(), Value::Object(Map::new()));
        schedule.insert("not-a-date".to_string(), Value::Object(Map::new()));

        let yearly = split_schedule_by_year(schedule);

        assert_eq!(yearly.len(), 2);
        assert!(yearly["2026"].contains_key("2026-04-01"));
        assert!(yearly["2027"].contains_key("2027-01-15"));
    }

    #[test]
    fn extracts_schedule_and_leaves_metadata() {
        let mut data = parse_json_object(
            r#"{
        "version": 1,
        "operators": [],
        "positions": [],
        "vacations": {},
        "schedule": {
          "2026-04-01": {
            "coverage": true,
            "assignments": {}
          }
        }
      }"#,
            "test scheduler data",
        )
        .expect("test data should parse");

        let schedule = extract_schedule(&mut data);

        assert!(schedule.contains_key("2026-04-01"));
        assert!(!data.contains_key("schedule"));
        assert!(data.contains_key("operators"));
        assert!(data.contains_key("vacations"));
    }

    #[test]
    fn recognizes_only_year_schedule_files() {
        assert_eq!(
            schedule_file_year(Path::new("schedule-2026.json")),
            Some("2026".to_string())
        );
        assert_eq!(schedule_file_year(Path::new("schedule-26.json")), None);
        assert_eq!(schedule_file_year(Path::new("notes-2026.json")), None);
    }
}

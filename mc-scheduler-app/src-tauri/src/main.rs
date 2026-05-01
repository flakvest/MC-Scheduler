#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod storage;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
      storage::get_scheduler_storage_paths,
      storage::load_scheduler_data,
      storage::open_scheduler_data_folder,
      storage::save_scheduler_data,
    ])
    .run(tauri::generate_context!())
    .expect("error while running Tauri application");
}

mod models;
mod parser;
mod scanner;
mod db;
mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // shell plugin used only for opener; resume uses std::process::Command
        .invoke_handler(tauri::generate_handler![
            get_projects,
            get_sessions,
            get_session_detail,
            search_sessions,
            resume_session,
            add_tag,
            remove_tag,
            toggle_bookmark,
            get_all_tags,
            refresh_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

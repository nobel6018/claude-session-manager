mod models;
mod parser;
mod scanner;
mod db;
mod commands;

use commands::*;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Build macOS app menu with "Check for Updates..." item
            let check_updates = MenuItem::with_id(
                app,
                "check_updates",
                "Check for Updates...",
                true,
                None::<&str>,
            )?;

            let app_menu = Submenu::with_items(
                app,
                "Claude Session Manager",
                true,
                &[
                    &PredefinedMenuItem::about(app, None, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &check_updates,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, None)?,
                    &PredefinedMenuItem::hide_others(app, None)?,
                    &PredefinedMenuItem::show_all(app, None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, None)?,
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu])?;
            app.set_menu(menu)?;

            // Handle menu events
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                if event.id().as_ref() == "check_updates" {
                    // Emit event to frontend to trigger update check
                    let _ = app_handle.emit("check-for-updates", ());
                }
            });

            Ok(())
        })
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
            delete_session,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

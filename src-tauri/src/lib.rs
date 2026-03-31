mod models;
mod parser;
mod scanner;
mod db;
mod commands;

use commands::*;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // ── App menu ─────────────────────────────────────────────
            let check_updates = MenuItem::with_id(
                app,
                "check_updates",
                "Check for Updates...",
                true,
                None::<&str>,
            )?;

            let show_about = MenuItem::with_id(
                app,
                "show_about",
                "About Claude Session Manager",
                true,
                None::<&str>,
            )?;

            let app_menu = Submenu::with_items(
                app,
                "Claude Session Manager",
                true,
                &[
                    &show_about,
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

            // ── Window menu ───────────────────────────────────────────
            // ⌘N: show window / ⌘W: hide window (close_window fires CloseRequested → intercepted below)
            let show_window = MenuItem::with_id(
                app,
                "show_window",
                "새 창",
                true,
                Some("cmd+n"),
            )?;

            let window_menu = Submenu::with_items(
                app,
                "Window",
                true,
                &[
                    &show_window,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::minimize(app, None)?,
                    &PredefinedMenuItem::maximize(app, None)?,
                    &PredefinedMenuItem::close_window(app, None)?, // triggers ⌘W → CloseRequested
                ],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &window_menu])?;
            app.set_menu(menu)?;

            // ── Menu event handler ────────────────────────────────────
            let app_handle = app.handle().clone();
            app.on_menu_event(move |_app, event| {
                match event.id().as_ref() {
                    "check_updates" => {
                        let _ = app_handle.emit("check-for-updates", ());
                    }
                    "show_about" => {
                        let _ = app_handle.emit("show-about", ());
                    }
                    "show_window" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                }
            });

            // ── Intercept ⌘W / window close → hide instead of quit ───
            let window = app.get_webview_window("main")
                .expect("main window not found");
            let win = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win.hide();
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
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        // ── Dock 클릭 시 숨긴 창 다시 열기 ─────────────────────────
        .run(|app_handle, event| {
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        });
}

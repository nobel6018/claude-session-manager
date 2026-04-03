use crate::db::Database;
use crate::models::{Project, SessionDetail, SessionSummary};
use crate::parser::parse_session_detail;
use crate::scanner::{claude_dir, scan_deleted_sessions, scan_projects, scan_sessions};
use std::sync::{Mutex, OnceLock};

fn db() -> &'static Database {
    static DB: OnceLock<Database> = OnceLock::new();
    DB.get_or_init(|| Database::new().expect("Failed to initialize database"))
}

/// In-memory cache for session summaries — loaded once, filtered on each request
struct SessionCache {
    sessions: Vec<SessionSummary>,
    projects: Vec<Project>,
}

fn cache() -> &'static Mutex<Option<SessionCache>> {
    static CACHE: OnceLock<Mutex<Option<SessionCache>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

fn ensure_cache() -> Result<(), String> {
    let mut guard = cache().lock().map_err(|e| e.to_string())?;
    if guard.is_none() {
        let tags_map = db().get_all_tags_map().map_err(|e| e.to_string())?;
        let bookmarks = db().get_bookmarked_sessions().map_err(|e| e.to_string())?;
        let sessions = scan_sessions(None, &tags_map, &bookmarks);
        let projects = scan_projects(&tags_map, &bookmarks);
        *guard = Some(SessionCache { sessions, projects });
    }
    Ok(())
}

fn invalidate_cache() {
    if let Ok(mut guard) = cache().lock() {
        *guard = None;
    }
}

#[tauri::command]
pub fn get_projects() -> Result<Vec<Project>, String> {
    ensure_cache()?;
    let guard = cache().lock().map_err(|e| e.to_string())?;
    Ok(guard.as_ref().unwrap().projects.clone())
}

#[tauri::command]
pub fn get_sessions(project_id: Option<String>) -> Result<Vec<SessionSummary>, String> {
    ensure_cache()?;
    let guard = cache().lock().map_err(|e| e.to_string())?;
    let all = &guard.as_ref().unwrap().sessions;

    let result = match project_id {
        Some(pid) => all.iter().filter(|s| s.project_id == pid).cloned().collect(),
        None => all.clone(),
    };

    Ok(result)
}

#[tauri::command]
pub fn get_session_detail(
    session_id: String,
    project_id: String,
) -> Result<SessionDetail, String> {
    let base = claude_dir().join("projects").join(&project_id);
    let path = base.join(format!("{}.jsonl", &session_id));
    let deleted_path = base.join(format!("{}.jsonl.deleted", &session_id));

    let resolved = if path.exists() {
        path
    } else if deleted_path.exists() {
        deleted_path
    } else {
        return Err(format!("Session file not found: {}", session_id));
    };

    Ok(parse_session_detail(&resolved, &session_id))
}

#[tauri::command]
pub fn search_sessions(query: String) -> Result<Vec<SessionSummary>, String> {
    ensure_cache()?;
    let guard = cache().lock().map_err(|e| e.to_string())?;
    let all = &guard.as_ref().unwrap().sessions;

    let query_lower = query.to_lowercase();
    let filtered: Vec<SessionSummary> = all
        .iter()
        .filter(|s| {
            s.title.to_lowercase().contains(&query_lower)
                || s.project_name.to_lowercase().contains(&query_lower)
                || s.tags.iter().any(|t| t.to_lowercase().contains(&query_lower))
        })
        .cloned()
        .collect();

    Ok(filtered)
}

#[tauri::command]
pub async fn resume_session(session_id: String, cwd: String, terminal: String) -> Result<(), String> {
    match terminal.as_str() {
        "cmux" => resume_in_cmux(session_id, cwd),
        _ => resume_in_iterm2(session_id, cwd),
    }
}

fn resume_in_iterm2(session_id: String, cwd: String) -> Result<(), String> {
    // cd to project directory first so claude --resume can find the session
    let cmd = format!("cd {} && claude --resume {}", cwd, session_id);
    let script = format!(
        r#"tell application "iTerm2"
            activate
            tell current window
                create tab with default profile
                tell current session
                    write text "{}"
                end tell
            end tell
        end tell"#,
        cmd
    );

    std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| format!("Failed to open iTerm2: {}", e))?;

    Ok(())
}

fn resume_in_cmux(session_id: String, cwd: String) -> Result<(), String> {
    // Escape a string for use inside an AppleScript double-quoted string
    fn as_escape(s: &str) -> String {
        s.replace('\\', "\\\\").replace('"', "\\\"")
    }

    let cmd = format!("cd \"{}\" && claude --resume {}", as_escape(&cwd), session_id);

    // Use cmux's AppleScript API — works from any process (no socket auth needed)
    let script = format!(
        r#"tell application "cmux"
    activate
    if (count windows) = 0 then
        new window
    end if
    set newTab to new tab in front window
    delay 0.8
    set term to focused terminal of newTab
    input text "{}" & return to term
end tell"#,
        as_escape(&cmd)
    );

    let out = std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if !out.status.success() {
        return Err(format!(
            "cmux AppleScript failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    Ok(())
}

#[tauri::command]
pub fn add_tag(session_id: String, tag: String) -> Result<(), String> {
    db().add_tag(&session_id, &tag).map_err(|e| e.to_string())?;
    invalidate_cache();
    Ok(())
}

#[tauri::command]
pub fn remove_tag(session_id: String, tag: String) -> Result<(), String> {
    db().remove_tag(&session_id, &tag).map_err(|e| e.to_string())?;
    invalidate_cache();
    Ok(())
}

#[tauri::command]
pub fn toggle_bookmark(session_id: String) -> Result<bool, String> {
    let result = db().toggle_bookmark(&session_id).map_err(|e| e.to_string())?;
    invalidate_cache();
    Ok(result)
}

#[tauri::command]
pub fn delete_session(session_id: String, project_id: String) -> Result<(), String> {
    let path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    if !path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    let deleted_path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl.deleted", session_id));

    std::fs::rename(&path, &deleted_path)
        .map_err(|e| format!("Failed to delete session: {}", e))?;

    // Remove only the deleted session from cache — much faster than full rescan
    if let Ok(mut guard) = cache().lock() {
        if let Some(ref mut cache) = *guard {
            cache.sessions.retain(|s| s.session_id != session_id);
            // Update project session counts
            for project in &mut cache.projects {
                if project.id == project_id && project.session_count > 0 {
                    project.session_count -= 1;
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_deleted_sessions(project_id: Option<String>) -> Result<Vec<SessionSummary>, String> {
    let tags_map = db().get_all_tags_map().map_err(|e| e.to_string())?;
    let bookmarks = db().get_bookmarked_sessions().map_err(|e| e.to_string())?;
    Ok(scan_deleted_sessions(project_id.as_deref(), &tags_map, &bookmarks))
}

#[tauri::command]
pub fn restore_session(session_id: String, project_id: String) -> Result<(), String> {
    let deleted_path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl.deleted", session_id));

    if !deleted_path.exists() {
        return Err(format!("Deleted session file not found: {}", session_id));
    }

    let restored_path = claude_dir()
        .join("projects")
        .join(&project_id)
        .join(format!("{}.jsonl", session_id));

    std::fs::rename(&deleted_path, &restored_path)
        .map_err(|e| format!("Failed to restore session: {}", e))?;

    invalidate_cache();
    Ok(())
}

#[tauri::command]
pub fn refresh_sessions() -> Result<(), String> {
    invalidate_cache();
    ensure_cache()?;
    Ok(())
}

#[tauri::command]
pub fn get_all_tags() -> Result<Vec<String>, String> {
    db().get_all_unique_tags().map_err(|e| e.to_string())
}

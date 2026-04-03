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
    let cmd = format!("cd {} && claude --resume {}", as_escape(&cwd), session_id);

    // pgrep으로 이미 실행 중인 세션의 TTY를 찾아 iTerm2 탭 포커스 시도
    let script = format!(
        r#"tell application "iTerm2"
            activate
            try
                set sid to "{session_id}"
                set pid to do shell script "pgrep -f 'claude --resume " & sid & "' 2>/dev/null | head -1"
                if pid is not "" then
                    set ttyShort to do shell script "ps -p " & pid & " -o tty= 2>/dev/null | tr -d '[:space:]'"
                    if ttyShort is not "" then
                        set fullTty to "/dev/tty" & ttyShort
                        repeat with aWindow in windows
                            repeat with aTab in tabs of aWindow
                                repeat with aSession in sessions of aTab
                                    try
                                        if tty of aSession is fullTty then
                                            select aWindow
                                            tell aWindow
                                                set current tab to aTab
                                            end tell
                                            tell aTab
                                                set current session to aSession
                                            end tell
                                            return
                                        end if
                                    end try
                                end repeat
                            end repeat
                        end repeat
                    end if
                end if
            end try
            -- 실행 중인 세션 없음 → 새 탭 생성
            tell current window
                create tab with default profile
                tell current session
                    write text "{cmd}"
                end tell
            end tell
        end tell"#,
        session_id = as_escape(&session_id),
        cmd = as_escape(&cmd),
    );

    std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .spawn()
        .map_err(|e| format!("Failed to open iTerm2: {}", e))?;

    Ok(())
}

fn as_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn osascript(script: &str) -> std::io::Result<std::process::Output> {
    std::process::Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .output()
}

fn resume_in_cmux(session_id: String, cwd: String) -> Result<(), String> {
    // 1. Focus existing terminal if this session is already open
    if let Ok(Some((_ws_uuid, terminal_uuid))) = db().get_cmux_session(&session_id) {
        let focus_script = format!(
            r#"tell application "cmux"
    repeat with aWin in windows
        repeat with aTab in tabs of aWin
            repeat with aTerm in terminals of aTab
                if id of aTerm = "{}" then
                    activate aWin
                    select aTab
                    focus aTerm
                    return true
                end if
            end repeat
        end repeat
    end repeat
    return false
end tell"#,
            as_escape(&terminal_uuid)
        );
        if let Ok(out) = osascript(&focus_script) {
            if out.status.success()
                && String::from_utf8_lossy(&out.stdout).trim() == "true"
            {
                return Ok(());
            }
        }
        let _ = db().delete_cmux_session(&session_id);
    }

    // 2. Get existing workspace UUID for this project (same cwd = same project)
    let existing_ws_uuid = db()
        .get_project_workspace(&cwd)
        .ok()
        .flatten()
        .unwrap_or_default();

    let project_name = std::path::Path::new(&cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("claude")
        .to_string();

    // 3. Write bash script — runs inside cmux terminal, has full cmux CLI access
    let result_path = format!("/tmp/csm-result-{}.txt", &session_id[..8]);
    let script_path = format!("/tmp/csm-{}.sh", &session_id[..8]);

    // Use placeholder substitution to avoid format! vs bash ${} conflicts
    let script_template = r#"#!/bin/bash
PROJECT_NAME='__PROJECT__'
CWD='__CWD__'
SESSION_ID='__SESSION__'
EXISTING_WS='__EXISTING_WS__'
RESULT_FILE='__RESULT__'
MY_WS="$CMUX_WORKSPACE_ID"
MY_SURFACE="$CMUX_SURFACE_ID"

if [ -n "$EXISTING_WS" ] && cmux --id-format uuids list-workspaces 2>/dev/null | grep -qF "$EXISTING_WS"; then
    LAST_SURFACE=$(cmux list-pane-surfaces --workspace "$EXISTING_WS" 2>/dev/null | grep -o 'surface:[0-9]*' | tail -1)
    SURFACE_OUT=$(cmux --id-format uuids new-surface --workspace "$EXISTING_WS" --type terminal 2>&1)
    SURFACE_REF=$(echo "$SURFACE_OUT" | grep -o 'surface:[0-9]*')
    SURFACE_UUID=$(echo "$SURFACE_OUT" | grep -oE '[A-Za-z0-9-]{36}' | head -1)
    if [ -n "$SURFACE_REF" ]; then
        [ -n "$LAST_SURFACE" ] && cmux move-surface --surface "$SURFACE_REF" --after "$LAST_SURFACE" --focus true 2>/dev/null || true
        sleep 0.5
        cmux send --workspace "$EXISTING_WS" --surface "$SURFACE_REF" "cd '$CWD' && claude --resume $SESSION_ID\n"
        cmux select-workspace --workspace "$EXISTING_WS"
        printf 'ws_uuid=%s\nsurface_uuid=%s\n' "$EXISTING_WS" "$SURFACE_UUID" > "$RESULT_FILE"
        sleep 0.3
        cmux close-workspace --workspace "$MY_WS" 2>/dev/null || true
        exit 0
    fi
fi

cmux rename-workspace --workspace "$MY_WS" "$PROJECT_NAME" 2>/dev/null || true
printf 'ws_uuid=%s\nsurface_uuid=%s\n' "$MY_WS" "$MY_SURFACE" > "$RESULT_FILE"
cd "$CWD" && exec claude --resume "$SESSION_ID"
"#;

    let script = script_template
        .replace("__PROJECT__", &project_name.replace('\'', "'\\''"))
        .replace("__CWD__", &cwd.replace('\'', "'\\''"))
        .replace("__SESSION__", &session_id)
        .replace("__EXISTING_WS__", &existing_ws_uuid)
        .replace("__RESULT__", &result_path);

    std::fs::write(&script_path, &script)
        .map_err(|e| format!("Failed to write session script: {}", e))?;
    let _ = std::process::Command::new("chmod").args(["+x", &script_path]).status();

    // 4. AppleScript: create new workspace at the bottom + run the bash script
    let applescript = format!(
        r#"tell application "cmux"
    activate
    if (count windows) = 0 then new window
    set newTab to new tab in front window
    delay 0.8
    set term to focused terminal of newTab
    input text "exec bash '{}'" & return to term
end tell"#,
        as_escape(&script_path)
    );

    let out = osascript(&applescript)
        .map_err(|e| format!("Failed to run osascript: {}", e))?;

    if !out.status.success() {
        return Err(format!(
            "cmux AppleScript failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }

    // 5. Background: read result file → store UUIDs in DB
    let session_id_bg = session_id.clone();
    let cwd_bg = cwd.clone();
    let result_path_bg = result_path.clone();
    let script_path_bg = script_path.clone();
    std::thread::spawn(move || {
        for _ in 0..30 {
            std::thread::sleep(std::time::Duration::from_millis(500));
            if let Ok(content) = std::fs::read_to_string(&result_path_bg) {
                let mut ws_uuid = String::new();
                let mut surface_uuid = String::new();
                for line in content.lines() {
                    if let Some(v) = line.strip_prefix("ws_uuid=") { ws_uuid = v.trim().to_string(); }
                    if let Some(v) = line.strip_prefix("surface_uuid=") { surface_uuid = v.trim().to_string(); }
                }
                if !ws_uuid.is_empty() {
                    let _ = db().save_cmux_session(&session_id_bg, &ws_uuid, &surface_uuid);
                    let _ = db().save_project_workspace(&cwd_bg, &ws_uuid);
                    let _ = std::fs::remove_file(&result_path_bg);
                    let _ = std::fs::remove_file(&script_path_bg);
                    break;
                }
            }
        }
    });

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

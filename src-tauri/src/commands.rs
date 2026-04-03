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

fn cmux_bin() -> String {
    if std::path::Path::new("/usr/local/bin/cmux").exists() {
        "/usr/local/bin/cmux".to_string()
    } else {
        "/Applications/cmux.app/Contents/Resources/bin/cmux".to_string()
    }
}

/// Parse `cmux list-workspaces` and return (find_ref, last_ref).
/// find_ref: workspace matching `name`, last_ref: last workspace in sidebar.
/// Output format per line: "[*] workspace:N  [icon] name [tags]"
fn query_cmux_workspaces(bin: &str, name: &str) -> (Option<String>, Option<String>) {
    let output = match std::process::Command::new(bin).arg("list-workspaces").output() {
        Ok(o) if o.status.success() => o,
        _ => return (None, None),
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut found: Option<String> = None;
    let mut last: Option<String> = None;

    for line in stdout.lines() {
        let Some(ws_ref) = line.split_whitespace().find(|t| t.starts_with("workspace:")) else {
            continue;
        };
        last = Some(ws_ref.to_string());

        let after_ref = line[line.find(ws_ref).unwrap_or(0) + ws_ref.len()..].trim();
        let mut tokens = after_ref.split_whitespace().peekable();
        if let Some(&first) = tokens.peek() {
            let is_icon = first.chars().count() == 1
                && !first.chars().next().map_or(false, |c| c.is_alphanumeric());
            if is_icon { tokens.next(); }
        }
        let ws_name = tokens.take_while(|t| !t.starts_with('[')).collect::<Vec<_>>().join(" ");

        if ws_name == name {
            found = Some(ws_ref.to_string());
        }
    }

    (found, last)
}


/// Returns the last surface ref in a workspace's pane (for append ordering).
/// Output format per line: "[*] surface:N  [icon] name [tags]"
fn get_last_pane_surface(bin: &str, ws_ref: &str) -> Option<String> {
    let output = std::process::Command::new(bin)
        .args(["list-pane-surfaces", "--workspace", ws_ref])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|l| !l.trim().is_empty())
        .last()
        .and_then(|line| {
            line.split_whitespace()
                .find(|t| t.starts_with("surface:"))
                .map(|s| s.to_string())
        })
}

/// Check if a surface still exists in a workspace, and return its 0-based index if so.
fn cmux_surface_index(bin: &str, ws_ref: &str, surface_ref: &str) -> Option<usize> {
    let out = std::process::Command::new(bin)
        .args(["list-pane-surfaces", "--workspace", ws_ref])
        .output()
        .ok()?;

    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| !l.trim().is_empty())
        .enumerate()
        .find(|(_, l)| l.split_whitespace().any(|t| t == surface_ref))
        .map(|(i, _)| i)
}

fn log(msg: &str) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open("/tmp/csm-cmux.log") {
        let _ = writeln!(f, "{}", msg);
    }
}

fn resume_in_cmux(session_id: String, cwd: String) -> Result<(), String> {
    let bin = cmux_bin();
    let claude_cmd = format!("claude --resume {}", session_id);
    log(&format!("=== resume_in_cmux start: session={} cwd={} bin={}", session_id, cwd, bin));

    // 1. Check if this session already has a live cmux surface
    if let Ok(Some((ws_ref, surface_ref))) = db().get_cmux_surface(&session_id) {
        log(&format!("path=existing_surface ws={} surface={}", ws_ref, surface_ref));
        if let Some(idx) = cmux_surface_index(&bin, &ws_ref, &surface_ref) {
            log(&format!("surface alive at idx={}, focusing", idx));
            let _ = std::process::Command::new(&bin)
                .args(["select-workspace", "--workspace", &ws_ref])
                .output();
            let _ = std::process::Command::new(&bin)
                .args(["move-surface", "--surface", &surface_ref, "--index", &idx.to_string(), "--focus", "true"])
                .output();
            let r = std::process::Command::new("/usr/bin/open").args(["-a", "cmux"]).spawn();
            log(&format!("open -a cmux: {:?}", r.map(|_| "ok")));
            return Ok(());
        }
        log("surface dead, cleaning up");
        let _ = db().delete_cmux_surface(&session_id);
    }

    // 2. Derive project name for workspace grouping
    let project_name = std::path::Path::new(&cwd)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("claude")
        .to_string();

    log(&format!("project_name={}", project_name));
    let (ws_match, last_workspace) = query_cmux_workspaces(&bin, &project_name);
    log(&format!("ws_match={:?} last_workspace={:?}", ws_match, last_workspace));

    if let Some(ws_ref) = ws_match {
        log(&format!("path=existing_workspace ws={}", ws_ref));
        let last_surface = get_last_pane_surface(&bin, &ws_ref);

        let out = std::process::Command::new(&bin)
            .args(["new-surface", "--workspace", &ws_ref, "--type", "terminal"])
            .output()
            .map_err(|e| format!("Failed to create surface: {}", e))?;
        log(&format!("new-surface stdout={}", String::from_utf8_lossy(&out.stdout).trim()));

        let new_surface_ref = String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .find(|t| t.starts_with("surface:"))
            .unwrap_or("")
            .to_string();

        if let Some(last_ref) = last_surface {
            let _ = std::process::Command::new(&bin)
                .args(["move-surface", "--surface", &new_surface_ref, "--after", &last_ref, "--focus", "true"])
                .output();
        }

        let cmd_line = format!("cd {} && {}\\n", cwd, claude_cmd);
        log(&format!("send cmd_line={}", cmd_line));
        std::process::Command::new(&bin)
            .args(["send", "--workspace", &ws_ref, "--surface", &new_surface_ref, &cmd_line])
            .spawn()
            .map_err(|e| format!("Failed to send command to cmux: {}", e))?;

        let _ = std::process::Command::new(&bin)
            .args(["select-workspace", "--workspace", &ws_ref])
            .output();

        let r = std::process::Command::new("/usr/bin/open").args(["-a", "cmux"]).spawn();
        log(&format!("open -a cmux: {:?}", r.map(|_| "ok")));

        let _ = db().save_cmux_surface(&session_id, &ws_ref, &new_surface_ref);
    } else {
        log("path=new_workspace");
        if let Some(last_ref) = last_workspace {
            let _ = std::process::Command::new(&bin)
                .args(["select-workspace", "--workspace", &last_ref])
                .output();
        }

        let out = std::process::Command::new(&bin)
            .args(["new-workspace", "--name", &project_name, "--cwd", &cwd, "--command", &claude_cmd])
            .output()
            .map_err(|e| format!("Failed to spawn cmux: {}", e))?;
        log(&format!("new-workspace exit={} stdout={} stderr={}",
            out.status, String::from_utf8_lossy(&out.stdout).trim(), String::from_utf8_lossy(&out.stderr).trim()));

        if !out.status.success() {
            return Err(format!(
                "cmux new-workspace failed (exit {}): {}",
                out.status.code().unwrap_or(-1),
                String::from_utf8_lossy(&out.stderr).trim()
            ));
        }

        let new_ws_ref = String::from_utf8_lossy(&out.stdout)
            .split_whitespace()
            .find(|t| t.starts_with("workspace:"))
            .unwrap_or("")
            .to_string();

        if new_ws_ref.is_empty() {
            return Err(format!(
                "cmux new-workspace returned unexpected output: {}",
                String::from_utf8_lossy(&out.stdout).trim()
            ));
        }

        if !new_ws_ref.is_empty() {
            log(&format!("new_ws_ref={}", new_ws_ref));
            let _ = std::process::Command::new(&bin)
                .args(["select-workspace", "--workspace", &new_ws_ref])
                .output();

            let r = std::process::Command::new("/usr/bin/open").args(["-a", "cmux"]).spawn();
            log(&format!("open -a cmux: {:?}", r.map(|_| "ok")));

            if let Some(surface_ref) = get_last_pane_surface(&bin, &new_ws_ref) {
                let _ = db().save_cmux_surface(&session_id, &new_ws_ref, &surface_ref);
            }
        }
    }

    log("=== resume_in_cmux done Ok(())");
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

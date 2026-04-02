use crate::models::{Project, SessionSummary};
use crate::parser::{decode_project_path, parse_session_summary, project_display_name};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Get the Claude Code data directory
pub fn claude_dir() -> PathBuf {
    dirs::home_dir()
        .expect("Could not find home directory")
        .join(".claude")
}

/// Scan all projects from ~/.claude/projects/
pub fn scan_projects(tags_map: &HashMap<String, Vec<String>>, bookmarks: &[String]) -> Vec<Project> {
    let projects_dir = claude_dir().join("projects");
    if !projects_dir.exists() {
        return Vec::new();
    }

    let mut projects: Vec<Project> = Vec::new();

    if let Ok(entries) = fs::read_dir(&projects_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let dir_name = entry.file_name().to_string_lossy().to_string();
            let decoded_path = decode_project_path(&dir_name);
            let display_name = project_display_name(&decoded_path);

            // Count JSONL session files
            let session_count = count_jsonl_files(&path);
            if session_count == 0 {
                continue;
            }

            projects.push(Project {
                id: dir_name,
                name: display_name,
                path: decoded_path,
                session_count,
            });
        }
    }

    // Sort by session count descending
    projects.sort_by(|a, b| b.session_count.cmp(&a.session_count));
    let _ = (tags_map, bookmarks); // Used by callers
    projects
}

/// Scan all sessions for a given project (or all projects if project_id is None)
pub fn scan_sessions(
    project_id: Option<&str>,
    tags_map: &HashMap<String, Vec<String>>,
    bookmarks: &[String],
) -> Vec<SessionSummary> {
    let projects_dir = claude_dir().join("projects");
    if !projects_dir.exists() {
        return Vec::new();
    }

    let mut sessions: Vec<SessionSummary> = Vec::new();

    let dirs_to_scan: Vec<PathBuf> = if let Some(pid) = project_id {
        vec![projects_dir.join(pid)]
    } else {
        fs::read_dir(&projects_dir)
            .into_iter()
            .flat_map(|entries| entries.flatten())
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect()
    };

    for dir in dirs_to_scan {
        let dir_name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let decoded_path = decode_project_path(&dir_name);
        let display_name = project_display_name(&decoded_path);

        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if !file_name.ends_with(".jsonl") {
                    continue;
                }

                let session_id = file_name.trim_end_matches(".jsonl").to_string();

                // Skip if it's not a valid UUID-like session ID
                if session_id.len() < 8 {
                    continue;
                }

                if let Some(raw) = parse_session_summary(&path) {
                    let session_tags = tags_map
                        .get(&session_id)
                        .cloned()
                        .unwrap_or_default();
                    let is_bookmarked = bookmarks.contains(&session_id);

                    sessions.push(SessionSummary {
                        session_id: session_id.clone(),
                        project_id: dir_name.clone(),
                        project_name: display_name.clone(),
                        cwd: raw.cwd,
                        title: raw.title,
                        started_at: raw.started_at,
                        message_count: raw.message_count,
                        human_message_count: raw.human_message_count,
                        tool_use_count: raw.tool_use_count,
                        is_bookmarked,
                        is_renamed: raw.is_renamed,
                        tags: session_tags,
                    });
                }
            }
        }
    }

    // Sort: bookmarked first, then by started_at descending
    sessions.sort_by(|a, b| {
        b.is_bookmarked
            .cmp(&a.is_bookmarked)
            .then(b.started_at.cmp(&a.started_at))
    });

    sessions
}

/// Scan deleted sessions (.jsonl.deleted) for a given project (or all projects)
pub fn scan_deleted_sessions(
    project_id: Option<&str>,
    tags_map: &HashMap<String, Vec<String>>,
    bookmarks: &[String],
) -> Vec<SessionSummary> {
    let projects_dir = claude_dir().join("projects");
    if !projects_dir.exists() {
        return Vec::new();
    }

    let mut sessions: Vec<SessionSummary> = Vec::new();

    let dirs_to_scan: Vec<PathBuf> = if let Some(pid) = project_id {
        vec![projects_dir.join(pid)]
    } else {
        fs::read_dir(&projects_dir)
            .into_iter()
            .flat_map(|entries| entries.flatten())
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .collect()
    };

    for dir in dirs_to_scan {
        let dir_name = dir
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let decoded_path = decode_project_path(&dir_name);
        let display_name = project_display_name(&decoded_path);

        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                if !file_name.ends_with(".jsonl.deleted") {
                    continue;
                }

                let session_id = file_name.trim_end_matches(".jsonl.deleted").to_string();
                if session_id.len() < 8 {
                    continue;
                }

                if let Some(raw) = parse_session_summary(&path) {
                    let session_tags = tags_map.get(&session_id).cloned().unwrap_or_default();
                    let is_bookmarked = bookmarks.contains(&session_id);

                    sessions.push(SessionSummary {
                        session_id,
                        project_id: dir_name.clone(),
                        project_name: display_name.clone(),
                        cwd: raw.cwd,
                        title: raw.title,
                        started_at: raw.started_at,
                        message_count: raw.message_count,
                        human_message_count: raw.human_message_count,
                        tool_use_count: raw.tool_use_count,
                        is_bookmarked,
                        is_renamed: raw.is_renamed,
                        tags: session_tags,
                    });
                }
            }
        }
    }

    sessions.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    sessions
}

fn count_jsonl_files(dir: &Path) -> usize {
    fs::read_dir(dir)
        .into_iter()
        .flat_map(|entries| entries.flatten())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext == "jsonl")
                .unwrap_or(false)
        })
        .count()
}

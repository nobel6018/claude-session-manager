use rusqlite::{Connection, Result, params};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        let conn = Connection::open(&db_path)?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS session_tags (
                session_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now')),
                PRIMARY KEY (session_id, tag)
            );
            CREATE TABLE IF NOT EXISTS session_bookmarks (
                session_id TEXT PRIMARY KEY,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS cmux_surfaces (
                session_id TEXT PRIMARY KEY,
                workspace_ref TEXT NOT NULL,
                surface_ref TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS project_workspaces (
                project_path TEXT PRIMARY KEY,
                workspace_uuid TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tags_session ON session_tags(session_id);
            CREATE INDEX IF NOT EXISTS idx_tags_tag ON session_tags(tag);",
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn add_tag(&self, session_id: &str, tag: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO session_tags (session_id, tag) VALUES (?1, ?2)",
            params![session_id, tag],
        )?;
        Ok(())
    }

    pub fn remove_tag(&self, session_id: &str, tag: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM session_tags WHERE session_id = ?1 AND tag = ?2",
            params![session_id, tag],
        )?;
        Ok(())
    }

    pub fn get_all_tags_map(&self) -> Result<HashMap<String, Vec<String>>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT session_id, tag FROM session_tags ORDER BY created_at")?;
        let mut map: HashMap<String, Vec<String>> = HashMap::new();

        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        for row in rows {
            if let Ok((session_id, tag)) = row {
                map.entry(session_id).or_default().push(tag);
            }
        }

        Ok(map)
    }

    pub fn get_all_unique_tags(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT DISTINCT tag FROM session_tags ORDER BY tag")?;
        let tags: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(tags)
    }

    pub fn toggle_bookmark(&self, session_id: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();

        let exists: bool = conn.query_row(
            "SELECT COUNT(*) FROM session_bookmarks WHERE session_id = ?1",
            params![session_id],
            |row| row.get::<_, i64>(0),
        )? > 0;

        if exists {
            conn.execute(
                "DELETE FROM session_bookmarks WHERE session_id = ?1",
                params![session_id],
            )?;
            Ok(false)
        } else {
            conn.execute(
                "INSERT INTO session_bookmarks (session_id) VALUES (?1)",
                params![session_id],
            )?;
            Ok(true)
        }
    }

    pub fn get_bookmarked_sessions(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT session_id FROM session_bookmarks")?;
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    }

    /// Store (session_id → workspace_uuid, terminal_uuid) for session tracking.
    pub fn save_cmux_session(&self, session_id: &str, workspace_uuid: &str, terminal_uuid: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO cmux_surfaces (session_id, workspace_ref, surface_ref) VALUES (?1, ?2, ?3)",
            params![session_id, workspace_uuid, terminal_uuid],
        )?;
        Ok(())
    }

    pub fn get_cmux_session(&self, session_id: &str) -> Result<Option<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT workspace_ref, surface_ref FROM cmux_surfaces WHERE session_id = ?1",
            params![session_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );
        match result {
            Ok(pair) => Ok(Some(pair)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_cmux_session(&self, session_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM cmux_surfaces WHERE session_id = ?1", params![session_id])?;
        Ok(())
    }

    pub fn save_project_workspace(&self, project_path: &str, workspace_uuid: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO project_workspaces (project_path, workspace_uuid) VALUES (?1, ?2)",
            params![project_path, workspace_uuid],
        )?;
        Ok(())
    }

    pub fn get_project_workspace(&self, project_path: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT workspace_uuid FROM project_workspaces WHERE project_path = ?1",
            params![project_path],
            |row| row.get::<_, String>(0),
        );
        match result {
            Ok(uuid) => Ok(Some(uuid)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn delete_project_workspace(&self, project_path: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM project_workspaces WHERE project_path = ?1", params![project_path])?;
        Ok(())
    }
}

fn db_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap().join(".local/share"))
        .join("claude-session-manager")
        .join("data.db")
}

use crate::models::{Message, MessageType, SessionDetail};
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

/// Decode Claude's project path encoding: `-Users-levit-alwayz` → `/Users/levit/alwayz`
pub fn decode_project_path(encoded: &str) -> String {
    if encoded.is_empty() {
        return String::new();
    }
    let path = encoded.replace('-', "/");
    if path.starts_with('/') {
        path
    } else {
        format!("/{}", path)
    }
}

/// Extract a human-readable project name from the decoded path
pub fn project_display_name(decoded_path: &str) -> String {
    let home = dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();

    let relative = if decoded_path.starts_with(&home) {
        &decoded_path[home.len()..]
    } else {
        decoded_path
    };

    let trimmed = relative.trim_start_matches('/');
    if trimmed.is_empty() {
        "Home".to_string()
    } else {
        format!("~/{}", trimmed)
    }
}

/// Parse a session JSONL file to extract summary info (title, message counts)
pub fn parse_session_summary(path: &Path) -> Option<SessionSummaryRaw> {
    let file = File::open(path).ok()?;
    let reader = BufReader::new(file);

    let mut first_user_message: Option<String> = None;
    let mut session_name: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut message_count: usize = 0;
    let mut human_message_count: usize = 0;
    let mut tool_use_count: usize = 0;
    let mut started_at: Option<i64> = None;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let obj: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let msg_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");

        // Extract cwd from first message that has it
        if cwd.is_none() {
            if let Some(c) = obj.get("cwd").and_then(|v| v.as_str()) {
                cwd = Some(c.to_string());
            }
        }

        // Extract timestamp for session start
        if started_at.is_none() {
            if let Some(ts) = obj.get("timestamp").and_then(|t| t.as_str()) {
                if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(ts) {
                    started_at = Some(dt.timestamp_millis());
                }
            }
        }

        match msg_type {
            "system" => {
                // Extract session name from /rename command
                if let Some(content) = obj.get("content").and_then(|c| c.as_str()) {
                    if content.contains("Session renamed to:") {
                        if let Some(name) = content
                            .split("Session renamed to:")
                            .nth(1)
                            .map(|s| strip_xml_tags(s).trim().to_string())
                        {
                            if !name.is_empty() {
                                session_name = Some(name);
                            }
                        }
                    }
                }
            }
            "user" => {
                human_message_count += 1;
                message_count += 1;

                if first_user_message.is_none() {
                    first_user_message = extract_user_text(&obj);
                }
            }
            "assistant" => {
                message_count += 1;
                // Count tool_use blocks inside assistant messages
                if let Some(content) = obj
                    .pointer("/message/content")
                    .and_then(|c| c.as_array())
                {
                    for block in content {
                        if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                            tool_use_count += 1;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let title = if let Some(ref name) = session_name {
        name.clone()
    } else {
        first_user_message.unwrap_or_else(|| "(empty session)".to_string())
    };

    Some(SessionSummaryRaw {
        title,
        session_name,
        cwd: cwd.unwrap_or_default(),
        started_at: started_at.unwrap_or(0),
        message_count,
        human_message_count,
        tool_use_count,
    })
}

/// Parse full session detail for the preview panel
pub fn parse_session_detail(path: &Path, session_id: &str) -> SessionDetail {
    let mut messages: Vec<Message> = Vec::new();

    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => {
            return SessionDetail {
                session_id: session_id.to_string(),
                messages,
            }
        }
    };

    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let obj: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let msg_type = obj.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let timestamp = obj
            .get("timestamp")
            .and_then(|t| t.as_str())
            .map(|s| s.to_string());

        match msg_type {
            "user" => {
                if let Some(text) = extract_user_text(&obj) {
                    messages.push(Message {
                        msg_type: MessageType::User,
                        content: truncate(&text, 2000),
                        timestamp,
                        tool_name: None,
                        tool_input_preview: None,
                    });
                }
            }
            "assistant" => {
                if let Some(content) = obj
                    .pointer("/message/content")
                    .and_then(|c| c.as_array())
                {
                    for block in content {
                        let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
                        match block_type {
                            "text" => {
                                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                                    messages.push(Message {
                                        msg_type: MessageType::Assistant,
                                        content: truncate(text, 2000),
                                        timestamp: timestamp.clone(),
                                        tool_name: None,
                                        tool_input_preview: None,
                                    });
                                }
                            }
                            "tool_use" => {
                                let tool_name = block
                                    .get("name")
                                    .and_then(|n| n.as_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                let input_preview = block
                                    .get("input")
                                    .map(|i| {
                                        let s = serde_json::to_string(i).unwrap_or_default();
                                        truncate(&s, 200)
                                    })
                                    .unwrap_or_default();

                                messages.push(Message {
                                    msg_type: MessageType::ToolUse,
                                    content: format!("Tool: {}", tool_name),
                                    timestamp: timestamp.clone(),
                                    tool_name: Some(tool_name),
                                    tool_input_preview: Some(input_preview),
                                });
                            }
                            "tool_result" => {
                                let result_text = block
                                    .get("content")
                                    .and_then(|c| {
                                        if let Some(s) = c.as_str() {
                                            Some(s.to_string())
                                        } else if let Some(arr) = c.as_array() {
                                            arr.iter()
                                                .filter_map(|item| {
                                                    item.get("text").and_then(|t| t.as_str())
                                                })
                                                .next()
                                                .map(|s| s.to_string())
                                        } else {
                                            None
                                        }
                                    })
                                    .unwrap_or_default();

                                messages.push(Message {
                                    msg_type: MessageType::ToolResult,
                                    content: truncate(&result_text, 500),
                                    timestamp: timestamp.clone(),
                                    tool_name: None,
                                    tool_input_preview: None,
                                });
                            }
                            _ => {}
                        }
                    }
                }
            }
            _ => {}
        }
    }

    SessionDetail {
        session_id: session_id.to_string(),
        messages,
    }
}

fn extract_user_text(obj: &Value) -> Option<String> {
    // Try message.content array format
    if let Some(content) = obj.pointer("/message/content").and_then(|c| c.as_array()) {
        for block in content {
            if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    let cleaned = strip_xml_tags(text);
                    if !cleaned.is_empty() {
                        return Some(truncate(&cleaned, 200));
                    }
                }
            }
        }
    }

    // Try direct message.content string format
    if let Some(text) = obj.pointer("/message/content").and_then(|c| c.as_str()) {
        let cleaned = strip_xml_tags(text);
        if !cleaned.is_empty() {
            return Some(truncate(&cleaned, 200));
        }
    }

    None
}

/// Strip XML/HTML-like tags from a string: `<foo>bar</foo>` → `bar`
fn strip_xml_tags(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut inside_tag = false;

    for ch in s.chars() {
        match ch {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => result.push(ch),
            _ => {}
        }
    }

    // Collapse whitespace
    let collapsed: String = result
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ");

    collapsed.trim().to_string()
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        let mut end = max_len;
        while end > 0 && !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}...", &s[..end])
    }
}

pub struct SessionSummaryRaw {
    pub title: String,
    pub session_name: Option<String>,
    pub cwd: String,
    pub started_at: i64,
    pub message_count: usize,
    pub human_message_count: usize,
    pub tool_use_count: usize,
}

//! SQLite layer (sqlx). All queries are runtime (not the checked macros), so no
//! DATABASE_URL is needed at build time. Schema lives in migrations/001_init.sql.

use serde::{Deserialize, Serialize};
use sqlx::types::Json;
use sqlx::{FromRow, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct Db {
    pub pool: SqlitePool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct VideoWithCount {
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    pub url: String,
    pub duration: Option<i64>,
    pub last_pos_secs: f64,
    pub manual_order: bool,
    pub note_count: i64,
    pub tags: Json<Vec<String>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Video {
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    pub url: String,
    pub duration: Option<i64>,
    pub last_pos_secs: f64,
    pub manual_order: bool,
    pub tags: Json<Vec<String>>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct Note {
    pub id: String,
    pub video_id: String,
    pub t_secs: f64,
    pub content: String,
    pub order_index: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct SearchHit {
    pub note_id: String,
    pub video_id: String,
    pub video_title: String,
    pub t_secs: f64,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BackupVideo {
    pub id: String,
    pub title: String,
    pub channel: Option<String>,
    pub url: String,
    pub duration: Option<i64>,
    pub last_pos_secs: f64,
    pub manual_order: bool,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BackupNote {
    pub id: String,
    pub video_id: String,
    pub t_secs: f64,
    pub content: String,
    pub order_index: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Backup {
    pub videos: Vec<BackupVideo>,
    pub notes: Vec<BackupNote>,
}

impl Db {
    pub async fn list_videos(&self) -> Result<Vec<VideoWithCount>, sqlx::Error> {
        sqlx::query_as::<_, VideoWithCount>(
            "SELECT v.id, v.title, v.channel, v.url, v.duration, v.last_pos_secs, v.manual_order, v.tags,
                    (SELECT COUNT(*) FROM notes n WHERE n.video_id = v.id) AS note_count
             FROM videos v ORDER BY v.added_at DESC",
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn upsert_video(&self, id: &str, url: &str) -> Result<Video, sqlx::Error> {
        sqlx::query("INSERT INTO videos (id, url) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
            .bind(id)
            .bind(url)
            .execute(&self.pool)
            .await?;
        sqlx::query_as::<_, Video>(
            "SELECT id, title, channel, url, duration, last_pos_secs, manual_order, tags FROM videos WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn set_tags(&self, id: &str, tags: &[String]) -> Result<(), sqlx::Error> {
        let json = serde_json::to_string(tags).unwrap_or_else(|_| "[]".into());
        sqlx::query("UPDATE videos SET tags = ? WHERE id = ?")
            .bind(json)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_video_title(&self, id: &str, title: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE videos SET title = ? WHERE id = ?")
            .bind(title)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_last_pos(&self, id: &str, secs: f64) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE videos SET last_pos_secs = ? WHERE id = ?")
            .bind(secs)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_video(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM videos WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_notes(&self, video_id: &str) -> Result<Vec<Note>, sqlx::Error> {
        // Sort by time, unless this video is in manual mode (then by order_index, time as tiebreak).
        sqlx::query_as::<_, Note>(
            "SELECT id, video_id, t_secs, content, order_index FROM notes
             WHERE video_id = ?
             ORDER BY (CASE WHEN (SELECT manual_order FROM videos WHERE id = ?) = 1
                            THEN order_index ELSE 0 END), t_secs",
        )
        .bind(video_id)
        .bind(video_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn create_note(&self, video_id: &str, t_secs: f64, content: &str) -> Result<Note, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO notes (id, video_id, t_secs, content, order_index)
             VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM notes WHERE video_id = ?))",
        )
        .bind(&id)
        .bind(video_id)
        .bind(t_secs)
        .bind(content)
        .bind(video_id)
        .execute(&self.pool)
        .await?;
        sqlx::query_as::<_, Note>(
            "SELECT id, video_id, t_secs, content, order_index FROM notes WHERE id = ?",
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn update_note(&self, id: &str, content: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?")
            .bind(content)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn delete_note(&self, id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM notes WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn reorder_notes(&self, video_id: &str, ordered_ids: Vec<String>) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("UPDATE videos SET manual_order = 1 WHERE id = ?")
            .bind(video_id)
            .execute(&mut *tx)
            .await?;
        for (i, nid) in ordered_ids.iter().enumerate() {
            sqlx::query("UPDATE notes SET order_index = ? WHERE id = ? AND video_id = ?")
                .bind(i as i64)
                .bind(nid)
                .bind(video_id)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await
    }

    pub async fn reset_order(&self, video_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE videos SET manual_order = 0 WHERE id = ?")
            .bind(video_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn search_notes(&self, query: &str) -> Result<Vec<SearchHit>, sqlx::Error> {
        // Quote each term so FTS5 never chokes on punctuation; terms AND together.
        let fts: String = query
            .split_whitespace()
            .map(|t| format!("\"{}\"", t.replace('"', "\"\"")))
            .collect::<Vec<_>>()
            .join(" ");
        if fts.is_empty() {
            return Ok(vec![]);
        }
        sqlx::query_as::<_, SearchHit>(
            "SELECT n.id AS note_id, n.video_id AS video_id, v.title AS video_title,
                    n.t_secs AS t_secs, n.content AS content
             FROM notes_fts f
             JOIN notes n ON n.rowid = f.rowid
             JOIN videos v ON v.id = n.video_id
             WHERE notes_fts MATCH ? ORDER BY rank LIMIT 50",
        )
        .bind(fts)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn export(&self) -> Result<Backup, sqlx::Error> {
        let videos = sqlx::query_as::<_, BackupVideo>(
            "SELECT id, title, channel, url, duration, last_pos_secs, manual_order FROM videos",
        )
        .fetch_all(&self.pool)
        .await?;
        let notes = sqlx::query_as::<_, BackupNote>(
            "SELECT id, video_id, t_secs, content, order_index FROM notes",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(Backup { videos, notes })
    }

    pub async fn import(&self, backup: Backup) -> Result<(), sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        for v in &backup.videos {
            sqlx::query(
                "INSERT OR IGNORE INTO videos (id, title, channel, url, duration, last_pos_secs, manual_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&v.id)
            .bind(&v.title)
            .bind(&v.channel)
            .bind(&v.url)
            .bind(v.duration)
            .bind(v.last_pos_secs)
            .bind(v.manual_order)
            .execute(&mut *tx)
            .await?;
        }
        for n in &backup.notes {
            sqlx::query(
                "INSERT OR IGNORE INTO notes (id, video_id, t_secs, content, order_index)
                 VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&n.id)
            .bind(&n.video_id)
            .bind(n.t_secs)
            .bind(&n.content)
            .bind(n.order_index)
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await
    }
}

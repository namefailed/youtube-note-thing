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
    pub ext_ref: Option<String>,
    pub pinned: bool,
    pub view_count: Option<i64>,
    pub published_at: Option<String>,
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
    pub ext_ref: Option<String>,
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

#[derive(Debug, Serialize, FromRow)]
pub struct PlaylistItem {
    pub video_id: String,
    pub item_id: String,
    pub title: String,
    pub position: i64,
    pub in_library: bool,
}

#[derive(Debug, Serialize, FromRow)]
pub struct PlaylistRef {
    pub playlist_id: String,
    pub playlist_title: String,
    pub item_id: String,
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
    pub tags: Json<Vec<String>>,
    pub ext_ref: Option<String>,
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
            "SELECT v.id, v.title, v.channel, v.url, v.duration, v.last_pos_secs, v.manual_order, v.tags, v.ext_ref, v.pinned,
                    v.view_count, v.published_at,
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
            "SELECT id, title, channel, url, duration, last_pos_secs, manual_order, tags, ext_ref FROM videos WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn set_ext_ref(&self, id: &str, ext_ref: Option<&str>) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE videos SET ext_ref = ? WHERE id = ?")
            .bind(ext_ref)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
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

    /// Fill YouTube metadata for one video (from the Data API). NULL args leave
    /// the existing value; an empty title keeps the current one too.
    #[allow(clippy::too_many_arguments)]
    pub async fn set_video_meta(
        &self,
        id: &str,
        title: Option<&str>,
        channel: Option<&str>,
        duration: Option<i64>,
        view_count: Option<i64>,
        published_at: Option<&str>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE videos SET
                title        = COALESCE(NULLIF(?, ''), title),
                channel      = COALESCE(?, channel),
                duration     = COALESCE(?, duration),
                view_count   = COALESCE(?, view_count),
                published_at = COALESCE(?, published_at)
             WHERE id = ?",
        )
        .bind(title)
        .bind(channel)
        .bind(duration)
        .bind(view_count)
        .bind(published_at)
        .bind(id)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn set_pinned(&self, id: &str, pinned: bool) -> Result<(), sqlx::Error> {
        sqlx::query("UPDATE videos SET pinned = ? WHERE id = ?")
            .bind(pinned)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Bulk-insert videos from a playlist import (id, title). Existing ids are left
    /// untouched. Returns how many were newly added.
    pub async fn import_playlist(&self, items: &[(String, String)]) -> Result<usize, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let mut n = 0usize;
        for (id, title) in items {
            let url = format!("https://youtu.be/{id}");
            let res = sqlx::query("INSERT OR IGNORE INTO videos (id, url, title) VALUES (?, ?, ?)")
                .bind(id)
                .bind(&url)
                .bind(title)
                .execute(&mut *tx)
                .await?;
            n += res.rows_affected() as usize;
        }
        tx.commit().await?;
        Ok(n)
    }

    /// Replace the cached contents of one playlist. items = (video_id, item_id, title, position).
    pub async fn sync_playlist(&self, playlist_id: &str, playlist_title: &str, items: &[(String, String, String, i64)]) -> Result<usize, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        sqlx::query("DELETE FROM playlist_items WHERE playlist_id = ?")
            .bind(playlist_id)
            .execute(&mut *tx)
            .await?;
        for (video_id, item_id, title, position) in items {
            sqlx::query("INSERT OR REPLACE INTO playlist_items (playlist_id, playlist_title, video_id, item_id, title, position) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(playlist_id)
                .bind(playlist_title)
                .bind(video_id)
                .bind(item_id)
                .bind(title)
                .bind(position)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        Ok(items.len())
    }

    pub async fn playlist_items(&self, playlist_id: &str) -> Result<Vec<PlaylistItem>, sqlx::Error> {
        sqlx::query_as::<_, PlaylistItem>(
            "SELECT pi.video_id, pi.item_id, pi.title, pi.position, (v.id IS NOT NULL) AS in_library
             FROM playlist_items pi LEFT JOIN videos v ON v.id = pi.video_id
             WHERE pi.playlist_id = ? ORDER BY pi.position",
        )
        .bind(playlist_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Which synced playlists a video belongs to (with the item id needed to remove it).
    pub async fn video_playlists(&self, video_id: &str) -> Result<Vec<PlaylistRef>, sqlx::Error> {
        sqlx::query_as::<_, PlaylistRef>(
            "SELECT playlist_id, playlist_title, item_id FROM playlist_items WHERE video_id = ? AND item_id != ''",
        )
        .bind(video_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn delete_playlist_item(&self, playlist_id: &str, video_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM playlist_items WHERE playlist_id = ? AND video_id = ?")
            .bind(playlist_id)
            .bind(video_id)
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
            "SELECT id, title, channel, url, duration, last_pos_secs, manual_order, tags, ext_ref FROM videos",
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
                "INSERT OR IGNORE INTO videos (id, title, channel, url, duration, last_pos_secs, manual_order, tags, ext_ref)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&v.id)
            .bind(&v.title)
            .bind(&v.channel)
            .bind(&v.url)
            .bind(v.duration)
            .bind(v.last_pos_secs)
            .bind(v.manual_order)
            .bind(serde_json::to_string(&v.tags.0).unwrap_or_else(|_| "[]".to_string()))
            .bind(v.ext_ref.as_deref())
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

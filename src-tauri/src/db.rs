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

#[derive(Debug, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Serialize, Deserialize, FromRow)]
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

#[derive(Debug, Serialize, Deserialize)]
pub struct Backup {
    pub videos: Vec<Video>,
    pub notes: Vec<Note>,
}

#[derive(Debug, Serialize)]
pub struct ImportStats {
    pub added_videos: usize,
    pub skipped_videos: usize,
    pub added_notes: usize,
    pub skipped_notes: usize,
}

impl Db {
    pub async fn list_videos(&self) -> Result<Vec<VideoWithCount>, sqlx::Error> {
        sqlx::query_as::<_, VideoWithCount>(
            "SELECT v.id, v.title, v.channel, v.url, v.duration, v.last_pos_secs, v.manual_order, v.tags, v.ext_ref, v.pinned,
                    v.view_count, v.published_at, COUNT(n.id) AS note_count
             FROM videos v LEFT JOIN notes n ON n.video_id = v.id
             GROUP BY v.id ORDER BY v.added_at DESC",
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
        sqlx::query("UPDATE videos SET tags = ? WHERE id = ?")
            .bind(Json(tags))
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

    /// Pin / unpin a video (pinned rows float to the top of the library).
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
    pub async fn sync_playlist(
        &self,
        playlist_id: &str,
        playlist_title: &str,
        items: &[(String, String, String, i64)],
    ) -> Result<usize, sqlx::Error> {
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

    pub async fn playlist_items(
        &self,
        playlist_id: &str,
    ) -> Result<Vec<PlaylistItem>, sqlx::Error> {
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

    pub async fn delete_playlist_item(
        &self,
        playlist_id: &str,
        video_id: &str,
    ) -> Result<(), sqlx::Error> {
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
        let mut tx = self.pool.begin().await?;
        // Notes cascade via FK; playlist_items has no FK to videos (migration 005),
        // so clear its rows explicitly or they orphan and accumulate.
        sqlx::query("DELETE FROM playlist_items WHERE video_id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        sqlx::query("DELETE FROM videos WHERE id = ?")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await
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

    pub async fn create_note(
        &self,
        video_id: &str,
        t_secs: f64,
        content: &str,
    ) -> Result<Note, sqlx::Error> {
        let id = Uuid::new_v4().to_string();
        sqlx::query_as::<_, Note>(
            "INSERT INTO notes (id, video_id, t_secs, content, order_index)
             VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM notes WHERE video_id = ?))
             RETURNING id, video_id, t_secs, content, order_index",
        )
        .bind(&id)
        .bind(video_id)
        .bind(t_secs)
        .bind(content)
        .bind(video_id)
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

    pub async fn reorder_notes(
        &self,
        video_id: &str,
        ordered_ids: Vec<String>,
    ) -> Result<(), sqlx::Error> {
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
        let videos = sqlx::query_as::<_, Video>(
            "SELECT id, title, channel, url, duration, last_pos_secs, manual_order, tags, ext_ref FROM videos",
        )
        .fetch_all(&self.pool)
        .await?;
        let notes = sqlx::query_as::<_, Note>(
            "SELECT id, video_id, t_secs, content, order_index FROM notes",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(Backup { videos, notes })
    }

    pub async fn import(&self, backup: Backup) -> Result<ImportStats, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let mut added_videos = 0usize;
        let mut skipped_videos = 0usize;
        for v in &backup.videos {
            let res = sqlx::query(
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
            .bind(Json(&v.tags.0))
            .bind(v.ext_ref.as_deref())
            .execute(&mut *tx)
            .await?;
            if res.rows_affected() > 0 {
                added_videos += 1;
            } else {
                skipped_videos += 1;
            }
        }
        let mut added_notes = 0usize;
        let mut skipped_notes = 0usize;
        for n in &backup.notes {
            let res = sqlx::query(
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
            if res.rows_affected() > 0 {
                added_notes += 1;
            } else {
                skipped_notes += 1;
            }
        }
        tx.commit().await?;
        Ok(ImportStats {
            added_videos,
            skipped_videos,
            added_notes,
            skipped_notes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqliteConnectOptions;
    use std::str::FromStr;

    /// Open a fresh in-memory SQLite pool and run all migrations on it.
    async fn test_db() -> Db {
        let opts = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .foreign_keys(true);
        let pool = sqlx::sqlite::SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(opts)
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        Db { pool }
    }

    /// Seed a db with one video and two notes; export; import into a fresh db;
    /// assert row counts and content match.
    #[tokio::test]
    async fn roundtrip_export_import() {
        let src = test_db().await;

        // seed
        src.upsert_video("vid1", "https://youtu.be/vid1")
            .await
            .unwrap();
        let n1 = src.create_note("vid1", 1.0, "note alpha").await.unwrap();
        let n2 = src.create_note("vid1", 2.5, "note beta").await.unwrap();

        // export
        let backup = src.export().await.unwrap();
        assert_eq!(backup.videos.len(), 1);
        assert_eq!(backup.notes.len(), 2);

        // import into a fresh db
        let dst = test_db().await;
        let stats = dst.import(backup).await.unwrap();
        assert_eq!(stats.added_videos, 1);
        assert_eq!(stats.added_notes, 2);
        assert_eq!(stats.skipped_videos, 0);
        assert_eq!(stats.skipped_notes, 0);

        let videos = dst.list_videos().await.unwrap();
        assert_eq!(videos.len(), 1);
        assert_eq!(videos[0].id, "vid1");
        assert_eq!(videos[0].note_count, 2);

        let notes = dst.list_notes("vid1").await.unwrap();
        assert_eq!(notes.len(), 2);
        // both note IDs and content must survive the round-trip
        let ids: Vec<&str> = notes.iter().map(|n| n.id.as_str()).collect();
        assert!(ids.contains(&n1.id.as_str()));
        assert!(ids.contains(&n2.id.as_str()));
        let contents: Vec<&str> = notes.iter().map(|n| n.content.as_str()).collect();
        assert!(contents.contains(&"note alpha"));
        assert!(contents.contains(&"note beta"));
    }

    /// Importing notes whose video_id is absent from the backup videos list must
    /// return a FK error rather than silently succeeding.
    #[tokio::test]
    async fn import_orphan_note_returns_fk_error() {
        let db = test_db().await;

        // Build a backup with a note referencing a video that is NOT in the backup.
        let backup = Backup {
            videos: vec![],
            notes: vec![Note {
                id: "note-orphan".into(),
                video_id: "no-such-video".into(),
                t_secs: 0.0,
                content: "orphan".into(),
                order_index: 0,
            }],
        };

        let result = db.import(backup).await;
        assert!(
            result.is_err(),
            "expected FK error when importing a note with no matching video"
        );
    }

    /// FTS quote-escaping must tolerate punctuation and embedded quotes without
    /// raising an FTS5 syntax error.
    #[tokio::test]
    async fn search_notes_tolerates_punctuation_and_quotes() {
        let db = test_db().await;
        db.upsert_video("v", "https://youtu.be/v").await.unwrap();
        db.create_note("v", 0.0, "the quick brown fox")
            .await
            .unwrap();

        // Hyphen is a tokenizer boundary, so the phrase matches the adjacent words.
        let hits = db.search_notes("brown-fox").await.unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].content, "the quick brown fox");

        // An embedded double-quote must be escaped, not raise an FTS syntax error.
        assert!(db.search_notes("fox\"").await.is_ok());

        // Whitespace-only query short-circuits to no hits.
        assert!(db.search_notes("   ").await.unwrap().is_empty());
    }

    /// `import_playlist` returns only the count of newly-added rows (re-import of
    /// an existing id is a no-op via INSERT OR IGNORE).
    #[tokio::test]
    async fn import_playlist_counts_only_new() {
        let db = test_db().await;
        let first = db
            .import_playlist(&[("a".into(), "A".into()), ("b".into(), "B".into())])
            .await
            .unwrap();
        assert_eq!(first, 2);
        let second = db
            .import_playlist(&[("a".into(), "A".into()), ("c".into(), "C".into())])
            .await
            .unwrap();
        assert_eq!(second, 1, "only the new id counts on re-import");
    }

    /// Notes sort by time until `reorder_notes` flips the video into manual mode
    /// (then by `order_index`); `reset_order` reverts to time sort.
    #[tokio::test]
    async fn reorder_and_reset_note_order() {
        let db = test_db().await;
        db.upsert_video("v", "https://youtu.be/v").await.unwrap();
        // Seed out of time order so the default sort is observable.
        let n_late = db.create_note("v", 30.0, "late").await.unwrap();
        let n_early = db.create_note("v", 10.0, "early").await.unwrap();
        let n_mid = db.create_note("v", 20.0, "mid").await.unwrap();

        // Default: time sort.
        let by_time: Vec<String> = db
            .list_notes("v")
            .await
            .unwrap()
            .into_iter()
            .map(|n| n.content)
            .collect();
        assert_eq!(by_time, ["early", "mid", "late"]);

        // Manual reorder: reverse-time order.
        db.reorder_notes(
            "v",
            vec![n_late.id.clone(), n_mid.id.clone(), n_early.id.clone()],
        )
        .await
        .unwrap();
        let manual: Vec<String> = db
            .list_notes("v")
            .await
            .unwrap()
            .into_iter()
            .map(|n| n.content)
            .collect();
        assert_eq!(manual, ["late", "mid", "early"]);
        assert!(
            db.list_videos().await.unwrap()[0].manual_order,
            "reorder_notes must flip manual_order true"
        );

        // Reset: back to time sort.
        db.reset_order("v").await.unwrap();
        let after_reset: Vec<String> = db
            .list_notes("v")
            .await
            .unwrap()
            .into_iter()
            .map(|n| n.content)
            .collect();
        assert_eq!(after_reset, ["early", "mid", "late"]);
    }

    /// `sync_playlist` caches items (with the in_library join), and `delete_video`
    /// clears that video's playlist_items so nothing orphans.
    #[tokio::test]
    async fn sync_playlist_caches_and_delete_video_clears_items() {
        let db = test_db().await;
        db.upsert_video("vid", "https://youtu.be/vid")
            .await
            .unwrap();
        db.sync_playlist(
            "pl",
            "My PL",
            &[
                ("vid".into(), "item1".into(), "Vid".into(), 0),
                ("other".into(), "item2".into(), "Other".into(), 1),
            ],
        )
        .await
        .unwrap();

        let items = db.playlist_items("pl").await.unwrap();
        assert_eq!(items.len(), 2);
        assert!(items.iter().any(|i| i.video_id == "vid" && i.in_library));
        assert!(items.iter().any(|i| i.video_id == "other" && !i.in_library));

        let pls = db.video_playlists("vid").await.unwrap();
        assert_eq!(pls.len(), 1);
        assert_eq!(pls[0].playlist_id, "pl");

        db.delete_video("vid").await.unwrap();
        assert!(
            db.video_playlists("vid").await.unwrap().is_empty(),
            "playlist_items rows must be cleared on delete_video"
        );
        let remaining = db.playlist_items("pl").await.unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].video_id, "other");
    }
}

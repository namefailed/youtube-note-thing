//! youtube-note-thing — Tauri 2 backend. Owns the SQLite store and exposes a
//! small command surface to the Lit frontend. No audio, no integrations yet.

mod db;

use db::{Backup, Db, Note, SearchHit, VideoWithCount};
use tauri::{Manager, State};

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
async fn list_videos(db: State<'_, Db>) -> Result<Vec<VideoWithCount>, String> {
    db.list_videos().await.map_err(err)
}

#[tauri::command]
async fn upsert_video(db: State<'_, Db>, id: String, url: String) -> Result<db::Video, String> {
    db.upsert_video(&id, &url).await.map_err(err)
}

#[tauri::command]
async fn set_video_title(db: State<'_, Db>, id: String, title: String) -> Result<(), String> {
    db.set_video_title(&id, &title).await.map_err(err)
}

#[tauri::command]
async fn set_last_pos(db: State<'_, Db>, id: String, secs: f64) -> Result<(), String> {
    db.set_last_pos(&id, secs).await.map_err(err)
}

#[tauri::command]
async fn set_video_tags(db: State<'_, Db>, id: String, tags: Vec<String>) -> Result<(), String> {
    db.set_tags(&id, &tags).await.map_err(err)
}

#[tauri::command]
async fn delete_video(db: State<'_, Db>, id: String) -> Result<(), String> {
    db.delete_video(&id).await.map_err(err)
}

#[tauri::command]
async fn list_notes(db: State<'_, Db>, video_id: String) -> Result<Vec<Note>, String> {
    db.list_notes(&video_id).await.map_err(err)
}

#[tauri::command]
async fn create_note(db: State<'_, Db>, video_id: String, t_secs: f64, content: String) -> Result<Note, String> {
    db.create_note(&video_id, t_secs, &content).await.map_err(err)
}

#[tauri::command]
async fn update_note(db: State<'_, Db>, id: String, content: String) -> Result<(), String> {
    db.update_note(&id, &content).await.map_err(err)
}

#[tauri::command]
async fn delete_note(db: State<'_, Db>, id: String) -> Result<(), String> {
    db.delete_note(&id).await.map_err(err)
}

#[tauri::command]
async fn reorder_notes(db: State<'_, Db>, video_id: String, ordered_ids: Vec<String>) -> Result<(), String> {
    db.reorder_notes(&video_id, ordered_ids).await.map_err(err)
}

#[tauri::command]
async fn reset_order(db: State<'_, Db>, video_id: String) -> Result<(), String> {
    db.reset_order(&video_id).await.map_err(err)
}

#[tauri::command]
async fn search_notes(db: State<'_, Db>, query: String) -> Result<Vec<SearchHit>, String> {
    db.search_notes(&query).await.map_err(err)
}

#[tauri::command]
async fn export_json(db: State<'_, Db>) -> Result<String, String> {
    let backup = db.export().await.map_err(err)?;
    serde_json::to_string_pretty(&backup).map_err(err)
}

#[tauri::command]
async fn import_json(db: State<'_, Db>, json: String) -> Result<(), String> {
    let backup: Backup = serde_json::from_str(&json).map_err(err)?;
    db.import(backup).await.map_err(err)
}

/// Write Markdown to a user-chosen folder (e.g. an Obsidian vault). The path is
/// supplied by the user in settings; we just validate it's an existing directory.
#[tauri::command]
fn save_markdown(dir: String, name: String, content: String) -> Result<String, String> {
    let d = std::path::Path::new(&dir);
    if !d.is_dir() {
        return Err(format!("Folder not found: {dir}"));
    }
    let path = d.join(&name);
    std::fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir().expect("resolve app data dir");
            std::fs::create_dir_all(&dir).ok();
            let dbfile = dir.join("ytnt.db");
            let db = tauri::async_runtime::block_on(async move {
                let opts = sqlx::sqlite::SqliteConnectOptions::new()
                    .filename(&dbfile)
                    .create_if_missing(true)
                    .foreign_keys(true)
                    .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
                let pool = sqlx::sqlite::SqlitePoolOptions::new()
                    .max_connections(5)
                    .connect_with(opts)
                    .await?;
                sqlx::migrate!("./migrations").run(&pool).await?;
                Ok::<Db, sqlx::Error>(Db { pool })
            })
            .expect("initialize database");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_videos,
            upsert_video,
            set_video_title,
            set_last_pos,
            set_video_tags,
            delete_video,
            list_notes,
            create_note,
            update_note,
            delete_note,
            reorder_notes,
            reset_order,
            search_notes,
            export_json,
            import_json,
            save_markdown,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

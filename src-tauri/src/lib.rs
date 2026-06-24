//! youtube-note-thing — Tauri 2 backend. Owns the SQLite store and exposes a
//! small command surface to the Lit frontend. No audio, no integrations yet.

mod db;

use db::{Backup, Db, Note, PlaylistItem, PlaylistRef, SearchHit, VideoWithCount};
use std::io::{Read, Write};
use std::net::TcpListener;
use tauri::{AppHandle, Manager, State};

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
async fn set_pinned(db: State<'_, Db>, id: String, pinned: bool) -> Result<(), String> {
    db.set_pinned(&id, pinned).await.map_err(err)
}

#[tauri::command]
async fn set_video_tags(db: State<'_, Db>, id: String, tags: Vec<String>) -> Result<(), String> {
    db.set_tags(&id, &tags).await.map_err(err)
}

#[tauri::command]
async fn set_ext_ref(db: State<'_, Db>, id: String, ext_ref: Option<String>) -> Result<(), String> {
    db.set_ext_ref(&id, ext_ref.as_deref()).await.map_err(err)
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

// ── Optional Phoneme integration (via its CLI, which talks to the daemon) ─────
// All best-effort: if the `phoneme` CLI isn't on PATH / the daemon is down, these
// fail and the UI degrades to "Phoneme not detected". We never bundle or require it.

#[derive(serde::Serialize, serde::Deserialize)]
struct Segment {
    #[serde(default)] start_ms: i64,
    #[serde(default)] end_ms: i64,
    #[serde(default)] text: String,
    #[serde(default)] speaker: Option<String>,
}

fn run_phoneme(args: &[&str]) -> Result<String, String> {
    let out = std::process::Command::new("phoneme")
        .args(args)
        .output()
        .map_err(|e| format!("Phoneme CLI not found ({e})"))?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Is the Phoneme CLI present and its daemon reachable?
#[tauri::command]
fn phoneme_available() -> bool {
    std::process::Command::new("phoneme")
        .args(["--json", "list", "--limit", "1"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// The lowest Phoneme version whose `--json` / CLI contract ytnt was built
/// against (e.g. `chapters --show`, `show --segments`). Older daemons get a
/// loud "update Phoneme" notice instead of silently-blank panels.
const MIN_PHONEME_VERSION: (u32, u32) = (1, 8);

/// Parse the major/minor out of `phoneme version`'s `phoneme X.Y.Z` line.
fn parse_phoneme_version(out: &str) -> Option<(u32, u32)> {
    let v = out.split_whitespace().last()?;
    let mut parts = v.split('.');
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    Some((major, minor))
}

#[derive(serde::Serialize)]
struct PhonemeProbe {
    /// CLI on PATH and `phoneme version` succeeded.
    present: bool,
    /// The daemon answered a `list` (the full feature path is usable).
    daemon_ok: bool,
    /// Reported `X.Y.Z`, or empty when the CLI couldn't be run.
    version: String,
    /// `version` is at least [`MIN_PHONEME_VERSION`] (or unknown, treated as ok).
    compatible: bool,
}

/// A richer Phoneme probe than [`phoneme_available`]: distinguishes "CLI present"
/// (version prints — no daemon needed) from "daemon reachable" (a `list`
/// succeeds), and flags a too-old CLI. The frontend polls this so a daemon that
/// dies (or starts) mid-session is reflected live, and an incompatible install
/// degrades loudly instead of showing blank panels.
#[tauri::command]
fn phoneme_probe() -> PhonemeProbe {
    let version_out = std::process::Command::new("phoneme")
        .arg("version")
        .output();
    let (present, version) = match &version_out {
        Ok(o) if o.status.success() => (
            true,
            String::from_utf8_lossy(&o.stdout)
                .split_whitespace()
                .last()
                .unwrap_or("")
                .to_string(),
        ),
        _ => (false, String::new()),
    };
    // Unknown version (e.g. a build without `version`) is treated as compatible
    // rather than locking the user out; a parseable-but-old one degrades loudly.
    let compatible = parse_phoneme_version(&version)
        .map(|v| v >= MIN_PHONEME_VERSION)
        .unwrap_or(true);
    let daemon_ok = present && phoneme_available();
    PhonemeProbe { present, daemon_ok, version, compatible }
}

/// Hand a YouTube URL to Phoneme (downloads audio + queues transcription).
/// Blocks until the download finishes, so it runs off the async pool. Returns the
/// new recording id.
#[tauri::command]
async fn phoneme_import(url: String) -> Result<String, String> {
    let out = tauri::async_runtime::spawn_blocking(move || run_phoneme(&["import", &url]))
        .await
        .map_err(|e| e.to_string())??;
    let id = out.split_whitespace().last().unwrap_or("").to_string();
    if id.is_empty() {
        return Err("Phoneme returned no recording id".into());
    }
    Ok(id)
}

/// Parse JSON-lines output, logging (not silently dropping) any unparseable
/// line. Errors only when there WAS output but nothing parsed — a sign the
/// contract drifted — so callers can surface a quiet notice instead of a blank
/// panel. Genuinely empty output (nothing transcribed yet) is an empty Vec, OK.
fn parse_json_lines<T: serde::de::DeserializeOwned>(out: &str, what: &str) -> Result<Vec<T>, String> {
    let mut items = Vec::new();
    let mut seen = 0usize;
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        seen += 1;
        match serde_json::from_str::<T>(line) {
            Ok(v) => items.push(v),
            Err(e) => eprintln!("phoneme {what}: skipping unparseable line: {e}"),
        }
    }
    if seen > 0 && items.is_empty() {
        return Err(format!(
            "Couldn't read Phoneme's {what} output — it may be a different version than expected."
        ));
    }
    Ok(items)
}

/// Fetch a recording's transcript segments (empty while still transcribing).
#[tauri::command]
fn phoneme_segments(id: String) -> Result<Vec<Segment>, String> {
    let out = run_phoneme(&["--json", "show", &id, "--segments"])?;
    parse_json_lines(&out, "segments")
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Chapter {
    #[serde(default)] start_ms: i64,
    #[serde(default)] end_ms: i64,
    #[serde(default)] title: String,
    #[serde(default)] summary: Option<String>,
}

/// A recording's stored auto-chapters (read-only: `--show` never triggers the
/// LLM chapter-generation step, so this is a passive view). Empty when the
/// recording has no chapters — a normal state, not an error.
#[tauri::command]
fn phoneme_chapters(id: String) -> Result<Vec<Chapter>, String> {
    let out = run_phoneme(&["--json", "chapters", &id, "--show"])?;
    parse_json_lines(&out, "chapters")
}

#[derive(serde::Serialize)]
struct PhonemeHit {
    id: String,
    title: String,
    snippet: String,
}

/// Semantic search across the whole Phoneme archive (best-effort, via the CLI).
#[tauri::command]
fn phoneme_search(query: String) -> Result<Vec<PhonemeHit>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let out = run_phoneme(&["--json", "search", &query, "--limit", "10"])?;
    let mut hits = Vec::new();
    let mut seen = 0usize;
    let mut parse_failed = 0usize;
    for line in out.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        seen += 1;
        let v = match serde_json::from_str::<serde_json::Value>(line) {
            Ok(v) => v,
            Err(e) => { eprintln!("phoneme search: skipping unparseable line: {e}"); parse_failed += 1; continue }
        };
        let rec = v.get("recording").unwrap_or(&v);
        let id = rec.get("id").and_then(|x| x.as_str()).unwrap_or_default().to_string();
        if id.is_empty() {
            continue;
        }
        let title = rec.get("title").and_then(|x| x.as_str()).unwrap_or_default().to_string();
        let snippet: String = rec
            .get("summary")
            .and_then(|x| x.as_str())
            .or_else(|| rec.get("transcript").and_then(|x| x.as_str()))
            .unwrap_or_default()
            .chars()
            .take(140)
            .collect();
        hits.push(PhonemeHit { id, title, snippet });
    }
    // Every line failed to even parse as JSON → the contract drifted; surface it.
    if seen > 0 && parse_failed == seen {
        return Err("Couldn't read Phoneme's search output — it may be a different version than expected.".into());
    }
    Ok(hits)
}

/// OS-branched path to Phoneme's daemon IPC endpoint (default name
/// `phoneme-daemon`). On Windows this is the named pipe `\\.\pipe\phoneme-daemon`.
///
/// Phoneme's IPC is **Windows-named-pipe only** today — `phoneme-ipc` uses
/// `tokio::net::windows::named_pipe` with no Unix-socket transport — so there is
/// no stable Unix path to dial. Rather than silently no-op off Windows, the
/// pipe-only features (transcript versions) return `Err(None)` here so callers
/// surface a clear "not available on this OS yet" notice. See plans/PHONEME_ASKS.md.
#[cfg(windows)]
fn phoneme_pipe_path() -> Option<String> {
    Some(r"\\.\pipe\phoneme-daemon".to_string())
}
#[cfg(not(windows))]
fn phoneme_pipe_path() -> Option<String> {
    None
}

// Phoneme's daemon named pipe (NDJSON). The full transcript-version chain is only
// exposed here — not via the CLI or REST — so we talk to it directly for variants.
fn phoneme_ipc(req: serde_json::Value) -> Result<serde_json::Value, String> {
    use std::io::{BufRead, BufReader, Write};
    let path = phoneme_pipe_path().ok_or_else(|| {
        "This feature needs Phoneme's daemon pipe, which is only available on Windows for now.".to_string()
    })?;
    let mut pipe = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(&path)
        .map_err(|e| format!("Phoneme daemon not reachable ({e})"))?;
    let line = serde_json::to_string(&req).map_err(err)? + "\n";
    pipe.write_all(line.as_bytes()).map_err(err)?;
    pipe.flush().ok();
    let mut reader = BufReader::new(pipe);
    let mut resp = String::new();
    reader.read_line(&mut resp).map_err(err)?;
    let v: serde_json::Value = serde_json::from_str(resp.trim()).map_err(err)?;
    match v.get("status").and_then(|s| s.as_str()) {
        Some("ok") => Ok(v.get("value").cloned().unwrap_or(serde_json::Value::Null)),
        _ => Err(v
            .pointer("/value/message")
            .and_then(|m| m.as_str())
            .unwrap_or("Phoneme IPC error")
            .to_string()),
    }
}

#[derive(serde::Serialize)]
struct PhonemeEntity { kind: String, value: String }
#[derive(serde::Serialize)]
struct PhonemeTask { text: String, done: bool }
#[derive(serde::Serialize)]
struct PhonemeRec {
    status: String,
    title: String,
    summary: String,
    model: String,
    language: String,
    duration_ms: i64,
    confidence: Option<f64>,
    entities: Vec<PhonemeEntity>,
    tasks: Vec<PhonemeTask>,
}

/// Full recording row (status to poll + summary / entities / tasks / metadata).
#[tauri::command]
fn phoneme_recording(id: String) -> Result<PhonemeRec, String> {
    let out = run_phoneme(&["--json", "show", &id])?;
    let v: serde_json::Value = serde_json::from_str(out.trim()).map_err(err)?;
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
    let entities = v
        .get("entities")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .map(|e| PhonemeEntity {
                    kind: e.get("kind").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                    value: e.get("value").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                })
                .collect()
        })
        .unwrap_or_default();
    let tasks = v
        .get("tasks")
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .map(|t| PhonemeTask {
                    text: t.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                    done: t.get("done").and_then(|x| x.as_bool()).unwrap_or(false),
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(PhonemeRec {
        status: s("status"),
        title: s("title"),
        summary: s("summary"),
        model: s("model"),
        language: s("detected_language"),
        duration_ms: v.get("duration_ms").and_then(|x| x.as_i64()).unwrap_or(0),
        confidence: v.get("mean_confidence").and_then(|x| x.as_f64()),
        entities,
        tasks,
    })
}

#[derive(serde::Serialize)]
struct TranscriptVersion {
    idx: i64,
    label: String,
    model: String,
    text: String,
}

/// Every transcript in the compounding chain (raw ASR → each pipeline step → live)
/// for side-by-side comparison. Via the daemon pipe (the only surface that has it).
#[tauri::command]
fn phoneme_versions(id: String) -> Result<Vec<TranscriptVersion>, String> {
    let val = phoneme_ipc(serde_json::json!({ "type": "list_transcript_versions", "id": id }))?;
    let arr = val.as_array().cloned().unwrap_or_default();
    Ok(arr
        .iter()
        .map(|v| {
            let idx = v.get("idx").and_then(|x| x.as_i64()).unwrap_or(0);
            let label = v
                .get("label")
                .and_then(|x| x.as_str())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string())
                .unwrap_or_else(|| if idx == 0 { "Raw (ASR)".into() } else { format!("Step {idx}") });
            TranscriptVersion {
                idx,
                label,
                model: v.get("model").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                text: v.get("text").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            }
        })
        .collect())
}

/// Best-effort standalone transcript: fetch YouTube's own caption track via the
/// InnerTube player endpoint (no auth, no yt-dlp). Fragile by nature — many videos
/// have no captions, and YouTube changes this — so failures are normal; the UI then
/// points at Phoneme for reliable transcripts. Runs from Rust, so no webview CORS.
#[tauri::command]
async fn youtube_captions(video_id: String, lang: Option<String>) -> Result<Vec<Segment>, String> {
    let want = lang.unwrap_or_else(|| "en".into());
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(|e| e.to_string())?;
    let key = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // public WEB InnerTube key
    let body = serde_json::json!({
        "context": { "client": { "clientName": "WEB", "clientVersion": "2.20240101.00.00" } },
        "videoId": video_id,
    });
    let player: serde_json::Value = client
        .post(format!("https://www.youtube.com/youtubei/v1/player?key={key}"))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let tracks = player
        .pointer("/captions/playerCaptionsTracklistRenderer/captionTracks")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    if tracks.is_empty() {
        return Err("No captions available for this video".into());
    }
    let pick = tracks
        .iter()
        .find(|t| t.get("languageCode").and_then(|x| x.as_str()) == Some(want.as_str()))
        .or_else(|| tracks.first())
        .unwrap();
    let base = pick
        .get("baseUrl")
        .and_then(|x| x.as_str())
        .ok_or("Caption track has no URL")?;
    let cap: serde_json::Value = client
        .get(format!("{base}&fmt=json3"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    let mut segs = Vec::new();
    if let Some(events) = cap.get("events").and_then(|v| v.as_array()) {
        for ev in events {
            let start = ev.get("tStartMs").and_then(|x| x.as_i64()).unwrap_or(0);
            let dur = ev.get("dDurationMs").and_then(|x| x.as_i64()).unwrap_or(0);
            let text: String = ev
                .get("segs")
                .and_then(|s| s.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|s| s.get("utf8").and_then(|x| x.as_str()))
                        .collect::<String>()
                })
                .unwrap_or_default();
            let text = text.trim().to_string();
            if text.is_empty() {
                continue;
            }
            segs.push(Segment { start_ms: start, end_ms: start + dur, text, speaker: None });
        }
    }
    if segs.is_empty() {
        return Err("No caption text found".into());
    }
    Ok(segs)
}

/// Best-effort playlist import via InnerTube (no auth) — works for any public or
/// unlisted playlist. Private playlists (incl. Watch Later) need a logged-in
/// session and return empty here; use the Google-account path for those.
fn collect_playlist_videos(v: &serde_json::Value, out: &mut Vec<(String, String)>) {
    match v {
        serde_json::Value::Object(m) => {
            if let Some(r) = m.get("playlistVideoRenderer") {
                if let Some(id) = r.get("videoId").and_then(|x| x.as_str()) {
                    let title = r
                        .pointer("/title/runs/0/text")
                        .and_then(|x| x.as_str())
                        .or_else(|| r.pointer("/title/simpleText").and_then(|x| x.as_str()))
                        .unwrap_or("")
                        .to_string();
                    out.push((id.to_string(), title));
                    return;
                }
            }
            for val in m.values() {
                collect_playlist_videos(val, out);
            }
        }
        serde_json::Value::Array(a) => {
            for val in a {
                collect_playlist_videos(val, out);
            }
        }
        _ => {}
    }
}

#[tauri::command]
async fn import_youtube_playlist(db: State<'_, Db>, playlist_id: String) -> Result<usize, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .build()
        .map_err(err)?;
    let key = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8"; // public WEB InnerTube key
    let body = serde_json::json!({
        "context": { "client": { "clientName": "WEB", "clientVersion": "2.20240101.00.00" } },
        "browseId": format!("VL{playlist_id}"),
    });
    let v: serde_json::Value = client
        .post(format!("https://www.youtube.com/youtubei/v1/browse?key={key}"))
        .json(&body)
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    let mut vids = Vec::new();
    collect_playlist_videos(&v, &mut vids);
    if vids.is_empty() {
        return Err("No videos found — the playlist may be private, empty, or unavailable.".into());
    }
    db.import_playlist(&vids).await.map_err(err)
}

// ── Optional Google / YouTube account link (OAuth 2.0 installed-app flow) ──────
// The user supplies their own Google Cloud OAuth "Desktop app" client (id+secret)
// with the YouTube Data API enabled — see the in-app Settings help. We run the
// standard loopback flow: bind 127.0.0.1:<random>, open the consent page, capture
// the code, exchange it for tokens, and persist them in the app data dir. Watch
// Later / History are NOT exposed by the API; only real playlists are.

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct GoogleTokens {
    access_token: String,
    refresh_token: String,
    expires_at: i64,
}

#[derive(serde::Serialize)]
struct GPlaylist {
    id: String,
    title: String,
    count: i64,
}

/// The app's compiled-in default OAuth client (from build.rs / .env). Empty if
/// the build had no creds, in which case users must supply their own.
fn default_google() -> (&'static str, &'static str) {
    (
        option_env!("YTNT_GOOGLE_CLIENT_ID").unwrap_or(""),
        option_env!("YTNT_GOOGLE_CLIENT_SECRET").unwrap_or(""),
    )
}

/// Use the caller's creds if given, else fall back to the compiled-in defaults.
fn resolve_creds(id: String, secret: String) -> Result<(String, String), String> {
    let (did, dsec) = default_google();
    let id = if id.trim().is_empty() { did.to_string() } else { id };
    let secret = if secret.trim().is_empty() { dsec.to_string() } else { secret };
    if id.is_empty() || secret.is_empty() {
        return Err("No Google credentials — connect with the built-in client or add your own in Settings.".into());
    }
    Ok((id, secret))
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
fn tokens_path(app: &AppHandle) -> std::path::PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    dir.join("google_tokens.json")
}
fn load_tokens(app: &AppHandle) -> Option<GoogleTokens> {
    std::fs::read_to_string(tokens_path(app)).ok().and_then(|s| serde_json::from_str(&s).ok())
}
fn save_tokens(app: &AppHandle, t: &GoogleTokens) -> Result<(), String> {
    let p = tokens_path(app);
    if let Some(d) = p.parent() {
        std::fs::create_dir_all(d).ok();
    }
    std::fs::write(p, serde_json::to_string(t).map_err(err)?).map_err(err)
}

/// Block until the OAuth redirect hits our loopback listener, then return the code.
fn wait_for_code(listener: TcpListener) -> Result<String, String> {
    let (mut stream, _) = listener.accept().map_err(err)?;
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).map_err(err)?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let path = req.lines().next().and_then(|l| l.split_whitespace().nth(1)).unwrap_or("");
    let body = "<!doctype html><meta charset=utf-8><body style=\"font-family:system-ui;background:#11111b;color:#cdd6f4;text-align:center;padding-top:64px\"><h2 style=\"color:#a6e3a1\">Connected \u{2713}</h2><p>You can close this tab and return to youtube-note-thing.</p>";
    let resp = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(), body
    );
    let _ = stream.write_all(resp.as_bytes());
    let full = format!("http://localhost{path}");
    let parsed = url::Url::parse(&full).map_err(err)?;
    parsed
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.into_owned())
        .ok_or_else(|| "No authorization code in the redirect (consent denied?)".into())
}

async fn exchange_code(cid: &str, secret: &str, code: &str, redirect: &str) -> Result<GoogleTokens, String> {
    let res: serde_json::Value = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code),
            ("client_id", cid),
            ("client_secret", secret),
            ("redirect_uri", redirect),
            ("grant_type", "authorization_code"),
        ])
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    let access = res.get("access_token").and_then(|x| x.as_str())
        .ok_or_else(|| format!("Token exchange failed: {}", res.get("error_description").or_else(|| res.get("error")).and_then(|x| x.as_str()).unwrap_or("unknown")))?
        .to_string();
    let refresh = res.get("refresh_token").and_then(|x| x.as_str()).unwrap_or("").to_string();
    let expires_in = res.get("expires_in").and_then(|x| x.as_i64()).unwrap_or(3600);
    Ok(GoogleTokens { access_token: access, refresh_token: refresh, expires_at: now_secs() + expires_in })
}

/// A non-expired access token, refreshing via the stored refresh token if needed.
async fn valid_access_token(app: &AppHandle, cid: &str, secret: &str) -> Result<String, String> {
    let mut t = load_tokens(app).ok_or("Not connected to a Google account")?;
    if t.expires_at > now_secs() + 60 && !t.access_token.is_empty() {
        return Ok(t.access_token);
    }
    if t.refresh_token.is_empty() {
        return Err("Session expired — reconnect your Google account".into());
    }
    let (cid, secret) = resolve_creds(cid.to_string(), secret.to_string())?;
    let res: serde_json::Value = reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", cid.as_str()),
            ("client_secret", secret.as_str()),
            ("refresh_token", t.refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    let access = res.get("access_token").and_then(|x| x.as_str())
        .ok_or("Token refresh failed — reconnect your Google account")?
        .to_string();
    let expires_in = res.get("expires_in").and_then(|x| x.as_i64()).unwrap_or(3600);
    t.access_token = access.clone();
    t.expires_at = now_secs() + expires_in;
    save_tokens(app, &t)?;
    Ok(access)
}

#[tauri::command]
fn google_status(app: AppHandle) -> bool {
    load_tokens(&app).map(|t| !t.refresh_token.is_empty()).unwrap_or(false)
}

#[tauri::command]
fn google_has_default() -> bool {
    let (id, secret) = default_google();
    !id.is_empty() && !secret.is_empty()
}

#[tauri::command]
fn google_logout(app: AppHandle) -> Result<(), String> {
    let p = tokens_path(&app);
    if p.exists() {
        std::fs::remove_file(p).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
async fn google_connect(app: AppHandle, client_id: String, client_secret: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let (client_id, client_secret) = resolve_creds(client_id, client_secret)?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(err)?;
    let port = listener.local_addr().map_err(err)?.port();
    let redirect = format!("http://127.0.0.1:{port}");
    let mut auth = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth").map_err(err)?;
    auth.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent")
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect)
        .append_pair("scope", "https://www.googleapis.com/auth/youtube");
    app.opener().open_url(auth.to_string(), None::<&str>).map_err(err)?;
    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener))
        .await
        .map_err(err)??;
    let tokens = exchange_code(&client_id, &client_secret, &code, &redirect).await?;
    if tokens.refresh_token.is_empty() {
        return Err("Google did not return a refresh token. Remove this app from your Google account's third-party access and try again.".into());
    }
    save_tokens(&app, &tokens)
}

#[tauri::command]
async fn google_playlists(app: AppHandle, client_id: String, client_secret: String) -> Result<Vec<GPlaylist>, String> {
    let token = valid_access_token(&app, &client_id, &client_secret).await?;
    let res: serde_json::Value = reqwest::Client::new()
        .get("https://www.googleapis.com/youtube/v3/playlists")
        .query(&[("part", "snippet,contentDetails"), ("mine", "true"), ("maxResults", "50")])
        .bearer_auth(&token)
        .send()
        .await
        .map_err(err)?
        .json()
        .await
        .map_err(err)?;
    let mut out = Vec::new();
    if let Some(items) = res.get("items").and_then(|x| x.as_array()) {
        for it in items {
            let id = it.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }
            out.push(GPlaylist {
                id,
                title: it.pointer("/snippet/title").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                count: it.pointer("/contentDetails/itemCount").and_then(|x| x.as_i64()).unwrap_or(0),
            });
        }
    } else if let Some(e) = res.pointer("/error/message").and_then(|x| x.as_str()) {
        return Err(e.to_string());
    }
    Ok(out)
}

#[tauri::command]
async fn import_google_playlist(
    app: AppHandle,
    db: State<'_, Db>,
    client_id: String,
    client_secret: String,
    playlist_id: String,
) -> Result<usize, String> {
    let token = valid_access_token(&app, &client_id, &client_secret).await?;
    let client = reqwest::Client::new();
    let mut vids: Vec<(String, String)> = Vec::new();
    let mut page = String::new();
    loop {
        let mut q = vec![
            ("part", "snippet"),
            ("playlistId", playlist_id.as_str()),
            ("maxResults", "50"),
        ];
        if !page.is_empty() {
            q.push(("pageToken", page.as_str()));
        }
        let res: serde_json::Value = client
            .get("https://www.googleapis.com/youtube/v3/playlistItems")
            .query(&q)
            .bearer_auth(&token)
            .send()
            .await
            .map_err(err)?
            .json()
            .await
            .map_err(err)?;
        if let Some(items) = res.get("items").and_then(|x| x.as_array()) {
            for it in items {
                let vid = it.pointer("/snippet/resourceId/videoId").and_then(|x| x.as_str()).unwrap_or("");
                if !vid.is_empty() {
                    let title = it.pointer("/snippet/title").and_then(|x| x.as_str()).unwrap_or("");
                    vids.push((vid.to_string(), title.to_string()));
                }
            }
        }
        match res.get("nextPageToken").and_then(|x| x.as_str()) {
            Some(t) => page = t.to_string(),
            None => break,
        }
    }
    db.import_playlist(&vids).await.map_err(err)
}

/// Sync one playlist's contents into the local cache (so it can be browsed, and so
/// a delete knows the playlistItem id), and return them with an `in_library` flag.
#[tauri::command]
async fn google_sync_playlist(
    app: AppHandle,
    db: State<'_, Db>,
    client_id: String,
    client_secret: String,
    playlist_id: String,
    playlist_title: String,
) -> Result<Vec<PlaylistItem>, String> {
    let token = valid_access_token(&app, &client_id, &client_secret).await?;
    let client = reqwest::Client::new();
    let mut items: Vec<(String, String, String, i64)> = Vec::new();
    let mut page = String::new();
    loop {
        let mut q = vec![
            ("part", "snippet"),
            ("playlistId", playlist_id.as_str()),
            ("maxResults", "50"),
        ];
        if !page.is_empty() {
            q.push(("pageToken", page.as_str()));
        }
        let res: serde_json::Value = client
            .get("https://www.googleapis.com/youtube/v3/playlistItems")
            .query(&q)
            .bearer_auth(&token)
            .send().await.map_err(err)?
            .json().await.map_err(err)?;
        if let Some(arr) = res.get("items").and_then(|x| x.as_array()) {
            for it in arr {
                let vid = it.pointer("/snippet/resourceId/videoId").and_then(|x| x.as_str()).unwrap_or("");
                if vid.is_empty() {
                    continue;
                }
                let item_id = it.get("id").and_then(|x| x.as_str()).unwrap_or("");
                let title = it.pointer("/snippet/title").and_then(|x| x.as_str()).unwrap_or("");
                let pos = it.pointer("/snippet/position").and_then(|x| x.as_i64()).unwrap_or(items.len() as i64);
                items.push((vid.to_string(), item_id.to_string(), title.to_string(), pos));
            }
        } else if let Some(e) = res.pointer("/error/message").and_then(|x| x.as_str()) {
            return Err(e.to_string());
        }
        match res.get("nextPageToken").and_then(|x| x.as_str()) {
            Some(t) => page = t.to_string(),
            None => break,
        }
    }
    db.sync_playlist(&playlist_id, &playlist_title, &items).await.map_err(err)?;
    db.playlist_items(&playlist_id).await.map_err(err)
}

/// Remove one entry from the real YouTube playlist (needs the full youtube scope),
/// then drop it from the local cache.
#[tauri::command]
async fn google_remove_playlist_item(
    app: AppHandle,
    db: State<'_, Db>,
    client_id: String,
    client_secret: String,
    playlist_id: String,
    video_id: String,
    item_id: String,
) -> Result<(), String> {
    let token = valid_access_token(&app, &client_id, &client_secret).await?;
    let res = reqwest::Client::new()
        .delete("https://www.googleapis.com/youtube/v3/playlistItems")
        .query(&[("id", item_id.as_str())])
        .bearer_auth(&token)
        .send()
        .await
        .map_err(err)?;
    if !res.status().is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Couldn't remove from playlist (need write access?): {body}"));
    }
    db.delete_playlist_item(&playlist_id, &video_id).await.map_err(err)
}

/// Which synced playlists a video is in (with the item id needed to remove it).
#[tauri::command]
async fn video_playlists(db: State<'_, Db>, video_id: String) -> Result<Vec<PlaylistRef>, String> {
    db.video_playlists(&video_id).await.map_err(err)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
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
            set_pinned,
            set_video_tags,
            set_ext_ref,
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
            phoneme_available,
            phoneme_probe,
            phoneme_import,
            phoneme_segments,
            phoneme_chapters,
            phoneme_search,
            phoneme_recording,
            phoneme_versions,
            youtube_captions,
            import_youtube_playlist,
            google_status,
            google_has_default,
            google_logout,
            google_connect,
            google_playlists,
            import_google_playlist,
            google_sync_playlist,
            google_remove_playlist_item,
            video_playlists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_phoneme_version_line() {
        assert_eq!(parse_phoneme_version("phoneme 1.8.1"), Some((1, 8)));
        assert_eq!(parse_phoneme_version("1.10.0"), Some((1, 10)));
        assert_eq!(parse_phoneme_version("phoneme 2.0"), Some((2, 0)));
        assert_eq!(parse_phoneme_version(""), None);
        assert_eq!(parse_phoneme_version("phoneme dev"), None);
    }

    #[test]
    fn min_version_gate() {
        let ge = |v: &str| {
            parse_phoneme_version(v)
                .map(|x| x >= MIN_PHONEME_VERSION)
                .unwrap_or(true)
        };
        assert!(ge("phoneme 1.8.0"));
        assert!(ge("phoneme 1.9.2"));
        assert!(ge("phoneme 2.0.0"));
        assert!(!ge("phoneme 1.7.9"));
        assert!(!ge("phoneme 0.9.0"));
        // Unknown version → treated as compatible (don't lock the user out).
        assert!(ge("phoneme dev"));
    }

    #[test]
    fn json_lines_parses_skips_and_flags_total_failure() {
        // Mixed: one good, one junk → keep the good, no error.
        let good_and_bad = "{\"start_ms\":0,\"end_ms\":1,\"text\":\"hi\"}\nnot json\n";
        let segs: Vec<Segment> = parse_json_lines(good_and_bad, "segments").unwrap();
        assert_eq!(segs.len(), 1);

        // Genuinely empty output → empty Vec, OK (nothing transcribed yet).
        let empty: Vec<Segment> = parse_json_lines("\n  \n", "segments").unwrap();
        assert!(empty.is_empty());

        // Output present but nothing parsed → error (contract drift).
        let all_bad = parse_json_lines::<Segment>("garbage\nmore garbage\n", "segments");
        assert!(all_bad.is_err());
    }
}

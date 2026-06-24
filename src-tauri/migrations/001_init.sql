-- youtube-note-thing schema. Three tables; see plans/ARCHITECTURE.md.
CREATE TABLE videos (
    id            TEXT PRIMARY KEY,           -- YouTube video id
    title         TEXT NOT NULL DEFAULT '',
    channel       TEXT,
    url           TEXT NOT NULL,
    duration      INTEGER,
    added_at      TEXT NOT NULL DEFAULT (datetime('now')),
    last_pos_secs REAL NOT NULL DEFAULT 0,    -- resume where you left off
    manual_order  INTEGER NOT NULL DEFAULT 0  -- 0 = sort notes by time, 1 = manual order_index
);

CREATE TABLE notes (
    id          TEXT PRIMARY KEY,             -- uuid
    video_id    TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    t_secs      REAL NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notes_video ON notes(video_id, t_secs);

CREATE VIRTUAL TABLE notes_fts USING fts5(content, content='notes', content_rowid='rowid');
CREATE TRIGGER notes_ai AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER notes_ad AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;
CREATE TRIGGER notes_au AFTER UPDATE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;

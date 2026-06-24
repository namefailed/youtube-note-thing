-- Cached contents of a YouTube playlist (synced from the Data API). Lets a
-- playlist act as a browse/filter view independent of the library, and remembers
-- the playlistItem id so a delete can also remove the entry from the real
-- playlist. A video may appear in several playlists.
CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id    TEXT NOT NULL,
  playlist_title TEXT NOT NULL DEFAULT '',
  video_id       TEXT NOT NULL,
  item_id        TEXT NOT NULL DEFAULT '',
  title          TEXT NOT NULL DEFAULT '',
  position       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (playlist_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_items_video ON playlist_items(video_id);

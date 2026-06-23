-- Per-video tags, stored as a JSON array of strings on the video row.
ALTER TABLE videos ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';

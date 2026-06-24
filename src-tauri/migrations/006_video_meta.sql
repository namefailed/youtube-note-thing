-- Library-card metadata pulled from the YouTube Data API (videos.list).
-- channel + duration already exist (001); add the view counter and publish date.
ALTER TABLE videos ADD COLUMN view_count INTEGER;
ALTER TABLE videos ADD COLUMN published_at TEXT;

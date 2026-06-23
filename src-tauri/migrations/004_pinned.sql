-- Pin/favorite videos so they sort to the top of the library.
ALTER TABLE videos ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

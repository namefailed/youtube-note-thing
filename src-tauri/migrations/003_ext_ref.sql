-- Link a video to an external integration record (e.g. a Phoneme recording id).
ALTER TABLE videos ADD COLUMN ext_ref TEXT;

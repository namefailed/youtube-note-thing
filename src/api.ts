import { invoke } from "@tauri-apps/api/core";

export interface VideoWithCount {
  id: string; title: string; channel: string | null; url: string;
  duration: number | null; last_pos_secs: number; manual_order: boolean; note_count: number; tags: string[];
}
export interface Video {
  id: string; title: string; channel: string | null; url: string;
  duration: number | null; last_pos_secs: number; manual_order: boolean; tags: string[];
}
export interface Note {
  id: string; video_id: string; t_secs: number; content: string; order_index: number;
}
export interface SearchHit {
  note_id: string; video_id: string; video_title: string; t_secs: number; content: string;
}
export interface Segment { start_ms: number; end_ms: number; text: string; speaker: string | null; }

// Tauri maps camelCase JS keys to snake_case Rust params automatically.
export const api = {
  listVideos: () => invoke<VideoWithCount[]>("list_videos"),
  upsertVideo: (id: string, url: string) => invoke<Video>("upsert_video", { id, url }),
  setVideoTitle: (id: string, title: string) => invoke<void>("set_video_title", { id, title }),
  setLastPos: (id: string, secs: number) => invoke<void>("set_last_pos", { id, secs }),
  setVideoTags: (id: string, tags: string[]) => invoke<void>("set_video_tags", { id, tags }),
  deleteVideo: (id: string) => invoke<void>("delete_video", { id }),
  listNotes: (videoId: string) => invoke<Note[]>("list_notes", { videoId }),
  createNote: (videoId: string, tSecs: number, content: string) =>
    invoke<Note>("create_note", { videoId, tSecs, content }),
  updateNote: (id: string, content: string) => invoke<void>("update_note", { id, content }),
  deleteNote: (id: string) => invoke<void>("delete_note", { id }),
  reorderNotes: (videoId: string, orderedIds: string[]) =>
    invoke<void>("reorder_notes", { videoId, orderedIds }),
  resetOrder: (videoId: string) => invoke<void>("reset_order", { videoId }),
  searchNotes: (query: string) => invoke<SearchHit[]>("search_notes", { query }),
  exportJson: () => invoke<string>("export_json"),
  importJson: (json: string) => invoke<void>("import_json", { json }),
  saveMarkdown: (dir: string, name: string, content: string) =>
    invoke<string>("save_markdown", { dir, name, content }),
  phonemeAvailable: () => invoke<boolean>("phoneme_available"),
  phonemeImport: (url: string) => invoke<string>("phoneme_import", { url }),
  phonemeSegments: (id: string) => invoke<Segment[]>("phoneme_segments", { id }),
  youtubeCaptions: (videoId: string, lang?: string) =>
    invoke<Segment[]>("youtube_captions", { videoId, lang: lang ?? null }),
};

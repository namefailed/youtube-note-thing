import { invoke } from "@tauri-apps/api/core";

export interface VideoWithCount {
  id: string; title: string; channel: string | null; url: string;
  duration: number | null; last_pos_secs: number; manual_order: boolean; note_count: number; tags: string[];
  ext_ref: string | null; pinned: boolean;
}
export interface Video {
  id: string; title: string; channel: string | null; url: string;
  duration: number | null; last_pos_secs: number; manual_order: boolean; tags: string[]; ext_ref: string | null;
}
export interface Note {
  id: string; video_id: string; t_secs: number; content: string; order_index: number;
}
export interface SearchHit {
  note_id: string; video_id: string; video_title: string; t_secs: number; content: string;
}
export interface Segment { start_ms: number; end_ms: number; text: string; speaker: string | null; }
export interface Chapter { start_ms: number; end_ms: number; title: string; summary: string | null; }
export interface PhonemeHit { id: string; title: string; snippet: string; }
export interface PhonemeRec { status: string; title: string; summary: string; model: string; language: string; duration_ms: number; confidence: number | null; entities: { kind: string; value: string }[]; tasks: { text: string; done: boolean }[]; }
export interface TranscriptVersion { idx: number; label: string; model: string; text: string; }
export interface PhonemeProbe { present: boolean; daemon_ok: boolean; version: string; compatible: boolean; }
export interface GPlaylist { id: string; title: string; count: number; }
export interface PlaylistItem { video_id: string; item_id: string; title: string; position: number; in_library: boolean; }
export interface PlaylistRef { playlist_id: string; playlist_title: string; item_id: string; }

// Tauri maps camelCase JS keys to snake_case Rust params automatically.
export const api = {
  listVideos: () => invoke<VideoWithCount[]>("list_videos"),
  upsertVideo: (id: string, url: string) => invoke<Video>("upsert_video", { id, url }),
  setVideoTitle: (id: string, title: string) => invoke<void>("set_video_title", { id, title }),
  setLastPos: (id: string, secs: number) => invoke<void>("set_last_pos", { id, secs }),
  setPinned: (id: string, pinned: boolean) => invoke<void>("set_pinned", { id, pinned }),
  setVideoTags: (id: string, tags: string[]) => invoke<void>("set_video_tags", { id, tags }),
  setExtRef: (id: string, extRef: string | null) => invoke<void>("set_ext_ref", { id, extRef }),
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
  phonemeProbe: () => invoke<PhonemeProbe>("phoneme_probe"),
  phonemeImport: (url: string) => invoke<string>("phoneme_import", { url }),
  phonemeSegments: (id: string) => invoke<Segment[]>("phoneme_segments", { id }),
  phonemeChapters: (id: string) => invoke<Chapter[]>("phoneme_chapters", { id }),
  phonemeSearch: (query: string) => invoke<PhonemeHit[]>("phoneme_search", { query }),
  youtubeCaptions: (videoId: string, lang?: string) =>
    invoke<Segment[]>("youtube_captions", { videoId, lang: lang ?? null }),
  phonemeRecording: (id: string) => invoke<PhonemeRec>("phoneme_recording", { id }),
  phonemeVersions: (id: string) => invoke<TranscriptVersion[]>("phoneme_versions", { id }),
  phonemeSseStart: () => invoke<void>("phoneme_sse_start"),
  phonemeSseStop: () => invoke<void>("phoneme_sse_stop"),
  importYoutubePlaylist: (playlistId: string) =>
    invoke<number>("import_youtube_playlist", { playlistId }),
  googleStatus: () => invoke<boolean>("google_status"),
  googleHasDefault: () => invoke<boolean>("google_has_default"),
  googleConnect: (clientId: string, clientSecret: string) =>
    invoke<void>("google_connect", { clientId, clientSecret }),
  googleLogout: () => invoke<void>("google_logout"),
  googlePlaylists: (clientId: string, clientSecret: string) =>
    invoke<GPlaylist[]>("google_playlists", { clientId, clientSecret }),
  importGooglePlaylist: (clientId: string, clientSecret: string, playlistId: string) =>
    invoke<number>("import_google_playlist", { clientId, clientSecret, playlistId }),
  googleSyncPlaylist: (clientId: string, clientSecret: string, playlistId: string, playlistTitle: string) =>
    invoke<PlaylistItem[]>("google_sync_playlist", { clientId, clientSecret, playlistId, playlistTitle }),
  googleRemovePlaylistItem: (clientId: string, clientSecret: string, playlistId: string, videoId: string, itemId: string) =>
    invoke<void>("google_remove_playlist_item", { clientId, clientSecret, playlistId, videoId, itemId }),
  videoPlaylists: (videoId: string) => invoke<PlaylistRef[]>("video_playlists", { videoId }),
};

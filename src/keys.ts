// ── Rebindable keyboard actions (the structural nav keys — hjkl, g-chords, Esc,
// Tab — are deliberately NOT here; they ARE the navigation model). A binding is a
// normalized chord string from normChord(): e.g. "ctrl+n", "space", "arrowleft",
// "shift+arrowright", ">". Each action can have several default chords.
export type KeyAction =
  | "playPause" | "back10" | "fwd10" | "back5" | "fwd5" | "back30" | "fwd30"
  | "speedUp" | "speedDown" | "mute" | "fullscreen"
  | "capture" | "search" | "cheat" | "sidebar"
  | "noteUp" | "noteDown" | "noteEdit" | "noteDelete";
export type Keymap = Record<KeyAction, string[]>;
export const KEY_ACTIONS: { id: KeyAction; label: string; group: "Playback" | "Notes" | "App" }[] = [
  { id: "playPause", label: "Play / pause", group: "Playback" },
  { id: "back10", label: "Back 10 seconds", group: "Playback" },
  { id: "fwd10", label: "Forward 10 seconds", group: "Playback" },
  { id: "back5", label: "Back 5 seconds", group: "Playback" },
  { id: "fwd5", label: "Forward 5 seconds", group: "Playback" },
  { id: "back30", label: "Back 30 seconds", group: "Playback" },
  { id: "fwd30", label: "Forward 30 seconds", group: "Playback" },
  { id: "speedUp", label: "Speed up", group: "Playback" },
  { id: "speedDown", label: "Slow down", group: "Playback" },
  { id: "mute", label: "Mute / unmute", group: "Playback" },
  { id: "fullscreen", label: "Fullscreen", group: "Playback" },
  { id: "capture", label: "Add note", group: "App" },
  { id: "search", label: "Search", group: "App" },
  { id: "cheat", label: "Cheat sheet", group: "App" },
  { id: "sidebar", label: "Toggle sidebar", group: "App" },
  { id: "noteUp", label: "Previous note", group: "Notes" },
  { id: "noteDown", label: "Next note", group: "Notes" },
  { id: "noteEdit", label: "Edit selected note", group: "Notes" },
  { id: "noteDelete", label: "Delete selected note", group: "Notes" },
];
export const KEYMAP_PRESETS: Record<string, Keymap> = {
  default: {
    playPause: ["space", "k"], back10: ["j"], fwd10: ["l"], back5: ["arrowleft"], fwd5: ["arrowright"],
    back30: ["shift+arrowleft"], fwd30: ["shift+arrowright"], speedUp: ["+", "="], speedDown: ["-", "_"],
    mute: ["m"], fullscreen: ["f"], capture: ["ctrl+n"], search: ["/"], cheat: ["?"], sidebar: ["ctrl+b"],
    noteUp: ["arrowup"], noteDown: ["arrowdown"], noteEdit: ["enter"], noteDelete: ["delete"],
  },
  youtube: {
    playPause: ["k", "space"], back10: ["j"], fwd10: ["l"], back5: ["arrowleft"], fwd5: ["arrowright"],
    back30: ["shift+arrowleft"], fwd30: ["shift+arrowright"], speedUp: [">"], speedDown: ["<"],
    mute: ["m"], fullscreen: ["f"], capture: ["ctrl+n"], search: ["/"], cheat: ["?"], sidebar: ["ctrl+b"],
    noteUp: ["arrowup"], noteDown: ["arrowdown"], noteEdit: ["enter"], noteDelete: ["delete"],
  },
  vim: {
    playPause: ["space"], back10: ["b"], fwd10: ["w"], back5: ["h"], fwd5: ["l"],
    back30: ["shift+h"], fwd30: ["shift+l"], speedUp: ["+", "="], speedDown: ["-", "_"],
    mute: ["m"], fullscreen: ["f"], capture: ["ctrl+n"], search: ["/"], cheat: ["?"], sidebar: ["ctrl+b"],
    noteUp: ["k"], noteDown: ["j"], noteEdit: ["enter"], noteDelete: ["delete"],
  },
};
// escape/tab/g are the structural nav keys; 0–9 are the fixed decile-seek keys
// (Settings and the cheat sheet advertise them as unbindable), so none may be rebound.
export const RESERVED_CHORDS = new Set(["escape", "tab", "g", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
/** Normalize a keydown into a stable chord string. Shift is only encoded for named
 *  keys (Arrow*, Enter…); for printable chars the character already reflects shift. */
export function normChord(e: KeyboardEvent): string {
  let k = e.key;
  if (k === " ") k = "space";
  const named = k.length > 1;
  k = k.toLowerCase();
  const mod = (e.ctrlKey || e.metaKey ? "ctrl+" : "") + (e.altKey ? "alt+" : "") + (e.shiftKey && named ? "shift+" : "");
  return mod + k;
}
/** Pretty-print a chord for the UI: "ctrl+n" → "Ctrl+N", "arrowleft" → "←", "+" → "+". */
export function chordLabel(c: string): string {
  const map: Record<string, string> = { ctrl: "Ctrl", shift: "Shift", alt: "Alt", space: "Space", arrowleft: "←", arrowright: "→", arrowup: "↑", arrowdown: "↓", enter: "↵", delete: "Del" };
  const parts = c.split("+");
  // "+" is both the separator and a literal key: a trailing empty segment is the "+" key.
  if (parts.length > 1 && parts[parts.length - 1] === "") { parts.pop(); parts[parts.length - 1] = "+"; }
  return parts
    .filter((p) => p !== "")
    .map((p) => map[p] ?? (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join("+");
}
export function actionLabel(id: KeyAction): string { return KEY_ACTIONS.find((a) => a.id === id)?.label ?? id; }
/** Resolve the active keymap: per-action overrides win, falling back to the named
 *  preset (unknown preset → default). Pure so the merge is testable. */
export function resolveKeymap(preset: string, overrides?: Partial<Keymap> | null): Keymap {
  const base = KEYMAP_PRESETS[preset] ?? KEYMAP_PRESETS.default;
  const ov = overrides || {};
  const out = {} as Keymap;
  for (const a of KEY_ACTIONS) out[a.id] = ov[a.id] ?? base[a.id];
  return out;
}
/** Build the chord→action reverse lookup for a resolved keymap. */
export function reverseKeymap(km: Keymap): Record<string, KeyAction> {
  const rev: Record<string, KeyAction> = {};
  for (const a of KEY_ACTIONS) for (const c of km[a.id]) rev[c] = a.id;
  return rev;
}

import { describe, it, expect } from "vitest";
import { chordLabel, normChord, reverseKeymap, resolveKeymap, KEY_ACTIONS, KEYMAP_PRESETS, type KeyAction, type Keymap } from "./keys";

// vitest runs in node with no KeyboardEvent constructor, so fake the shape.
const kev = (o: Partial<KeyboardEvent> & { key: string }): KeyboardEvent =>
  ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...o } as unknown as KeyboardEvent);

describe("chordLabel", () => {
  it("renders the literal '+' key without throwing (Settings crash regression)", () => {
    expect(() => chordLabel("+")).not.toThrow();
    expect(chordLabel("+")).toBe("+");
  });
  it("renders ctrl chord on the '+' key (cheat-sheet crash regression)", () => {
    expect(() => chordLabel("ctrl++")).not.toThrow();
    expect(chordLabel("ctrl++")).toBe("Ctrl++");
  });
  it("passes through other literal punctuation keys", () => {
    expect(chordLabel("=")).toBe("=");
    expect(chordLabel("-")).toBe("-");
  });
  it("uppercases and joins modifier chords", () => {
    expect(chordLabel("ctrl+n")).toBe("Ctrl+N");
    expect(chordLabel("shift+arrowleft")).toBe("Shift+←");
  });
  it("maps named keys to symbols/labels", () => {
    expect(chordLabel("space")).toBe("Space");
    expect(chordLabel("arrowup")).toBe("↑");
  });
  it("returns empty string for empty input", () => {
    expect(chordLabel("")).toBe("");
  });
});

describe("normChord", () => {
  it("keeps the literal '+' key", () => {
    expect(normChord(kev({ key: "+" }))).toBe("+");
  });
  it("names the space key", () => {
    expect(normChord(kev({ key: " " }))).toBe("space");
  });
  it("lowercases printable letters (shift not encoded for printables)", () => {
    expect(normChord(kev({ key: "k" }))).toBe("k");
    expect(normChord(kev({ key: "K", shiftKey: true }))).toBe("k");
  });
  it("encodes ctrl for named/printable alike", () => {
    expect(normChord(kev({ key: "n", ctrlKey: true }))).toBe("ctrl+n");
  });
  it("encodes shift only for named keys", () => {
    expect(normChord(kev({ key: "ArrowLeft", shiftKey: true }))).toBe("shift+arrowleft");
    expect(normChord(kev({ key: ">", shiftKey: true }))).toBe(">");
  });
  it("keeps the literal '=' key", () => {
    expect(normChord(kev({ key: "=" }))).toBe("=");
  });
});

describe("reverseKeymap", () => {
  const rev = reverseKeymap(KEYMAP_PRESETS.default);
  it("maps default chords back to their actions", () => {
    expect(rev.space).toBe("playPause");
    expect(rev["ctrl+n"]).toBe("capture");
    expect(rev["+"]).toBe("speedUp");
    expect(rev.arrowdown).toBe("noteDown");
  });

  const noCollisions = (km: Keymap) => {
    const seen = new Set<string>();
    for (const a of KEY_ACTIONS) {
      for (const c of km[a.id]) {
        expect(seen.has(c), `chord "${c}" is bound twice`).toBe(false);
        seen.add(c);
      }
    }
  };
  it("has no chord bound to two actions within any preset", () => {
    for (const name of Object.keys(KEYMAP_PRESETS)) noCollisions(KEYMAP_PRESETS[name]);
  });
  it("round-trips every chord of every preset consistently", () => {
    for (const name of Object.keys(KEYMAP_PRESETS)) {
      const km = KEYMAP_PRESETS[name];
      const r = reverseKeymap(km);
      for (const a of KEY_ACTIONS) {
        for (const c of km[a.id]) expect(r[c]).toBe(a.id as KeyAction);
      }
    }
  });
});

describe("resolveKeymap (preset + overrides merge)", () => {
  it("with no overrides returns the named preset verbatim", () => {
    expect(resolveKeymap("vim")).toEqual(KEYMAP_PRESETS.vim);
    expect(resolveKeymap("youtube", null)).toEqual(KEYMAP_PRESETS.youtube);
  });
  it("falls back to default for an unknown preset name", () => {
    expect(resolveKeymap("does-not-exist")).toEqual(KEYMAP_PRESETS.default);
    expect(resolveKeymap("")).toEqual(KEYMAP_PRESETS.default);
  });
  it("an override replaces just that action's chords, leaving the rest of the preset", () => {
    const km = resolveKeymap("default", { playPause: ["p"] });
    expect(km.playPause).toEqual(["p"]);          // override wins
    expect(km.mute).toEqual(KEYMAP_PRESETS.default.mute); // untouched
  });
  it("a colliding override deterministically last-wins in the reverse map (dead-shortcut guard)", () => {
    // Bind capture to "m", which the default preset already gives to mute. The
    // merge does NOT strip mute's "m", so reverseKeymap resolves "m" last-wins.
    const km = resolveKeymap("default", { capture: ["m"] });
    const rev = reverseKeymap(km);
    // KEY_ACTIONS lists mute before capture, so capture (later) claims "m".
    expect(rev.m).toBe("capture");
    // mute now has no live chord reachable via the reverse map — the collision
    // silently shadows it (the behavior this test pins so a regression is caught).
    expect(Object.values(rev)).not.toContain("mute" as KeyAction);
  });
});

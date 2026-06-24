import { describe, it, expect } from "vitest";
import { parseVideoId, parsePlaylistId, parseRef, serializeRef, formatTime, applyOffset, tsLink, notesToMarkdown, safeTagColor, tagInk, mergeTagSets, formatViews, relativeDate } from "./lib";

const sorted = (a: string[]) => [...a].sort();

const ID = "dQw4w9WgXcQ";

describe("tag colors", () => {
  it("only lets a real hex through, else falls back", () => {
    expect(safeTagColor("#cba6f7")).toBe("#cba6f7");
    expect(safeTagColor("#abc")).toBe("#abc");
    expect(safeTagColor("red; background:url(x)")).toBe("var(--accent)");
    expect(safeTagColor(null, "#000")).toBe("#000");
  });
  it("picks dark ink on light tags and white on dark", () => {
    expect(tagInk("#ffffff")).toBe("#11111b");
    expect(tagInk("#000000")).toBe("#ffffff");
    expect(tagInk("#cba6f7")).toBe("#11111b"); // mauve is light
    expect(tagInk("notahex")).toBe("");
  });
});

describe("formatViews", () => {
  it("compacts counts with K/M/B and pluralizes", () => {
    expect(formatViews(0)).toBe("0 views");
    expect(formatViews(1)).toBe("1 view");
    expect(formatViews(999)).toBe("999 views");
    expect(formatViews(1500)).toBe("1.5K views");
    expect(formatViews(2_000_000)).toBe("2M views");
    expect(formatViews(1_200_000)).toBe("1.2M views");
    expect(formatViews(3_400_000_000)).toBe("3.4B views");
  });
});

describe("relativeDate", () => {
  const now = Date.parse("2026-06-24T00:00:00Z");
  it("buckets into today/days/months/years", () => {
    expect(relativeDate("2026-06-24T00:00:00Z", now)).toBe("today");
    expect(relativeDate("2026-06-23T00:00:00Z", now)).toBe("yesterday");
    expect(relativeDate("2026-06-10T00:00:00Z", now)).toBe("14 days ago");
    expect(relativeDate("2026-04-24T00:00:00Z", now)).toBe("2 months ago");
    expect(relativeDate("2023-06-24T00:00:00Z", now)).toBe("3 years ago");
    expect(relativeDate("nonsense", now)).toBe("");
  });
});

describe("mergeTagSets (bidirectional tag sync)", () => {
  it("first sync (no base) unions both sides, deletes nothing", () => {
    const m = mergeTagSets(null, ["a", "b"], ["b", "c"]);
    expect(sorted(m.merged)).toEqual(["a", "b", "c"]);
    expect(sorted(m.toAttach)).toEqual(["a"]); // a not yet on Phoneme
    expect(m.toDetach).toEqual([]);            // never delete on first sync
  });
  it("local add propagates to Phoneme", () => {
    const m = mergeTagSets(["a"], ["a", "b"], ["a"]);
    expect(sorted(m.merged)).toEqual(["a", "b"]);
    expect(m.toAttach).toEqual(["b"]);
    expect(m.toDetach).toEqual([]);
  });
  it("local remove detaches from Phoneme", () => {
    const m = mergeTagSets(["a", "b"], ["a"], ["a", "b"]);
    expect(m.merged).toEqual(["a"]);
    expect(m.toAttach).toEqual([]);
    expect(m.toDetach).toEqual(["b"]);
  });
  it("remote add is pulled into ytnt", () => {
    const m = mergeTagSets(["a"], ["a"], ["a", "b"]);
    expect(sorted(m.merged)).toEqual(["a", "b"]); // ytnt gains b
    expect(m.toAttach).toEqual([]);               // already on Phoneme
    expect(m.toDetach).toEqual([]);
  });
  it("remote remove drops it from ytnt", () => {
    const m = mergeTagSets(["a", "b"], ["a", "b"], ["a"]);
    expect(m.merged).toEqual(["a"]);
    expect(m.toDetach).toEqual([]); // already gone on Phoneme
  });
  it("simultaneous different changes both apply", () => {
    // local removed 'x', remote added 'y' since base {x}
    const m = mergeTagSets(["x"], [], ["x", "y"]);
    expect(m.merged).toEqual(["y"]);
    expect(m.toDetach).toEqual(["x"]); // honor local removal
    expect(m.toAttach).toEqual([]);    // y already on Phoneme
  });
  it("both removed the same tag → gone, nothing to push", () => {
    const m = mergeTagSets(["a", "b"], ["a"], ["a"]);
    expect(m.merged).toEqual(["a"]);
    expect(m.toAttach).toEqual([]);
    expect(m.toDetach).toEqual([]);
  });
  it("steady state (all equal) is a no-op", () => {
    const m = mergeTagSets(["a", "b"], ["a", "b"], ["a", "b"]);
    expect(m.toAttach).toEqual([]);
    expect(m.toDetach).toEqual([]);
  });
  it("matches case-insensitively, keeps Phoneme's casing", () => {
    const m = mergeTagSets(["Lecture"], ["lecture"], ["Lecture"]);
    expect(m.merged).toEqual(["Lecture"]); // remote casing wins
    expect(m.toAttach).toEqual([]);
    expect(m.toDetach).toEqual([]);
  });
});

describe("parsePlaylistId", () => {
  it("pulls the list id from playlist + watch URLs", () => {
    expect(parsePlaylistId("https://www.youtube.com/playlist?list=PLabc123_-")).toBe("PLabc123_-");
    expect(parsePlaylistId(`https://www.youtube.com/watch?v=${ID}&list=PLxyz`)).toBe("PLxyz");
  });
  it("returns null when there's no list param", () => {
    expect(parsePlaylistId(`https://youtu.be/${ID}`)).toBeNull();
    expect(parsePlaylistId("")).toBeNull();
  });
});

describe("parseVideoId", () => {
  it("accepts every common YouTube URL shape", () => {
    for (const url of [
      ID,
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://youtu.be/${ID}`,
      `https://youtu.be/${ID}?t=42`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}`,
      `  https://youtu.be/${ID}  `,
    ]) expect(parseVideoId(url)).toBe(ID);
  });
  it("rejects non-YouTube / junk", () => {
    expect(parseVideoId("https://vimeo.com/12345")).toBeNull();
    expect(parseVideoId("not a url")).toBeNull();
    expect(parseVideoId("")).toBeNull();
  });
});

describe("parseRef / serializeRef", () => {
  it("round-trips the structured form", () => {
    const s = serializeRef("20260519T143500042");
    expect(JSON.parse(s)).toEqual({ integration: "phoneme", ref: "20260519T143500042" });
    expect(parseRef(s)).toEqual({ integration: "phoneme", ref: "20260519T143500042" });
  });
  it("reads a legacy bare recording id as a phoneme ref", () => {
    expect(parseRef("20260519T143500042")).toEqual({ integration: "phoneme", ref: "20260519T143500042" });
  });
  it("returns null for empty / missing", () => {
    expect(parseRef(null)).toBeNull();
    expect(parseRef("")).toBeNull();
    expect(parseRef(undefined)).toBeNull();
  });
});

describe("formatTime", () => {
  it("handles boundaries", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
    expect(formatTime(-10)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
  });
});

describe("applyOffset", () => {
  it("rewinds but never goes negative", () => {
    expect(applyOffset(33, 3)).toBe(30);
    expect(applyOffset(2, 3)).toBe(0);
  });
});

describe("tsLink", () => {
  it("builds a youtu.be deep link at a whole second", () => {
    expect(tsLink(ID, 115.7)).toBe(`https://youtu.be/${ID}?t=115`);
  });
});

describe("notesToMarkdown", () => {
  it("sorts by time and emits clickable timestamp links", () => {
    const md = notesToMarkdown(
      { id: ID, title: "Demo", url: `https://youtu.be/${ID}` },
      [{ t_secs: 115, content: "second" }, { t_secs: 33, content: "first" }],
    );
    expect(md).toMatch(/# Demo/);
    expect(md.indexOf("0:33")).toBeLessThan(md.indexOf("1:55"));
    expect(md).toContain(`[0:33](https://youtu.be/${ID}?t=33) first`);
  });
});

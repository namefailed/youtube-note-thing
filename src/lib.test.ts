import { describe, it, expect } from "vitest";
import { parseVideoId, formatTime, applyOffset, tsLink, notesToMarkdown } from "./lib";

const ID = "dQw4w9WgXcQ";

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

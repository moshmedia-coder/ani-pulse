import { describe, expect, it } from "vitest";
import { resolveYouTubeTrailerId } from "@/lib/watch-preview";

describe("YouTube trailer resolution", () => {
  it("accepts a valid AniList YouTube ID", () => {
    expect(resolveYouTubeTrailerId({ id: "tR8YH0G67Rk", site: "youtube" })).toBe("tR8YH0G67Rk");
  });

  it.each([
    "https://www.youtube.com/watch?v=tR8YH0G67Rk",
    "https://youtu.be/tR8YH0G67Rk",
    "https://www.youtube.com/embed/tR8YH0G67Rk",
    "https://youtube.com/shorts/tR8YH0G67Rk",
    "https://www.youtube-nocookie.com/embed/tR8YH0G67Rk",
  ])("extracts the video ID from a supported URL: %s", (url) => {
    expect(resolveYouTubeTrailerId({ id: url, site: "YouTube" })).toBe("tR8YH0G67Rk");
  });

  it.each([
    null,
    { id: "", site: "youtube" },
    { id: "not-a-video-id", site: "youtube" },
    { id: "https://example.com/embed/tR8YH0G67Rk", site: "youtube" },
    { id: "javascript:alert(1)", site: "youtube" },
    { id: "tR8YH0G67Rk", site: "dailymotion" },
  ])("rejects missing or invalid trailer metadata: %s", (trailer) => {
    expect(resolveYouTubeTrailerId(trailer)).toBeNull();
  });
});

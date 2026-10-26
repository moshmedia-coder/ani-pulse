import type { AniListMedia } from "@/lib/anilist";

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

function isYouTubeVideoId(value: string | null) {
  return value !== null && YOUTUBE_VIDEO_ID.test(value);
}

function videoIdFromUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const [firstSegment, secondSegment] = segments;
  if (url.hostname.endsWith("youtu.be")) return firstSegment ?? null;
  if (segments.length === 1 && firstSegment === "watch") return url.searchParams.get("v");
  if (
    segments.length === 2 &&
    firstSegment !== undefined &&
    secondSegment !== undefined &&
    ["embed", "live", "shorts", "v"].includes(firstSegment)
  ) {
    return secondSegment;
  }
  return null;
}

export function resolveYouTubeTrailerId(
  trailer: AniListMedia["trailer"] | undefined,
): string | null {
  if (!trailer || typeof trailer.site !== "string" || typeof trailer.id !== "string") return null;
  if (trailer.site.trim().toLowerCase() !== "youtube") return null;

  const value = trailer.id.trim();
  if (isYouTubeVideoId(value)) return value;

  const urlId = videoIdFromUrl(value);
  return urlId !== null && isYouTubeVideoId(urlId) ? urlId : null;
}

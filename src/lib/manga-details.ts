import type { AniListMangaMedia } from "@/lib/anilist";
import { resolveYouTubeTrailerId } from "@/lib/watch-preview";

export interface MangaCredit {
  name: string;
  role: string;
}

export interface MangaPromotionalVideo {
  videoId: string;
  title: string;
  kind: "promotion" | "adaptation";
}

export interface MangaArtwork {
  url: string;
  alt: string;
}

export interface MangaAdaptationArtworkGroup {
  id: number;
  title: string;
  artwork: MangaArtwork[];
}

export function cleanMangaSynopsis(description: string | null | undefined) {
  const decodeEntities = (value: string) =>
    value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, token: string) => {
      if (token[0] !== "#") {
        const named: Record<string, string> = {
          amp: "&",
          apos: "'",
          gt: ">",
          lt: "<",
          nbsp: " ",
          quot: '"',
        };
        return named[token.toLowerCase()] ?? entity;
      }

      const codePoint =
        token[1]?.toLowerCase() === "x"
          ? Number.parseInt(token.slice(2), 16)
          : Number.parseInt(token.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    });

  let text = description?.trim() ?? "";
  for (let pass = 0; pass < 2; pass += 1) text = decodeEntities(text);

  return text
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/~!|!~|(\*\*|__|~~|`)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function trustedAniListArtworkUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isAniListHost = url.hostname === "anilist.co" || url.hostname.endsWith(".anilist.co");
    if (url.protocol !== "https:" || url.username || url.password || !isAniListHost) return null;
    return url.href;
  } catch {
    return null;
  }
}

function artworkDedupeKey(value: string | null | undefined) {
  const trustedUrl = trustedAniListArtworkUrl(value);
  if (!trustedUrl) return null;
  const normalized = new URL(trustedUrl);
  for (const key of [...normalized.searchParams.keys()]) {
    if (/^utm_/i.test(key)) normalized.searchParams.delete(key);
  }
  normalized.hash = "";
  return normalized.href;
}

export function mangaArtwork(media: AniListMangaMedia | undefined, title: string): MangaArtwork[] {
  if (!media) return [];
  const artwork = [
    { url: media.coverImage.extraLarge, alt: `${title} cover artwork` },
    { url: media.bannerImage, alt: `${title} promotional banner artwork` },
  ];
  const seenUrls = new Set<string>();

  return artwork.flatMap(({ url, alt }) => {
    const trustedUrl = trustedAniListArtworkUrl(url);
    if (!trustedUrl) return [];
    const dedupeKey = artworkDedupeKey(trustedUrl);
    if (!dedupeKey) return [];
    if (seenUrls.has(dedupeKey)) return [];
    seenUrls.add(dedupeKey);
    return [{ url: trustedUrl, alt }];
  });
}

export function mangaAdaptationArtwork(
  media: AniListMangaMedia | undefined,
  mangaArt: MangaArtwork[] = [],
): MangaAdaptationArtworkGroup[] {
  if (!media) return [];

  const seenUrls = new Set(
    mangaArt.flatMap(({ url }) => {
      const key = artworkDedupeKey(url);
      return key ? [key] : [];
    }),
  );
  const seenAdaptationIds = new Set<number>();
  const adaptations: MangaAdaptationArtworkGroup[] = [];

  for (const { relationType, node } of media.relations?.edges ?? []) {
    if (relationType !== "ADAPTATION" || node?.type !== "ANIME") continue;
    if (seenAdaptationIds.has(node.id)) continue;
    seenAdaptationIds.add(node.id);

    const title = node.title.english?.trim() || node.title.romaji.trim();
    if (!title) continue;
    const artwork = [
      { url: node.coverImage.extraLarge, alt: `${title} anime adaptation cover artwork` },
      { url: node.bannerImage, alt: `${title} anime adaptation banner artwork` },
    ].flatMap(({ url, alt }) => {
      const trustedUrl = trustedAniListArtworkUrl(url);
      if (!trustedUrl) return [];
      const key = artworkDedupeKey(trustedUrl);
      if (!key || seenUrls.has(key)) return [];
      seenUrls.add(key);
      return [{ url: trustedUrl, alt }];
    });

    if (artwork.length > 0) adaptations.push({ id: node.id, title, artwork });
  }

  return adaptations;
}

export function mangaCredits(media: AniListMangaMedia | undefined) {
  const authors = new Map<string, MangaCredit>();
  const artists = new Map<string, MangaCredit>();

  for (const { role, node } of media?.staff?.edges ?? []) {
    const name = node.name.full?.trim();
    if (!name) continue;
    const normalizedRole = role.trim();
    const isAuthor = /\b(story|author|creator|writer|scenario|original work)\b/i.test(
      normalizedRole,
    );
    const isArtist = /\b(art|illustrat|draw|pencil|inker)\w*\b/i.test(normalizedRole);
    const key = name.toLowerCase();
    if (isAuthor && !authors.has(key)) authors.set(key, { name, role: normalizedRole });
    if (isArtist && !artists.has(key)) artists.set(key, { name, role: normalizedRole });
  }

  return { authors: [...authors.values()], artists: [...artists.values()] };
}

export function mangaPublicationDate(
  date: { year: number | null; month: number | null; day: number | null } | null | undefined,
) {
  if (!date || date.year === null) return null;
  if (date.month === null || date.month < 1 || date.month > 12) return String(date.year);
  if (date.day === null || date.day < 1 || date.day > 31) {
    return `${new Intl.DateTimeFormat("en", { month: "long" }).format(
      new Date(Date.UTC(date.year, date.month - 1, 1)),
    )} ${date.year}`;
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
}

export function mangaPromotionalVideo(
  media: AniListMangaMedia | undefined,
): MangaPromotionalVideo | null {
  if (!media) return null;
  const mangaVideoId = resolveYouTubeTrailerId(media.trailer);
  if (mangaVideoId) {
    return { videoId: mangaVideoId, title: "Manga promotional video", kind: "promotion" };
  }

  for (const { relationType, node } of media.relations?.edges ?? []) {
    if (relationType !== "ADAPTATION" || node?.type !== "ANIME") continue;
    const videoId = resolveYouTubeTrailerId(node.trailer);
    if (!videoId) continue;
    const title = node.title.english?.trim() || node.title.romaji.trim();
    return {
      videoId,
      title: title ? `${title} anime adaptation trailer` : "Anime adaptation trailer",
      kind: "adaptation",
    };
  }
  return null;
}

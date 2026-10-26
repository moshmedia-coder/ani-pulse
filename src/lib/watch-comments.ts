export interface LocalAnimeComment {
  id: string;
  author: "You";
  text: string;
  createdAt: string;
}

export type CommentStorageResult =
  | { ok: true; comments: LocalAnimeComment[] }
  | { ok: false; comments: LocalAnimeComment[] };

const commentsStorageKey = (animeId: number) => `anipulse:watch-comments:${animeId}`;

function isComment(value: unknown): value is LocalAnimeComment {
  if (typeof value !== "object" || value === null) return false;
  const comment = value as Record<string, unknown>;
  return (
    typeof comment["id"] === "string" &&
    comment["id"].length > 0 &&
    comment["author"] === "You" &&
    typeof comment["text"] === "string" &&
    comment["text"].trim().length > 0 &&
    comment["text"].length <= 500 &&
    typeof comment["createdAt"] === "string" &&
    Number.isFinite(Date.parse(comment["createdAt"]))
  );
}

export function readAnimeComments(animeId: number): CommentStorageResult {
  try {
    const stored = window.localStorage.getItem(commentsStorageKey(animeId));
    if (stored === null) return { ok: true, comments: [] };
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return { ok: false, comments: [] };
    const comments = parsed.filter(isComment).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { ok: comments.length === parsed.length, comments };
  } catch {
    return { ok: false, comments: [] };
  }
}

export function writeAnimeComments(
  animeId: number,
  comments: LocalAnimeComment[],
): CommentStorageResult {
  try {
    window.localStorage.setItem(commentsStorageKey(animeId), JSON.stringify(comments));
    return { ok: true, comments };
  } catch {
    return { ok: false, comments: [] };
  }
}

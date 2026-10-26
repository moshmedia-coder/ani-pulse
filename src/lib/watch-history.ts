export const WATCH_HISTORY_CHANGE_EVENT = "anipulse:watch-history-changed";
const WATCHED_EPISODE_KEY_PREFIX = "anipulse-watched-";

export const watchedEpisodesStorageKey = (malId: number) => `${WATCHED_EPISODE_KEY_PREFIX}${malId}`;

export function readWatchedAnimeIds(): number[] {
  if (typeof window === "undefined") return [];

  const ids = new Set<number>();
  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key?.startsWith(WATCHED_EPISODE_KEY_PREFIX)) continue;
    const id = Number(key.slice(WATCHED_EPISODE_KEY_PREFIX.length));
    if (Number.isSafeInteger(id) && id > 0 && readWatchedEpisodes(id).length > 0) ids.add(id);
  }
  return [...ids];
}

export function readWatchedEpisodes(malId: number): number[] {
  if (!Number.isSafeInteger(malId) || malId <= 0 || typeof window === "undefined") return [];

  const stored = window.sessionStorage.getItem(watchedEpisodesStorageKey(malId));
  if (stored === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }

  if (!Array.isArray(parsed)) return [];
  return [
    ...new Set(
      parsed.filter((episode): episode is number => Number.isSafeInteger(episode) && episode > 0),
    ),
  ];
}

export function notifyWatchHistoryChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WATCH_HISTORY_CHANGE_EVENT));
  }
}

export const WATCH_HISTORY_CHANGE_EVENT = "anipulse:watch-history-changed";

export const watchedEpisodesStorageKey = (malId: number) => `anipulse-watched-${malId}`;

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
  return parsed.filter(
    (episode): episode is number => Number.isSafeInteger(episode) && episode > 0,
  );
}

export function notifyWatchHistoryChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WATCH_HISTORY_CHANGE_EVENT));
  }
}

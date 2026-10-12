import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyWatchHistoryChanged,
  readWatchedEpisodes,
  WATCH_HISTORY_CHANGE_EVENT,
  watchedEpisodesStorageKey,
} from "@/lib/watch-history";

describe("watch history storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("returns no episodes when the anime has no storage record", () => {
    expect(readWatchedEpisodes(52991)).toEqual([]);
  });

  it("returns only positive safe-integer episode numbers", () => {
    sessionStorage.setItem(
      watchedEpisodesStorageKey(52991),
      JSON.stringify([1, 2, 4, 0, -1, 1.5, "5", Number.MAX_SAFE_INTEGER + 1]),
    );

    expect(readWatchedEpisodes(52991)).toEqual([1, 2, 4]);
  });

  it("ignores malformed JSON and non-array values", () => {
    sessionStorage.setItem(watchedEpisodesStorageKey(52991), "{malformed");
    expect(readWatchedEpisodes(52991)).toEqual([]);

    sessionStorage.setItem(watchedEpisodesStorageKey(52991), JSON.stringify({ episodes: [1] }));
    expect(readWatchedEpisodes(52991)).toEqual([]);
  });

  it("notifies listeners after a watch record changes", () => {
    const listener = vi.fn();
    window.addEventListener(WATCH_HISTORY_CHANGE_EVENT, listener);

    notifyWatchHistoryChanged();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(WATCH_HISTORY_CHANGE_EVENT, listener);
  });
});

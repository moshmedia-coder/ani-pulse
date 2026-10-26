import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  notifyWatchHistoryChanged,
  readWatchedAnimeIds,
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

  it("returns unique positive safe-integer episode numbers", () => {
    sessionStorage.setItem(
      watchedEpisodesStorageKey(52991),
      JSON.stringify([1, 2, 4, 2, 0, -1, 1.5, "5", Number.MAX_SAFE_INTEGER + 1]),
    );

    expect(readWatchedEpisodes(52991)).toEqual([1, 2, 4]);
  });

  it("lists only valid anime IDs with at least one watched episode", () => {
    sessionStorage.setItem(watchedEpisodesStorageKey(52991), JSON.stringify([1]));
    sessionStorage.setItem(watchedEpisodesStorageKey(888888), JSON.stringify([3, 3]));
    sessionStorage.setItem(watchedEpisodesStorageKey(12345), JSON.stringify([]));
    sessionStorage.setItem("anipulse-watched-not-an-id", JSON.stringify([1]));

    expect(new Set(readWatchedAnimeIds())).toEqual(new Set([52991, 888888]));
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

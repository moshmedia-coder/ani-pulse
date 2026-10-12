import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AniListGraphQLError,
  AniListHttpError,
  AniListNetworkError,
  mediaByMalQuery,
  trendingQuery,
} from "@/lib/anilist";

const media = {
  id: 1,
  idMal: 52991,
  title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
  description: "A journey continues.",
  bannerImage: null,
  coverImage: { extraLarge: "https://example.test/frieren.jpg", color: null },
  episodes: 28,
  duration: 24,
  averageScore: 93,
  seasonYear: 2023,
  format: "TV",
  status: "FINISHED",
  genres: ["Adventure", "Drama"],
  trailer: null,
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AniList queries", () => {
  it("returns successful trending and media responses and filters missing MAL IDs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { Page: { media: [media, { ...media, id: 2, idMal: null }] } } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { Media: media } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).resolves.toEqual([media]);
    await expect(client.fetchQuery(mediaByMalQuery(52991))).resolves.toEqual(media);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toContain('"id":52991');
    client.clear();
  });

  it("preserves HTTP status and Retry-After and does not retry HTTP 429", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({}, { status: 429, headers: { "Retry-After": "30" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).rejects.toMatchObject({
      name: "AniListHttpError",
      status: 429,
      retryAfter: "30",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    client.clear();
  });

  it("retries a network failure once and can recover on the next attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(jsonResponse({ data: { Page: { media: [media] } } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).resolves.toEqual([media]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it("classifies network failures separately and does not retry client HTTP errors", async () => {
    const networkFetch = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", networkFetch);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).rejects.toBeInstanceOf(AniListNetworkError);
    expect(networkFetch).toHaveBeenCalledTimes(2);

    const badRequestFetch = vi.fn().mockResolvedValue(jsonResponse({}, { status: 400 }));
    vi.stubGlobal("fetch", badRequestFetch);
    await expect(client.fetchQuery(mediaByMalQuery(52991))).rejects.toBeInstanceOf(
      AniListHttpError,
    );
    expect(badRequestFetch).toHaveBeenCalledOnce();
    client.clear();
  });

  it("classifies GraphQL errors separately and does not retry them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ errors: [{ message: "Query rejected" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).rejects.toMatchObject({
      name: "AniListGraphQLError",
      errors: ["Query rejected"],
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(new AniListGraphQLError(["private detail"]).message).toBe(
      "AniList returned a GraphQL error",
    );
    client.clear();
  });

  it("retries a failed query later and recovers without treating the failure as success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 429, headers: { "Retry-After": "10" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { Page: { media: [media] } } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    await expect(client.fetchQuery(trendingQuery())).rejects.toBeInstanceOf(AniListHttpError);
    expect(fetchMock).toHaveBeenCalledOnce();
    await expect(client.fetchQuery(trendingQuery())).resolves.toEqual([media]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    client.clear();
  });
});

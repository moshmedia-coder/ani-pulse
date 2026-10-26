import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AniListGraphQLError,
  AniListHttpError,
  AniListNetworkError,
  animeDiscoveryQuery,
  airingScheduleQuery,
  animeSearchQuery,
  mangaDiscoveryQuery,
  mangaSearchQuery,
  mediaByMalQuery,
  recentEndDateCutoff,
  trendingQuery,
  type AniListAiringScheduleEntry,
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

function airingSchedule(
  overrides: Partial<AniListAiringScheduleEntry> = {},
): AniListAiringScheduleEntry {
  return {
    id: 100,
    airingAt: Math.floor(new Date(2026, 9, 17, 18).getTime() / 1000),
    episode: 5,
    media: {
      id: 200,
      idMal: 52991,
      title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
      coverImage: { extraLarge: "https://example.test/frieren.jpg" },
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AniList queries", () => {
  it("queries paginated anime discovery and ranks recent completions and scored movies", async () => {
    const finished = {
      ...media,
      status: "FINISHED",
      endDate: { year: 2026, month: 10, day: 20 },
    };
    const oldFinished = {
      ...media,
      id: 2,
      status: "FINISHED",
      endDate: { year: 2025, month: 1, day: 1 },
    };
    const undatedFinished = {
      ...media,
      id: 3,
      status: "FINISHED",
      endDate: null,
    };
    const unscoredMovie = {
      ...media,
      id: 4,
      averageScore: null,
      format: "MOVIE",
    };
    const movie = { ...media, id: 5, format: "MOVIE", averageScore: 86 };
    const responseMedia = [finished, oldFinished, undatedFinished, unscoredMovie, movie];
    const fetchMock = vi.fn().mockImplementation(() =>
      jsonResponse({
        data: {
          Page: {
            media: responseMedia,
            pageInfo: {
              total: responseMedia.length,
              currentPage: 2,
              lastPage: 3,
              hasNextPage: true,
              perPage: 12,
            },
          },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const cutoff = 20260701;

    const catalog = await client.fetchQuery(
      animeDiscoveryQuery({
        page: 2,
        perPage: 12,
        sort: "START_DATE_DESC",
        search: "  frieren  ",
        genre: "Adventure",
      }),
    );
    await client.fetchQuery(animeDiscoveryQuery({ sort: "POPULARITY_DESC" }));
    const recent = await client.fetchQuery(
      animeDiscoveryQuery({
        sort: "END_DATE_DESC",
        status: "FINISHED",
        endDateAfter: cutoff,
      }),
    );
    const movies = await client.fetchQuery(
      animeDiscoveryQuery({ sort: "SCORE_DESC", format: "MOVIE", scoredOnly: true }),
    );

    expect(catalog.pageInfo).toMatchObject({ currentPage: 2, total: 5, hasNextPage: true });
    expect(catalog.media).toHaveLength(5);
    expect(recent.media.map((item) => item.id)).toEqual([1]);
    expect(movies.media.map((item) => item.id)).toEqual([5]);
    const requests = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(call[1]?.body as string) as {
          query: string;
          variables: Record<string, unknown>;
        },
    );
    expect(requests.map((request) => request.variables["sort"])).toEqual([
      "START_DATE_DESC",
      "POPULARITY_DESC",
      "END_DATE_DESC",
      "SCORE_DESC",
    ]);
    expect(requests[0]?.variables).toMatchObject({
      page: 2,
      perPage: 12,
      search: "frieren",
      genres: ["Adventure"],
    });
    expect(requests[0]?.query).toContain("search: $search");
    expect(requests[0]?.query).toContain("genre_in: $genres");
    expect(requests[0]?.query).not.toMatch(/status: \$status|endDate_greater|averageScore_greater/);
    expect(requests[1]?.variables).toMatchObject({ perPage: 12 });
    expect(requests[1]?.variables).not.toHaveProperty("status");
    expect(requests[1]?.query).not.toMatch(
      /search: \$search|genre_in: \$genres|status: \$status|format: \$format|endDate_greater|averageScore_greater/,
    );
    expect(requests[2]?.variables).toMatchObject({
      status: "FINISHED",
      endDateAfter: cutoff,
    });
    expect(requests[2]?.query).toContain("status: $status");
    expect(requests[2]?.query).toContain("endDate_greater: $endDateAfter");
    expect(requests[2]?.query).not.toContain("averageScore_greater");
    expect(requests[3]?.variables).toMatchObject({ format: "MOVIE", minimumScore: 0 });
    expect(requests[3]?.query).toContain("format: $format");
    expect(requests[3]?.query).toContain("averageScore_greater: $minimumScore");
    expect(requests[3]?.query).not.toContain("endDate_greater");
    expect(recentEndDateCutoff(new Date("2026-10-22T00:00:00.000Z"))).toBe(20260425);
    client.clear();
  });

  it("omits unused null filters that cause AniList discovery requests to fail or return no results", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      const hasNullComparison =
        (body.query.includes("endDate_greater: $endDateAfter") &&
          body.variables["endDateAfter"] == null) ||
        (body.query.includes("averageScore_greater: $minimumScore") &&
          body.variables["minimumScore"] == null);
      if (hasNullComparison) {
        return jsonResponse(
          {
            errors: [{ message: "Illegal operator and value combination." }],
            data: { Page: null },
          },
          { status: 400 },
        );
      }
      const results =
        body.query.includes("status: $status") && body.variables["status"] == null ? [] : [media];
      return jsonResponse({
        data: {
          Page: {
            media: results,
            pageInfo: {
              total: results.length,
              currentPage: 1,
              lastPage: 1,
              hasNextPage: false,
              perPage: 12,
            },
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createQueryClient().fetchQuery(
      animeDiscoveryQuery({ sort: "POPULARITY_DESC" }),
    );
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      query: string;
      variables: Record<string, unknown>;
    };

    expect(result.media).toEqual([media]);
    expect(request.query).not.toMatch(
      /status: \$status|endDate_greater: \$endDateAfter|averageScore_greater: \$minimumScore/,
    );
    expect(request.variables).not.toHaveProperty("status");
    expect(request.variables).not.toHaveProperty("endDateAfter");
    expect(request.variables).not.toHaveProperty("minimumScore");
  });

  it("queries and de-duplicates Trending, Popular, and Top-Rated manga", async () => {
    const manga = {
      id: 501,
      idMal: 502,
      title: { english: "Real Manga", romaji: "Real Manga" },
      description: "A real synopsis.",
      bannerImage: null,
      coverImage: { extraLarge: "https://example.test/manga.jpg", color: null },
      genres: ["Adventure"],
      averageScore: 87,
      popularity: 12000,
      chapters: 42,
      volumes: 6,
      status: "RELEASING",
      startDate: { year: 2024, month: 1, day: 2 },
    };
    const duplicate = { ...manga, title: { english: "Duplicate", romaji: "Duplicate" } };
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(jsonResponse({ data: { Page: { media: [manga, duplicate] } } })),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const queries = [
      mangaDiscoveryQuery("TRENDING_DESC"),
      mangaDiscoveryQuery("POPULARITY_DESC"),
      mangaDiscoveryQuery("SCORE_DESC"),
    ];

    for (const query of queries) {
      await expect(client.fetchQuery(query)).resolves.toEqual([manga]);
    }

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const requests = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(call[1]?.body as string) as {
          query: string;
          variables: { type: string; sort: string[] };
        },
    );
    expect(requests.map((request) => request.variables.sort)).toEqual([
      ["TRENDING_DESC"],
      ["POPULARITY_DESC"],
      ["SCORE_DESC"],
    ]);
    for (const request of requests) {
      expect(request.variables.type).toBe("MANGA");
      expect(request.query).toContain("media(type: $type");
      expect(request.query).toContain("chapters volumes status");
      expect(request.query).toContain("startDate { year month day }");
    }
    client.clear();
  });

  it("normalizes manga search, requests MANGA media, and de-duplicates AniList results", async () => {
    const manga = {
      id: 601,
      idMal: null,
      title: { english: null, romaji: "Manga Search Result" },
      description: null,
      bannerImage: null,
      coverImage: { extraLarge: null, color: null },
      genres: [],
      averageScore: null,
      popularity: 0,
      chapters: null,
      volumes: null,
      status: null,
      startDate: { year: null, month: null, day: null },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { Page: { media: [manga, manga] } } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const query = mangaSearchQuery("  BLUE   PERIOD ");

    expect(query.queryKey).toEqual(["anilist", "manga", "search", "blue period"]);
    await expect(client.fetchQuery(query)).resolves.toEqual([manga]);

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
      variables: { search: string; type: string };
    };
    expect(body.variables).toEqual({ search: "blue period", type: "MANGA" });
    expect(body.query).toContain("type: $type");
    expect(fetchMock).toHaveBeenCalledOnce();
    client.clear();
  });

  it("retrieves, validates, de-duplicates, and paginates real airing schedule entries", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 12));
    const duplicate = airingSchedule({ id: 101 });
    const firstPage = [
      airingSchedule(),
      duplicate,
      airingSchedule({ id: 102, airingAt: Math.floor(new Date(2026, 9, 17, 10).getTime() / 1000) }),
      airingSchedule({
        id: 103,
        episode: null,
        media: {
          id: 203,
          idMal: 888888,
          title: { english: null, romaji: "Upcoming Anime" },
          coverImage: { extraLarge: null },
        },
      }),
      airingSchedule({
        id: 106,
        episode: null,
        media: {
          id: 203,
          idMal: 888888,
          title: { english: null, romaji: "Upcoming Anime" },
          coverImage: { extraLarge: null },
        },
      }),
      airingSchedule({
        id: 104,
        media: {
          id: 204,
          idMal: null,
          title: { english: "No MAL route", romaji: "No MAL route" },
          coverImage: { extraLarge: null },
        },
      }),
    ];
    const nextWeek = airingSchedule({
      id: 105,
      airingAt: Math.floor(new Date(2026, 9, 19, 1).getTime() / 1000),
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            Page: {
              pageInfo: { hasNextPage: true },
              airingSchedules: firstPage,
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            Page: {
              pageInfo: { hasNextPage: true },
              airingSchedules: [nextWeek],
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();

    const entries = await client.fetchQuery(airingScheduleQuery());

    expect(entries).toEqual([
      expect.objectContaining({
        id: 100,
        animeId: 52991,
        title: "Frieren: Beyond Journey's End",
        image: "https://example.test/frieren.jpg",
        episode: 5,
        airingAt: Math.floor(new Date(2026, 9, 17, 18).getTime() / 1000),
      }),
      expect.objectContaining({
        id: 103,
        animeId: 888888,
        title: "Upcoming Anime",
        image: null,
        episode: null,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequest = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
      variables: { page: number; now: number };
    };
    const secondRequest = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      variables: { page: number };
    };
    expect(firstRequest.query).toContain("airingSchedules(notYetAired: true");
    expect(firstRequest.query).toContain("sort: TIME");
    expect(firstRequest.query).toContain("id airingAt episode");
    expect(firstRequest.variables).toEqual({ page: 1, now: Math.floor(Date.now() / 1000) });
    expect(secondRequest.variables.page).toBe(2);
    client.clear();
  });

  it("normalizes live search terms, excludes adult media, and caches results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ data: { Page: { media: [media] } } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = createQueryClient();
    const query = animeSearchQuery("  FRIEREN   Beyond  ");

    expect(query.queryKey).toEqual(["anilist", "search", "frieren beyond"]);
    expect(query.staleTime).toBe(5 * 60 * 1000);
    await expect(client.fetchQuery(query)).resolves.toEqual([media]);
    await expect(client.fetchQuery(animeSearchQuery("frieren beyond"))).resolves.toEqual([media]);

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
      variables: { search: string };
    };
    expect(body.variables.search).toBe("frieren beyond");
    expect(body.query).toContain("isAdult: false");
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock).toHaveBeenCalledOnce();
    client.clear();
  });

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

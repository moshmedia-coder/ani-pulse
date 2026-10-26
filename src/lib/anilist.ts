import { queryOptions } from "@tanstack/react-query";

const ENDPOINT = "https://graphql.anilist.co";

export class AniListNetworkError extends Error {
  readonly kind = "network";

  constructor() {
    super("AniList network request failed");
    this.name = "AniListNetworkError";
  }
}

export class AniListHttpError extends Error {
  readonly kind = "http";

  constructor(
    readonly status: number,
    readonly retryAfter: string | null,
  ) {
    super(`AniList request failed (${status})`);
    this.name = "AniListHttpError";
  }
}

export class AniListGraphQLError extends Error {
  readonly kind = "graphql";

  constructor(readonly errors: string[]) {
    super("AniList returned a GraphQL error");
    this.name = "AniListGraphQLError";
  }
}

function shouldRetryAniListRequest(failureCount: number, error: Error) {
  return (
    failureCount < 1 &&
    (error instanceof AniListNetworkError ||
      (error instanceof AniListHttpError && error.status >= 500))
  );
}

export interface AniListMedia {
  id: number;
  idMal: number | null;
  title: { english: string | null; romaji: string };
  description: string | null;
  bannerImage: string | null;
  coverImage: { extraLarge: string | null; color: string | null };
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  season?: string | null;
  startDate?: { year: number | null; month: number | null; day: number | null };
  endDate?: { year: number | null; month: number | null; day: number | null };
  countryOfOrigin?: string | null;
  isAdult?: boolean | null;
  format: string | null;
  status: string | null;
  genres: string[];
  studios?: { nodes: { name: string }[] };
  characters?: {
    edges: {
      role: string | null;
      node: {
        id: number;
        name: { full: string | null };
        image: { large: string | null };
      };
      voiceActors: {
        id: number;
        name: { full: string | null };
        languageV2: string | null;
      }[];
      englishVoiceActors: {
        id: number;
        name: { full: string | null };
        languageV2: string | null;
      }[];
    }[];
  };
  relations?: {
    edges: {
      relationType: string | null;
      node: AniListRelatedMedia | null;
    }[];
  };
  trailer: { id: string; site: string } | null;
  nextAiringEpisode?: { episode: number; timeUntilAiring: number } | null;
  recommendations?: {
    nodes: {
      mediaRecommendation: AniListRelatedMedia | null;
    }[];
  };
}

export interface AniListRelatedMedia {
  id: number;
  idMal: number | null;
  title: { english: string | null; romaji: string };
  coverImage: { extraLarge: string | null; color: string | null };
  format: string | null;
  seasonYear: number | null;
  averageScore: number | null;
  isAdult: boolean | null;
}

export type AniListSearchResult = Pick<
  AniListMedia,
  | "id"
  | "idMal"
  | "title"
  | "coverImage"
  | "averageScore"
  | "seasonYear"
  | "format"
  | "status"
  | "genres"
>;

export type AniListAnimeSort =
  "START_DATE_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "END_DATE_DESC";

export interface AniListAnimeDiscoveryOptions {
  page?: number;
  perPage?: number;
  sort: AniListAnimeSort;
  search?: string;
  genre?: string;
  status?: string;
  format?: string;
  endDateAfter?: number;
  scoredOnly?: boolean;
}

export interface AniListAnimeDiscoveryPage {
  media: AniListMedia[];
  pageInfo: {
    total: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
    perPage: number;
  };
}

export interface AniListMangaMedia {
  id: number;
  idMal: number | null;
  title: { english: string | null; romaji: string; native?: string | null };
  description: string | null;
  bannerImage: string | null;
  coverImage: { extraLarge: string | null; color: string | null };
  genres: string[];
  averageScore: number | null;
  popularity: number;
  chapters: number | null;
  volumes: number | null;
  status: string | null;
  startDate: { year: number | null; month: number | null; day: number | null } | null;
  endDate?: { year: number | null; month: number | null; day: number | null } | null;
  format?: string | null;
  countryOfOrigin?: string | null;
  trailer?: { id: string; site: string } | null;
  relations?: {
    edges: {
      relationType: string | null;
      node: {
        id: number;
        type: string | null;
        title: { english: string | null; romaji: string };
        coverImage: { extraLarge: string | null };
        bannerImage: string | null;
        trailer: { id: string; site: string } | null;
      } | null;
    }[];
  } | null;
  tags?: { name: string; category: string; isAdult: boolean }[] | null;
  staff?: {
    edges: {
      role: string;
      node: { name: { full: string | null } };
    }[];
  } | null;
  externalLinks?: AniListMangaExternalLink[] | null;
}

export interface AniListMangaExternalLink {
  site: string;
  url: string;
  type: string | null;
  language: string | null;
}

export type MangaSort = "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC";

const MANGA_FIELDS = `id idMal title { english romaji } description(asHtml: false) bannerImage
  coverImage { extraLarge color } genres averageScore popularity chapters volumes status
  startDate { year month day }`;

const MANGA_DETAIL_FIELDS = `${MANGA_FIELDS}
  title { native } format countryOfOrigin endDate { year month day }
  trailer { id site }
  relations { edges { relationType node {
    id type title { english romaji } coverImage { extraLarge } bannerImage trailer { id site }
  } } }
  tags { name category isAdult }
  staff(sort: RELEVANCE, perPage: 25) { edges { role node { name { full } } } }
  externalLinks { site url type language }`;

export const mangaDetailsQuery = (id: number) =>
  queryOptions({
    queryKey: ["anilist", "manga", "details", id],
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AniListMangaMedia | null> => {
      const data = await request<{ Media: AniListMangaMedia | null }>(
        `query ($id: Int!, $type: MediaType!) {
          Media(id: $id, type: $type) { ${MANGA_DETAIL_FIELDS} }
        }`,
        { id, type: "MANGA" },
        signal,
      );
      return data.Media;
    },
  });

function deduplicateManga(media: AniListMangaMedia[]) {
  const unique = new Map<number, AniListMangaMedia>();
  for (const item of media) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

export const mangaDiscoveryQuery = (sort: MangaSort) =>
  queryOptions({
    queryKey: ["anilist", "manga", "discovery", sort],
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AniListMangaMedia[]> => {
      const data = await request<{ Page: { media: AniListMangaMedia[] } }>(
        `query ($type: MediaType!, $sort: [MediaSort]) {
          Page(perPage: 24) {
            media(type: $type, sort: $sort, isAdult: false) { ${MANGA_FIELDS} }
          }
        }`,
        { type: "MANGA", sort: [sort] },
        signal,
      );
      return deduplicateManga(data.Page.media);
    },
  });

export const mangaSearchQuery = (search: string) => {
  const normalizedSearch = search.trim().replace(/\s+/g, " ").toLowerCase();
  return queryOptions({
    queryKey: ["anilist", "manga", "search", normalizedSearch],
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AniListMangaMedia[]> => {
      const data = await request<{ Page: { media: AniListMangaMedia[] } }>(
        `query ($search: String!, $type: MediaType!) {
          Page(perPage: 30) {
            media(search: $search, type: $type, isAdult: false, sort: SEARCH_MATCH) {
              ${MANGA_FIELDS}
            }
          }
        }`,
        { search: normalizedSearch, type: "MANGA" },
        signal,
      );
      return deduplicateManga(data.Page.media);
    },
  });
};

const BASE_FIELDS = `id idMal title { english romaji } description(asHtml: false) bannerImage
  coverImage { extraLarge color } episodes duration averageScore seasonYear format status genres
  trailer { id site } nextAiringEpisode { episode timeUntilAiring }`;

const ANIME_DISCOVERY_FIELDS = `id idMal title { english romaji } description(asHtml: false)
  coverImage { extraLarge color } episodes averageScore popularity seasonYear
  startDate { year month day } endDate { year month day } format status genres`;

const DISCOVERY_FIELDS = `id idMal title { english romaji } coverImage { extraLarge color }
  format seasonYear averageScore isAdult`;

async function request<T>(
  query: string,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AniListNetworkError();
  }
  if (!res.ok) throw new AniListHttpError(res.status, res.headers.get("Retry-After"));
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) {
    throw new AniListGraphQLError(json.errors.map((error) => error.message));
  }
  return json.data;
}

export const animeTitle = (m: Pick<AniListMedia, "title">) => m.title.english || m.title.romaji;
export const cleanDescription = (text: string | null) =>
  (text ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const animeSearchQuery = (search: string) => {
  const normalizedSearch = search.trim().replace(/\s+/g, " ").toLowerCase();
  return queryOptions({
    queryKey: ["anilist", "search", normalizedSearch],
    staleTime: 5 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AniListSearchResult[]> => {
      const data = await request<{ Page: { media: AniListSearchResult[] } }>(
        `query ($search: String) { Page(perPage: 20) { media(search: $search, type: ANIME, isAdult: false, sort: SEARCH_MATCH) { id idMal title { english romaji } coverImage { extraLarge color } averageScore seasonYear format status genres } } }`,
        { search: normalizedSearch },
        signal,
      );
      return data.Page.media;
    },
  });
};

export const animeDiscoveryQuery = (options: AniListAnimeDiscoveryOptions) => {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 12;
  const search = options.search?.trim().replace(/\s+/g, " ") || null;
  const genre = options.genre?.trim() || null;
  const endDateAfter = options.endDateAfter ?? null;
  const minimumScore = options.scoredOnly ? 0 : null;
  const variableValues: Record<string, unknown> = {
    page,
    perPage,
    sort: options.sort,
  };
  const optionalDefinitions: string[] = [];
  const filters: string[] = [];

  if (search) {
    optionalDefinitions.push("$search: String");
    variableValues["search"] = search;
    filters.push("search: $search");
  }
  if (genre) {
    optionalDefinitions.push("$genres: [String]");
    variableValues["genres"] = [genre];
    filters.push("genre_in: $genres");
  }
  if (options.status) {
    optionalDefinitions.push("$status: MediaStatus");
    variableValues["status"] = options.status;
    filters.push("status: $status");
  }
  if (options.format) {
    optionalDefinitions.push("$format: MediaFormat");
    variableValues["format"] = options.format;
    filters.push("format: $format");
  }
  if (endDateAfter != null) {
    optionalDefinitions.push("$endDateAfter: FuzzyDateInt");
    variableValues["endDateAfter"] = endDateAfter;
    filters.push("endDate_greater: $endDateAfter");
  }
  if (minimumScore != null) {
    optionalDefinitions.push("$minimumScore: Int");
    variableValues["minimumScore"] = minimumScore;
    filters.push("averageScore_greater: $minimumScore");
  }
  const variableDefinitions = [
    "$page: Int",
    "$perPage: Int",
    "$sort: MediaSort",
    ...optionalDefinitions,
  ].join(", ");

  return queryOptions({
    queryKey: ["anilist", "anime", "discovery", variableValues],
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AniListAnimeDiscoveryPage> => {
      const data = await request<{
        Page: AniListAnimeDiscoveryPage;
      }>(
        `query (${variableDefinitions}) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { total currentPage lastPage hasNextPage perPage }
            media(
              type: ANIME
              sort: [$sort]
              ${filters.join("\n              ")}
              isAdult: false
            ) { ${ANIME_DISCOVERY_FIELDS} }
          }
        }`,
        variableValues,
        signal,
      );
      const media = data.Page.media.filter((item) => {
        if (options.format && item.format !== options.format) return false;
        if (options.status === "FINISHED" && !isRecentFinishedAnime(item, endDateAfter ?? 0)) {
          return false;
        }
        return !options.scoredOnly || (item.averageScore != null && item.averageScore > 0);
      });
      if (options.status === "FINISHED") {
        media.sort((a, b) => endDateValue(b.endDate) - endDateValue(a.endDate));
      }
      return { ...data.Page, media };
    },
  });
};

function endDateValue(date: AniListMedia["endDate"]) {
  return date?.year && date.month && date.day ? date.year * 10000 + date.month * 100 + date.day : 0;
}

export function isRecentFinishedAnime(media: AniListMedia, endDateAfter: number) {
  const date = media.endDate;
  if (media.status !== "FINISHED" || !date?.year || !date.month || !date.day) return false;
  if (
    !Number.isInteger(date.year) ||
    !Number.isInteger(date.month) ||
    !Number.isInteger(date.day)
  ) {
    return false;
  }
  const timestamp = Date.UTC(date.year, date.month - 1, date.day);
  const validDate = new Date(timestamp);
  if (
    validDate.getUTCFullYear() !== date.year ||
    validDate.getUTCMonth() !== date.month - 1 ||
    validDate.getUTCDate() !== date.day
  ) {
    return false;
  }
  return endDateValue(date) > endDateAfter;
}

export function recentEndDateCutoff(now = new Date()) {
  const cutoff = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  return cutoff.getUTCFullYear() * 10000 + (cutoff.getUTCMonth() + 1) * 100 + cutoff.getUTCDate();
}

export const trendingQuery = () =>
  queryOptions({
    queryKey: ["anilist", "trending"],
    staleTime: 10 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async () => {
      const data = await request<{ Page: { media: AniListMedia[] } }>(
        `query { Page(perPage: 18) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${BASE_FIELDS} } } }`,
        {},
      );
      return data.Page.media.filter((m) => m.idMal);
    },
  });

export interface AniListAiringScheduleEntry {
  id: number;
  airingAt: number;
  episode: number | null;
  media: {
    id: number;
    idMal: number | null;
    title: { english: string | null; romaji: string };
    coverImage: { extraLarge: string | null };
  };
}

export interface AiringScheduleEntry {
  id: number;
  animeId: number;
  title: string;
  image: string | null;
  episode: number | null;
  airingAt: number;
}

const AIRING_SCHEDULE_PAGE_SIZE = 50;

function endOfCurrentLocalWeek(date: Date) {
  const daysUntilNextMonday = 7 - ((date.getDay() + 6) % 7);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + daysUntilNextMonday);
}

function toAiringScheduleEntry(schedule: AniListAiringScheduleEntry): AiringScheduleEntry | null {
  const { media } = schedule;
  const title = media.title.english?.trim() || media.title.romaji.trim();
  if (
    !Number.isSafeInteger(schedule.id) ||
    !Number.isSafeInteger(media.id) ||
    !Number.isSafeInteger(media.idMal) ||
    !media.idMal ||
    media.idMal <= 0 ||
    !title ||
    !Number.isSafeInteger(schedule.airingAt) ||
    schedule.airingAt <= 0
  ) {
    return null;
  }

  return {
    id: schedule.id,
    animeId: media.idMal,
    title,
    image: media.coverImage.extraLarge,
    episode:
      schedule.episode != null && Number.isSafeInteger(schedule.episode) && schedule.episode > 0
        ? schedule.episode
        : null,
    airingAt: schedule.airingAt,
  };
}

export const airingScheduleQuery = () =>
  queryOptions({
    queryKey: ["anilist", "airing-schedule"],
    staleTime: 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async ({ signal }): Promise<AiringScheduleEntry[]> => {
      const now = Math.floor(Date.now() / 1000);
      const weekEnd = Math.floor(endOfCurrentLocalWeek(new Date()).getTime() / 1000);
      const entries = new Map<string, AiringScheduleEntry>();
      let page = 1;
      let hasNextPage = true;

      while (hasNextPage) {
        const data = await request<{
          Page: {
            pageInfo: { hasNextPage: boolean };
            airingSchedules: AniListAiringScheduleEntry[];
          };
        }>(
          `query ($page: Int, $now: Int) {
            Page(page: $page, perPage: ${AIRING_SCHEDULE_PAGE_SIZE}) {
              pageInfo { hasNextPage }
              airingSchedules(notYetAired: true, airingAt_greater: $now, sort: TIME) {
                id airingAt episode
                media { id idMal title { english romaji } coverImage { extraLarge } }
              }
            }
          }`,
          { page, now },
          signal,
        );
        const schedules = data.Page.airingSchedules;

        for (const schedule of schedules) {
          const entry = toAiringScheduleEntry(schedule);
          if (!entry || entry.airingAt <= now || entry.airingAt >= weekEnd) continue;
          const key = `${schedule.media.id}:${entry.episode ?? "unknown"}:${entry.airingAt}`;
          if (!entries.has(key)) entries.set(key, entry);
        }

        hasNextPage =
          data.Page.pageInfo.hasNextPage &&
          schedules.length > 0 &&
          !schedules.some((schedule) => schedule.airingAt >= weekEnd);
        page += 1;
      }

      return [...entries.values()].sort((a, b) => a.airingAt - b.airingAt);
    },
  });

export const mediaByMalQuery = (malId: number) =>
  queryOptions({
    queryKey: ["anilist", "media", malId],
    staleTime: 30 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async () => {
      const data = await request<{ Media: AniListMedia | null }>(
        `query ($id: Int) { Media(idMal: $id, type: ANIME, isAdult: false) { ${BASE_FIELDS}
          season startDate { year month day } endDate { year month day } countryOfOrigin isAdult
          studios(isMain: true) { nodes { name } }
          characters(perPage: 12, sort: ROLE) { edges {
            role node { id name { full } image { large } }
            voiceActors(language: JAPANESE) { id name { full } languageV2 }
            englishVoiceActors: voiceActors(language: ENGLISH) { id name { full } languageV2 }
          } }
          relations { edges { relationType(version: 2) node { ${DISCOVERY_FIELDS} } } }
          recommendations(perPage: 8, sort: RATING_DESC) {
            nodes { mediaRecommendation { ${DISCOVERY_FIELDS} } }
          } } }`,
        { id: malId },
      );
      return data.Media;
    },
  });

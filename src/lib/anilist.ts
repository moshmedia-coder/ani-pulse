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
  format: string | null;
  status: string | null;
  genres: string[];
  studios?: { nodes: { name: string }[] };
  trailer: { id: string; site: string } | null;
  nextAiringEpisode?: { episode: number; timeUntilAiring: number } | null;
  recommendations?: {
    nodes: {
      mediaRecommendation: Pick<AniListMedia, "id" | "idMal" | "title" | "coverImage"> | null;
    }[];
  };
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

const BASE_FIELDS = `id idMal title { english romaji } description(asHtml: false) bannerImage
  coverImage { extraLarge color } episodes duration averageScore seasonYear format status genres
  trailer { id site } nextAiringEpisode { episode timeUntilAiring }`;

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
      signal,
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

export const mediaByMalQuery = (malId: number) =>
  queryOptions({
    queryKey: ["anilist", "media", malId],
    staleTime: 30 * 60 * 1000,
    retry: shouldRetryAniListRequest,
    queryFn: async () => {
      const data = await request<{ Media: AniListMedia | null }>(
        `query ($id: Int) { Media(idMal: $id, type: ANIME) { ${BASE_FIELDS}
          studios(isMain: true) { nodes { name } }
          recommendations(perPage: 6, sort: RATING_DESC) { nodes { mediaRecommendation { id idMal title { english romaji } coverImage { extraLarge color } } } } } }`,
        { id: malId },
      );
      return data.Media;
    },
  });

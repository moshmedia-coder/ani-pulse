import { queryOptions } from "@tanstack/react-query";

const ENDPOINT = "https://graphql.anilist.co";

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
    nodes: { mediaRecommendation: Pick<AniListMedia, "id" | "idMal" | "title" | "coverImage"> | null }[];
  };
}

const BASE_FIELDS = `id idMal title { english romaji } description(asHtml: false) bannerImage
  coverImage { extraLarge color } episodes duration averageScore seasonYear format status genres
  trailer { id site } nextAiringEpisode { episode timeUntilAiring }`;

async function request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`AniList request failed (${res.status})`);
  const json = (await res.json()) as { data: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "AniList error");
  return json.data;
}

export const animeTitle = (m: Pick<AniListMedia, "title">) => m.title.english || m.title.romaji;
export const cleanDescription = (text: string | null) =>
  (text ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export const trendingQuery = () =>
  queryOptions({
    queryKey: ["anilist", "trending"],
    staleTime: 10 * 60 * 1000,
    retry: 1,
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
    retry: 1,
    queryFn: async () => {
      const data = await request<{ Media: AniListMedia }>(
        `query ($id: Int) { Media(idMal: $id, type: ANIME) { ${BASE_FIELDS}
          studios(isMain: true) { nodes { name } }
          recommendations(perPage: 6, sort: RATING_DESC) { nodes { mediaRecommendation { id idMal title { english romaji } coverImage { extraLarge color } } } } } }`,
        { id: malId },
      );
      return data.Media;
    },
  });

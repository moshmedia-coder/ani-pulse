import { describe, expect, it } from "vitest";
import {
  cleanMangaSynopsis,
  mangaAdaptationArtwork,
  mangaArtwork,
  mangaCredits,
  mangaPromotionalVideo,
  mangaPublicationDate,
  trustedAniListArtworkUrl,
} from "@/lib/manga-details";
import type { AniListMangaMedia } from "@/lib/anilist";

const baseManga: AniListMangaMedia = {
  id: 701,
  idMal: null,
  title: { english: "Example Manga", romaji: "Example Manga" },
  description: null,
  bannerImage: null,
  coverImage: { extraLarge: null, color: null },
  genres: [],
  averageScore: null,
  popularity: 0,
  chapters: null,
  volumes: null,
  status: null,
  startDate: null,
};

describe("manga details helpers", () => {
  it("cleans HTML tags, encoded markup, escaped line breaks, and spoiler formatting", () => {
    expect(
      cleanMangaSynopsis("<p>First chapter</p>&lt;p&gt;Second &amp; more&lt;/p&gt;\\n~!spoiler!~"),
    ).toBe("First chapter\n\nSecond & more\n\nspoiler");
  });

  it("separates creator and artist credits according to the AniList role", () => {
    const result = mangaCredits({
      ...baseManga,
      staff: {
        edges: [
          { role: "Story & Art", node: { name: { full: "Creator" } } },
          { role: "Art", node: { name: { full: "Artist" } } },
          { role: "Editor", node: { name: { full: "Editor" } } },
          { role: "Original Creator", node: { name: { full: "Creator" } } },
        ],
      },
    });

    expect(result.authors.map(({ name }) => name)).toEqual(["Creator"]);
    expect(result.artists.map(({ name }) => name)).toEqual(["Creator", "Artist"]);
  });

  it("formats available publication dates and hides absent dates", () => {
    expect(mangaPublicationDate({ year: 2024, month: 5, day: 9 })).toBe("May 9, 2024");
    expect(mangaPublicationDate({ year: 2024, month: null, day: null })).toBe("2024");
    expect(mangaPublicationDate(null)).toBeNull();
  });

  it("allows artwork only from secure AniList image hosts", () => {
    expect(
      trustedAniListArtworkUrl("https://s4.anilist.co/file/anilistcdn/media/manga/banner/1.jpg"),
    ).toBe("https://s4.anilist.co/file/anilistcdn/media/manga/banner/1.jpg");
    expect(trustedAniListArtworkUrl("http://s4.anilist.co/image.jpg")).toBeNull();
    expect(trustedAniListArtworkUrl("https://anilist.co.attacker.test/image.jpg")).toBeNull();
  });

  it("returns distinct cover and banner art once and gracefully omits missing artwork", () => {
    const cover = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/701.jpg";
    const banner = "https://s4.anilist.co/file/anilistcdn/media/manga/banner/701.jpg";
    expect(
      mangaArtwork(
        {
          ...baseManga,
          coverImage: { extraLarge: cover, color: null },
          bannerImage: banner,
        },
        "Example Manga",
      ),
    ).toEqual([
      { url: cover, alt: "Example Manga cover artwork" },
      { url: banner, alt: "Example Manga promotional banner artwork" },
    ]);
    expect(
      mangaArtwork(
        {
          ...baseManga,
          coverImage: { extraLarge: cover, color: null },
          bannerImage: `${cover}?utm_source=anilist`,
        },
        "Example Manga",
      ),
    ).toEqual([{ url: cover, alt: "Example Manga cover artwork" }]);
    expect(mangaArtwork(baseManga, "Example Manga")).toEqual([]);
  });

  it("returns cover and banner artwork only for explicitly related anime adaptations", () => {
    const cover = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/702.jpg";
    const banner = "https://s4.anilist.co/file/anilistcdn/media/anime/banner/702.jpg";
    const adaptation = {
      id: 702,
      type: "ANIME",
      title: { english: "Example Adaptation", romaji: "Adaptation Romaji" },
      coverImage: { extraLarge: cover },
      bannerImage: banner,
      trailer: null,
    };

    expect(
      mangaAdaptationArtwork({
        ...baseManga,
        relations: {
          edges: [{ relationType: "ADAPTATION", node: adaptation }],
        },
      }),
    ).toEqual([
      {
        id: 702,
        title: "Example Adaptation",
        artwork: [
          { url: cover, alt: "Example Adaptation anime adaptation cover artwork" },
          { url: banner, alt: "Example Adaptation anime adaptation banner artwork" },
        ],
      },
    ]);
  });

  it("ignores non-adaptation and non-anime relationships", () => {
    const relatedAnime = {
      id: 702,
      type: "ANIME",
      title: { english: "Related Anime", romaji: "Related Anime" },
      coverImage: { extraLarge: "https://s4.anilist.co/anime-cover.jpg" },
      bannerImage: "https://s4.anilist.co/anime-banner.jpg",
      trailer: null,
    };
    const relatedManga = {
      ...relatedAnime,
      id: 703,
      type: "MANGA",
    };

    expect(
      mangaAdaptationArtwork({
        ...baseManga,
        relations: {
          edges: [
            { relationType: "SOURCE", node: relatedAnime },
            { relationType: "ADAPTATION", node: relatedManga },
          ],
        },
      }),
    ).toEqual([]);
  });

  it("omits missing, invalid, manga-duplicate, and cross-adaptation duplicate artwork", () => {
    const mangaCover = "https://s4.anilist.co/file/manga-cover.jpg";
    const repeatedAnimeCover = "https://s4.anilist.co/file/shared-cover.jpg";
    const mangaBanner = "https://s4.anilist.co/file/manga-banner.jpg";
    const first = {
      id: 702,
      type: "ANIME",
      title: { english: "First Adaptation", romaji: "First Adaptation" },
      coverImage: { extraLarge: repeatedAnimeCover },
      bannerImage: mangaBanner,
      trailer: null,
    };
    const second = {
      id: 703,
      type: "ANIME",
      title: { english: "Second Adaptation", romaji: "Second Adaptation" },
      coverImage: { extraLarge: `${repeatedAnimeCover}?utm_source=anilist` },
      bannerImage: "https://example.test/untrusted.jpg",
      trailer: null,
    };
    const missing = {
      id: 704,
      type: "ANIME",
      title: { english: "No Artwork", romaji: "No Artwork" },
      coverImage: { extraLarge: null },
      bannerImage: null,
      trailer: null,
    };

    expect(
      mangaAdaptationArtwork(
        {
          ...baseManga,
          relations: {
            edges: [
              { relationType: "ADAPTATION", node: first },
              { relationType: "ADAPTATION", node: second },
              { relationType: "ADAPTATION", node: missing },
            ],
          },
        },
        [
          { url: mangaCover, alt: "Example Manga cover artwork" },
          { url: mangaBanner, alt: "Example Manga promotional banner artwork" },
        ],
      ),
    ).toEqual([
      {
        id: 702,
        title: "First Adaptation",
        artwork: [
          {
            url: repeatedAnimeCover,
            alt: "First Adaptation anime adaptation cover artwork",
          },
        ],
      },
    ]);
  });

  it("uses the manga's own verified trailer as a promotional video", () => {
    expect(
      mangaPromotionalVideo({
        ...baseManga,
        trailer: { site: "youtube", id: "tR8YH0G67Rk" },
      }),
    ).toEqual({
      videoId: "tR8YH0G67Rk",
      title: "Manga promotional video",
      kind: "promotion",
    });
  });

  it("uses an anime trailer only for a verified adaptation relation", () => {
    const relatedAnime = {
      id: 702,
      type: "ANIME",
      title: { english: "Example Adaptation", romaji: "Example Adaptation" },
      coverImage: { extraLarge: null },
      bannerImage: null,
      trailer: { site: "youtube", id: "tR8YH0G67Rk" },
    };
    expect(
      mangaPromotionalVideo({
        ...baseManga,
        relations: {
          edges: [{ relationType: "ADAPTATION", node: relatedAnime }],
        },
      }),
    ).toEqual({
      videoId: "tR8YH0G67Rk",
      title: "Example Adaptation anime adaptation trailer",
      kind: "adaptation",
    });
    expect(
      mangaPromotionalVideo({
        ...baseManga,
        relations: {
          edges: [{ relationType: "SOURCE", node: relatedAnime }],
        },
      }),
    ).toBeNull();
    expect(
      mangaPromotionalVideo({
        ...baseManga,
        trailer: { site: "youtube", id: "not-a-video-id" },
      }),
    ).toBeNull();
  });
});

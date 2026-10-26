import { QueryClient } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MangaReader } from "@/components/manga-reader";
import {
  mangaDetailsQuery,
  type AniListMangaExternalLink,
  type AniListMangaMedia,
} from "@/lib/anilist";
import { verifiedOfficialReadingLinks } from "@/lib/manga-reader";

const officialLinks: AniListMangaExternalLink[] = [
  {
    site: "MANGA Plus",
    url: "https://mangaplus.shueisha.co.jp/title/1",
    type: "INFO",
    language: "English",
  },
];

function renderReader(links?: AniListMangaExternalLink[] | null) {
  return render(<MangaReader {...(links !== undefined ? { externalLinks: links } : {})} />);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("manga official reading links", () => {
  it("opens a verified title link in a new tab with a named publisher action", () => {
    renderReader(officialLinks);

    const link = screen.getByRole("link", { name: "Read on MANGA Plus" });
    expect(link).toHaveAttribute("href", officialLinks[0]?.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("English edition")).toBeVisible();
  });

  it("shows the required fallback and no action when no verified title link exists", () => {
    renderReader([
      {
        site: "Unverified",
        url: "https://example.test/manga/1",
        type: "INFO",
        language: null,
      },
    ]);

    expect(screen.getByText("No verified official reading source is available yet.")).toBeVisible();
    expect(screen.queryByRole("link", { name: /Read on/ })).not.toBeInTheDocument();
  });

  it("shows the fallback when AniList has no external reading links", () => {
    renderReader(null);

    expect(screen.getByText("No verified official reading source is available yet.")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("accepts trusted publisher URLs and rejects unsafe or lookalike destinations", () => {
    expect(
      verifiedOfficialReadingLinks([
        ...officialLinks,
        {
          site: "Tapas",
          url: "https://tapas.io/series/blue-period",
          type: "INFO",
          language: "English",
        },
        {
          site: "WEBTOON",
          url: "https://www.webtoons.com/en/fantasy/blue-period/list?title_no=123",
          type: "INFO",
          language: "English",
        },
        {
          site: "VIZ",
          url: "https://www.viz.com/read/manga",
          type: "INFO",
          language: "English",
        },
        {
          site: "Lookalike",
          url: "https://mangaplus.shueisha.co.jp.attacker.test/title/1",
          type: "INFO",
          language: null,
        },
        {
          site: "Insecure",
          url: "http://viz.com/title/1",
          type: "INFO",
          language: null,
        },
        {
          site: "VIZ",
          url: "https://www.viz.com/social/account",
          type: "SOCIAL",
          language: null,
        },
        {
          site: "Credentials",
          url: "https://user@viz.com/title/1",
          type: "INFO",
          language: null,
        },
        {
          site: "Nonstandard port",
          url: "https://viz.com:8443/title/1",
          type: "INFO",
          language: null,
        },
        { ...officialLinks[0]!, site: "Duplicate" },
        {
          site: "Tapas",
          url: "https://tapas.io/series/blue-period?utm_source=test",
          type: "INFO",
          language: null,
        },
      ]),
    ).toEqual([
      {
        site: "MANGA Plus",
        url: "https://mangaplus.shueisha.co.jp/title/1",
        language: "English",
      },
      {
        site: "Tapas",
        url: "https://tapas.io/series/blue-period",
        language: "English",
      },
      {
        site: "WEBTOON",
        url: "https://www.webtoons.com/en/fantasy/blue-period/list?title_no=123",
        language: "English",
      },
      {
        site: "VIZ",
        url: "https://www.viz.com/read/manga",
        language: "English",
      },
    ]);
  });

  it("loads manga metadata, author credits, and external links from AniList", async () => {
    const media = {
      id: 701,
      idMal: null,
      title: { english: "Example Manga", romaji: "Example Manga" },
      description: "Test synopsis",
      bannerImage: null,
      coverImage: { extraLarge: null, color: null },
      genres: ["Fantasy"],
      averageScore: 88,
      popularity: 100,
      chapters: 12,
      volumes: 2,
      status: "FINISHED",
      startDate: null,
      endDate: null,
      format: "MANGA",
      countryOfOrigin: "JP",
      trailer: null,
      relations: { edges: [] },
      tags: [],
      staff: {
        edges: [{ role: "Story & Art", node: { name: { full: "Creator Name" } } }],
      },
      externalLinks: officialLinks,
    } satisfies AniListMangaMedia;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { Media: media } }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient();

    const result = await client.fetchQuery(mangaDetailsQuery(701));

    expect(result).toMatchObject({
      id: 701,
      staff: { edges: [{ node: { name: { full: "Creator Name" } } }] },
      externalLinks: [{ site: "MANGA Plus" }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
      variables: { id: number; type: string };
    };
    expect(body.variables).toEqual({ id: 701, type: "MANGA" });
    expect(body.query).toContain("title { native }");
    expect(body.query).toContain("format countryOfOrigin endDate { year month day }");
    expect(body.query).toContain("trailer { id site }");
    expect(body.query).toContain("relations { edges");
    expect(body.query).toContain("coverImage { extraLarge } bannerImage trailer { id site }");
    expect(body.query).toContain("staff(sort: RELEVANCE, perPage: 25)");
    expect(body.query).toContain("externalLinks { site url type language }");
    client.clear();
  });
});

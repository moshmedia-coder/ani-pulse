import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimeHome } from "@/components/anime-home";
import { recentEndDateCutoff } from "@/lib/anilist";

function media(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    idMal: 901,
    title: { english: "Catalog Real Title", romaji: "Catalog Real Title" },
    description: "A real synopsis<br>from AniList.",
    bannerImage: null,
    coverImage: { extraLarge: "https://example.test/catalog-cover.jpg", color: null },
    episodes: 12,
    duration: 24,
    averageScore: 84,
    popularity: 500,
    seasonYear: 2024,
    startDate: { year: 2025, month: 3, day: 4 },
    endDate: { year: 2025, month: 9, day: 10 },
    format: "TV",
    status: "FINISHED",
    genres: ["Adventure", "Fantasy"],
    trailer: null,
    ...overrides,
  };
}

function pageResponse(media: unknown[], page = 1, total = media.length) {
  return new Response(
    JSON.stringify({
      data: {
        Page: {
          media,
          pageInfo: {
            total,
            currentPage: page,
            lastPage: Math.max(1, Math.ceil(total / 12)),
            hasNextPage: page < Math.ceil(total / 12),
            perPage: 12,
          },
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function recentDateAfterCutoff() {
  const cutoff = recentEndDateCutoff();
  const date = new Date(
    Date.UTC(
      Math.floor(cutoff / 10000),
      Math.floor((cutoff % 10000) / 100) - 1,
      (cutoff % 100) + 1,
    ),
  );
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function successfulFetch() {
  const newer = media({
    id: 2,
    idMal: 902,
    title: { english: "Recently Finished", romaji: "Recently Finished" },
    endDate: recentDateAfterCutoff(),
  });
  const older = media({
    id: 3,
    idMal: 903,
    title: { english: "Another Recent Finish", romaji: "Another Recent Finish" },
    endDate: recentDateAfterCutoff(),
  });
  const old = media({
    id: 4,
    idMal: 904,
    title: { english: "Old Finish", romaji: "Old Finish" },
    endDate: { year: 2020, month: 1, day: 1 },
  });
  const scoredMovie = media({
    id: 5,
    idMal: 905,
    title: { english: "Scored Movie", romaji: "Scored Movie" },
    format: "MOVIE",
    averageScore: 91,
  });
  const unscoredMovie = media({
    id: 6,
    idMal: 906,
    title: { english: "Unscored Movie", romaji: "Unscored Movie" },
    format: "MOVIE",
    averageScore: null,
  });

  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      query: string;
      variables: {
        page?: number;
        sort?: string;
        search?: string | null;
        genres?: string[] | null;
        status?: string | null;
        format?: string | null;
      };
    };
    if (body.query.includes("airingSchedules")) {
      return new Response(
        JSON.stringify({
          data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    if (body.query.includes("Media(idMal:")) {
      return new Response(JSON.stringify({ data: { Media: null } }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (body.variables.status === "FINISHED") {
      return pageResponse([old, newer, older]);
    }
    if (body.variables.format === "MOVIE") {
      return pageResponse([unscoredMovie, scoredMovie]);
    }
    if (body.variables.sort === "POPULARITY_DESC") {
      return pageResponse([
        media({
          id: 7,
          idMal: 907,
          title: { english: "Popular AniList Pick", romaji: "Popular AniList Pick" },
        }),
      ]);
    }
    if (body.variables.sort === "TRENDING_DESC") return pageResponse([]);
    let catalog = [
      media(),
      media({
        id: 8,
        idMal: 908,
        title: { english: "Second Catalog Title", romaji: "Second Catalog Title" },
        genres: ["Action"],
      }),
    ];
    if (body.variables.search) {
      catalog = catalog.filter((item) =>
        item.title.english.toLowerCase().includes(body.variables.search!.toLowerCase()),
      );
    }
    if (body.variables.genres?.length) {
      catalog = catalog.filter((item) =>
        body.variables.genres?.some((genre) => item.genres.includes(genre)),
      );
    }
    return pageResponse(catalog, body.variables.page ?? 1, 25);
  });
}

const originalScrollIntoView = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollIntoView",
);

async function renderHome(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: AnimeHome,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();
  const result = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, client };
}

function homepageSection(title: string) {
  const heading = screen.getByRole("heading", { name: title });
  return within(heading.closest("section")!);
}

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  }
});

describe("homepage AniList discovery", () => {
  it("uses AniList catalog metadata and real popularity, completion, and movie rankings", async () => {
    const fetchMock = successfulFetch();
    await renderHome(fetchMock);

    const catalog = screen.getByRole("region", { name: "Browse the catalog" });
    const catalogCard = await within(catalog).findByRole("button", {
      name: "Details for Catalog Real Title",
    });
    const catalogArticle = within(catalogCard.closest("article")!);
    expect(within(catalog).getByAltText("Catalog Real Title")).toHaveAttribute(
      "src",
      "https://example.test/catalog-cover.jpg",
    );
    expect(catalogArticle.getByText("A real synopsis from AniList.")).toBeVisible();
    expect(catalogArticle.getByText("Adventure · Fantasy")).toBeVisible();
    expect(catalogArticle.getByText("2025")).toBeVisible();
    expect(catalogArticle.getByText("8.4")).toBeVisible();

    const popular = homepageSection("Popular picks");
    const popularPick = await popular.findByRole("button", { name: /Popular AniList Pick/ });
    expect(popularPick).toBeVisible();
    expect(within(popularPick).getByText("8.4")).toBeVisible();
    expect(within(popularPick).queryByText("Adventure · Fantasy")).not.toBeInTheDocument();
    const finished = homepageSection("Just finished");
    const finishedItems = await finished.findAllByRole("button");
    expect(finishedItems[0]).toHaveTextContent("Recently Finished");
    expect(finishedItems[1]).toHaveTextContent("Another Recent Finish");
    expect(finished.queryByRole("button", { name: /Old Finish/ })).not.toBeInTheDocument();
    const movies = homepageSection("Top movies");
    expect(await movies.findByRole("button", { name: /Scored Movie/ })).toBeVisible();
    expect(movies.queryByRole("button", { name: /Unscored Movie/ })).not.toBeInTheDocument();

    const bodies = fetchMock.mock.calls.map(
      (call) =>
        JSON.parse(String(call[1]?.body)) as {
          variables: { sort?: string; status?: string | null; format?: string | null };
        },
    );
    expect(bodies.some(({ variables }) => variables.sort === "POPULARITY_DESC")).toBe(true);
    expect(
      bodies.some(
        ({ variables }) => variables.sort === "END_DATE_DESC" && variables.status === "FINISHED",
      ),
    ).toBe(true);
    expect(
      bodies.some(
        ({ variables }) => variables.sort === "SCORE_DESC" && variables.format === "MOVIE",
      ),
    ).toBe(true);

    fireEvent.click(catalogCard);
    expect(await screen.findByRole("heading", { name: "Catalog Real Title" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Watch now" })).toHaveAttribute("href", "/watch/901");
  }, 30000);

  it("keeps compact Popular picks metadata to title, type, year, and score", async () => {
    await renderHome(successfulFetch());

    const popularPick = await homepageSection("Popular picks").findByRole("button", {
      name: /Popular AniList Pick/,
    });

    expect(popularPick).toHaveTextContent("Popular AniList Pick");
    expect(within(popularPick).getByText("TV")).toBeVisible();
    expect(within(popularPick).getByText("2025")).toBeVisible();
    expect(within(popularPick).getByText("8.4")).toBeVisible();
    expect(within(popularPick).queryByText("Adventure · Fantasy")).not.toBeInTheDocument();
    expect(within(popularPick).queryByText("12")).not.toBeInTheDocument();
  }, 30000);

  it("preserves genre, sort, search, and paginated catalog interactions", async () => {
    const fetchMock = successfulFetch();
    await renderHome(fetchMock);
    const catalog = screen.getByRole("region", { name: "Browse the catalog" });
    await within(catalog).findByRole("button", { name: "Details for Catalog Real Title" });

    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) =>
          (
            JSON.parse(String(call[1]?.body)) as {
              variables: { genres?: string[] };
            }
          ).variables.genres?.includes("Action"),
        ),
      ).toBe(true),
    );
    fireEvent.click(within(catalog).getByRole("button", { name: "TOP RATED" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            (
              JSON.parse(String(call[1]?.body)) as {
                variables: { sort?: string; genres?: string[] };
              }
            ).variables.sort === "SCORE_DESC",
        ),
      ).toBe(true),
    );
    fireEvent.click(within(catalog).getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            (
              JSON.parse(String(call[1]?.body)) as {
                variables: { page?: number; sort?: string };
              }
            ).variables.page === 2,
        ),
      ).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: "All genres" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search anime" }), {
      target: { value: "catalog real" },
    });
    await waitFor(
      () =>
        expect(
          fetchMock.mock.calls.some(
            (call) =>
              (
                JSON.parse(String(call[1]?.body)) as {
                  variables: { search?: string | null };
                }
              ).variables.search === "catalog real",
          ),
        ).toBe(true),
      { timeout: 3000 },
    );
    expect(
      await within(catalog).findByRole("button", { name: "Details for Catalog Real Title" }),
    ).toBeVisible();
  }, 30000);

  it("announces loading, empty, errors, and permits query recovery", async () => {
    const pendingRequests: ((response: Response) => void)[] = [];
    const pendingFetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((resolve) => {
          const body = JSON.parse(String(init.body)) as { query: string };
          if (body.query.includes("airingSchedules")) {
            resolve(
              new Response(
                JSON.stringify({
                  data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } },
                }),
              ),
            );
          } else {
            pendingRequests.push(resolve);
          }
        }),
    );
    await renderHome(pendingFetch);
    expect(
      within(screen.getByRole("region", { name: "Browse the catalog" })).getByText(
        "Loading AniList catalog…",
      ),
    ).toBeVisible();
    expect(homepageSection("Popular picks").getByRole("status")).toHaveTextContent(
      "Loading AniList results",
    );
    cleanup();
    for (const resolve of pendingRequests) resolve(pageResponse([]));

    const emptyFetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { query: string };
      if (body.query.includes("airingSchedules")) {
        return new Response(
          JSON.stringify({
            data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } },
          }),
        );
      }
      return pageResponse([]);
    });
    await renderHome(emptyFetch);
    expect(
      await homepageSection("Popular picks").findByText(
        "No popular anime are available right now.",
      ),
    ).toBeVisible();
    expect(homepageSection("Just finished").getByRole("status")).toHaveTextContent(
      "No anime finished in the last 180 days",
    );
    expect(homepageSection("Top movies").getByRole("status")).toHaveTextContent(
      "No scored anime movies are available",
    );
    cleanup();

    let discoveryRequests = 0;
    const recoveryFetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { query: string };
      if (body.query.includes("airingSchedules")) {
        return new Response(
          JSON.stringify({
            data: { Page: { pageInfo: { hasNextPage: false }, airingSchedules: [] } },
          }),
        );
      }
      if (body.query.includes("$sort: MediaSort")) {
        discoveryRequests += 1;
      }
      if (body.query.includes("$sort: MediaSort") && discoveryRequests <= 4) {
        return new Response("{}", { status: 429 });
      }
      return pageResponse([]);
    });
    await renderHome(recoveryFetch);
    const popular = homepageSection("Popular picks");
    expect(await popular.findByText("AniList results are temporarily unavailable.")).toBeVisible();
    fireEvent.click(popular.getByRole("button", { name: "Try again" }));
    expect(await popular.findByText("No popular anime are available right now.")).toBeVisible();
    expect(discoveryRequests).toBeGreaterThan(4);
  }, 30000);
});

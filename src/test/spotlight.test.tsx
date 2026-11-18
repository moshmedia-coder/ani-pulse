import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimeHome } from "@/components/anime-home";
import { animeCatalog } from "@/lib/anime-data";
import {
  airingScheduleQuery,
  mediaByMalQuery,
  trendingQuery,
  type AniListMedia,
} from "@/lib/anilist";

function media(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 900,
    idMal: 888888,
    title: { english: "AniList Spotlight", romaji: "Spotlight Anime" },
    description: "A real AniList synopsis.",
    bannerImage: "https://example.test/spotlight-banner.jpg",
    coverImage: { extraLarge: "https://example.test/spotlight-cover.jpg", color: null },
    episodes: 12,
    duration: 24,
    averageScore: 91,
    seasonYear: 2025,
    format: "TV",
    status: "FINISHED",
    genres: ["Drama", "Mystery"],
    trailer: null,
    ...overrides,
  };
}

async function renderHome(client: QueryClient) {
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

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity, staleTime: Infinity } },
  });
}

function spotlightElement() {
  return screen.getByRole("region", { name: "Featured anime" });
}

function spotlight() {
  return within(spotlightElement());
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("homepage spotlight", () => {
  it("starts with Overgeared when live data arrives, without showing the fallback first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const client = createClient();
    await renderHome(client);

    const hero = spotlight();
    expect(hero.getByRole("heading", { level: 1, name: "Loading featured anime…" })).toBeVisible();
    expect(
      hero.queryByRole("heading", { level: 1, name: animeCatalog[0]!.title }),
    ).not.toBeInTheDocument();

    await act(async () => {
      await client.cancelQueries({ queryKey: trendingQuery().queryKey });
      client.setQueryData(trendingQuery().queryKey, [
        media({
          id: 901,
          idMal: 52991,
          title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
        }),
        media({
          id: 902,
          idMal: 64340,
          title: { english: "Overgeared", romaji: "Tempal: Item no Chikara" },
        }),
        media({
          id: 903,
          idMal: 888889,
          title: { english: "Second Spotlight", romaji: "Second Spotlight" },
        }),
      ]);
    });

    await waitFor(() =>
      expect(hero.getByRole("heading", { level: 1, name: "Overgeared" })).toBeVisible(),
    );
    expect(hero.getByRole("status")).toHaveTextContent("Featured from AniList trending");
    client.clear();
  });

  it("keeps seven distinct live titles in stable order and wraps navigation", async () => {
    const liveTitles = [
      { id: 920, idMal: 888900, title: "First Spotlight" },
      { id: 921, idMal: 888901, title: "Second Spotlight" },
      { id: 922, idMal: 64340, title: "Overgeared" },
      { id: 923, idMal: 888903, title: "Fourth Spotlight" },
      { id: 924, idMal: 888904, title: "Fifth Spotlight" },
      { id: 925, idMal: 888905, title: "Sixth Spotlight" },
      { id: 926, idMal: 888906, title: "Seventh Spotlight" },
    ];
    const client = createClient();
    client.setQueryData(
      trendingQuery().queryKey,
      liveTitles.map((entry) =>
        media({
          id: entry.id,
          idMal: entry.idMal,
          title: { english: entry.title, romaji: entry.title },
        }),
      ),
    );

    await renderHome(client);

    const hero = spotlight();
    const expectedTitles = [
      "Overgeared",
      "First Spotlight",
      "Second Spotlight",
      "Fourth Spotlight",
      "Fifth Spotlight",
      "Sixth Spotlight",
      "Seventh Spotlight",
    ] as const;
    await waitFor(() =>
      expect(hero.getByRole("heading", { level: 1, name: expectedTitles[0] })).toBeVisible(),
    );
    expect(hero.getByText("01", { exact: true })).toBeVisible();
    expect(hero.getByText("/ 07", { exact: true })).toBeVisible();

    const visitedTitles: string[] = [expectedTitles[0]];
    for (const title of expectedTitles.slice(1)) {
      fireEvent.click(hero.getByRole("button", { name: "Next featured anime" }));
      expect(hero.getByRole("heading", { level: 1, name: title })).toBeVisible();
      visitedTitles.push(title);
    }
    fireEvent.click(hero.getByRole("button", { name: "Next featured anime" }));
    expect(hero.getByRole("heading", { level: 1, name: "Overgeared" })).toBeVisible();
    expect(new Set(visitedTitles).size).toBe(7);
    client.clear();
  });

  it("fills short live results with distinct local catalog entries", async () => {
    const client = createClient();
    client.setQueryData(trendingQuery().queryKey, [
      media({
        id: 930,
        idMal: 64340,
        title: { english: "Overgeared", romaji: "Tempal: Item no Chikara" },
      }),
      media({ id: 931, idMal: animeCatalog[0]!.id }),
      media({
        id: 932,
        idMal: 888932,
        title: { english: "Third Live Title", romaji: "Third Live Title" },
      }),
    ]);

    await renderHome(client);

    const hero = spotlight();
    await waitFor(() =>
      expect(hero.getByRole("heading", { level: 1, name: "Overgeared" })).toBeVisible(),
    );
    const titles = ["Overgeared"];
    for (let index = 1; index < 7; index += 1) {
      fireEvent.click(hero.getByRole("button", { name: "Next featured anime" }));
      titles.push(hero.getByRole("heading", { level: 1 }).textContent ?? "");
    }
    expect(hero.getByText("/ 07", { exact: true })).toBeVisible();
    expect(new Set(titles).size).toBe(7);
    expect(titles).toContain(animeCatalog[0]!.title);
    client.clear();
  });

  it("renders live AniList metadata, excludes local catalog entries, and links to the MAL route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const client = createClient();
    client.setQueryData(trendingQuery().queryKey, [
      media({ id: 899, idMal: animeCatalog[0]!.id }),
      media(),
      media({
        id: 901,
        idMal: 888889,
        title: { english: "Second Spotlight", romaji: "Second Spotlight" },
        status: "RELEASING",
      }),
    ]);

    await renderHome(client);

    const hero = spotlight();
    await waitFor(() =>
      expect(hero.getByRole("heading", { level: 1, name: "AniList Spotlight" })).toBeVisible(),
    );
    expect(hero.getByText("A real AniList synopsis.")).toBeVisible();
    expect(hero.queryByText("FINISHED · FEATURED")).not.toBeInTheDocument();
    expect(hero.queryByText("Drama · Mystery")).not.toBeInTheDocument();
    expect(hero.getByText("2025")).toBeVisible();
    expect(hero.getByText("9.1")).toBeVisible();
    expect(hero.getByText("24 min")).toBeVisible();
    expect(hero.getByRole("img", { name: "AniList Spotlight" })).toHaveAttribute(
      "src",
      "https://example.test/spotlight-banner.jpg",
    );
    expect(hero.getByRole("link", { name: "Watch now" })).toHaveAttribute("href", "/watch/888888");
    expect(hero.getByRole("status")).toHaveTextContent("Featured from AniList trending");

    fireEvent.click(hero.getByRole("button", { name: "Next featured anime" }));
    expect(hero.getByRole("heading", { level: 1, name: "Second Spotlight" })).toBeVisible();
    expect(hero.queryByText("AIRING · FEATURED")).not.toBeInTheDocument();
    fireEvent.click(hero.getByRole("button", { name: "Details" }));
    expect(await screen.findByText("Drama · Mystery")).toBeVisible();
    client.clear();
  }, 15000);

  it("keeps long titles and synopses inside the featured content", async () => {
    const longTitle =
      "A Very Long Featured Anime Title That Would Otherwise Take Over the Spotlight";
    const longDescription =
      "A detailed synopsis that continues beyond the available hero space. ".repeat(20);
    const client = createClient();
    client.setQueryData(trendingQuery().queryKey, [
      media({
        title: { english: longTitle, romaji: longTitle },
        description: longDescription,
      }),
    ]);

    await renderHome(client);

    const hero = spotlight();
    expect(hero.getByRole("heading", { level: 1, name: longTitle })).toBeVisible();
    expect(hero.getByText(/A detailed synopsis/)).toHaveTextContent("available hero space");
    expect(hero.getByRole("link", { name: "Watch now" })).toBeVisible();
    client.clear();
  });

  it("ranks real AniList picks from local viewing genres and excludes watched titles", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, []);
    client.setQueryData(trendingQuery().queryKey, [
      media({
        id: 910,
        idMal: 52991,
        title: { english: "Already Watched", romaji: "Already Watched" },
        genres: ["Adventure", "Drama"],
      }),
      media({
        id: 911,
        idMal: 888901,
        title: { english: "Action Only", romaji: "Action Only" },
        genres: ["Action"],
      }),
      media({
        id: 912,
        idMal: 888902,
        title: { english: "One Genre Match", romaji: "One Genre Match" },
        genres: ["Adventure"],
      }),
      media({
        id: 913,
        idMal: 888903,
        title: { english: "Best Genre Match", romaji: "Best Genre Match" },
        genres: ["Adventure", "Drama"],
      }),
    ]);
    sessionStorage.setItem("anipulse-watched-52991", JSON.stringify([1]));

    await renderHome(client);

    const recommendations = screen.getByRole("heading", {
      name: "Recommended for you",
    }).parentElement!;
    expect(within(recommendations).getAllByRole("button")[0]).toHaveTextContent("Best Genre Match");
    expect(
      within(recommendations).queryByRole("button", { name: /Already Watched/ }),
    ).not.toBeInTheDocument();
    expect(
      within(recommendations).queryByRole("button", { name: /Action Only/ }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[1]?.body).includes("TRENDING_DESC"),
      ),
    ).toBe(false);
    client.clear();
  }, 30000);

  it("labels trending picks as a new-user fallback when there is no activity", async () => {
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, []);
    client.setQueryData(trendingQuery().queryKey, [media()]);

    await renderHome(client);

    expect(screen.getByRole("heading", { name: "Popular anime · new here" })).toBeVisible();
    client.clear();
  });

  it("shows a saved live Spotlight title in the session watchlist", async () => {
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, []);
    client.setQueryData(trendingQuery().queryKey, [media()]);

    try {
      await renderHome(client);

      fireEvent.click(spotlight().getByRole("button", { name: "Add to watchlist" }));
      fireEvent.click(screen.getByRole("button", { name: "Your watchlist" }));

      expect(screen.getByRole("button", { name: "Details for AniList Spotlight" })).toBeVisible();
      expect(
        within(screen.getByRole("region", { name: "Browse the catalog" })).getByRole("status"),
      ).toHaveTextContent("1 of 1 titles");
      client.clear();
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
      }
    }
  }, 30000);

  it("uses local catalog picks when AniList has no usable results", async () => {
    const client = createClient();
    client.setQueryData(trendingQuery().queryKey, []);

    await renderHome(client);

    const hero = spotlight();
    await waitFor(() =>
      expect(hero.getByRole("heading", { level: 1, name: animeCatalog[0]!.title })).toBeVisible(),
    );
    expect(hero.getByRole("status")).toHaveTextContent("Showing AniPulse catalog picks");
    expect(hero.getByRole("link", { name: "Watch now" })).toHaveAttribute(
      "href",
      `/watch/${animeCatalog[0]!.id}`,
    );
    client.clear();
  });

  it("announces loading without briefly showing an incorrect fallback anime", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const client = createClient();

    await renderHome(client);

    const hero = spotlight();
    expect(hero.getByRole("heading", { level: 1, name: "Loading featured anime…" })).toBeVisible();
    expect(
      hero.queryByRole("heading", { level: 1, name: animeCatalog[0]!.title }),
    ).not.toBeInTheDocument();
    expect(hero.getByRole("status")).toHaveTextContent("Loading featured anime");
    client.clear();
  });

  it("uses local catalog picks when the AniList request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const client = createClient();

    await renderHome(client);

    const hero = spotlight();
    await waitFor(() => {
      expect(hero.getByRole("heading", { level: 1, name: animeCatalog[0]!.title })).toBeVisible();
      expect(hero.getByRole("status")).toHaveTextContent("Showing AniPulse catalog picks");
    });
    client.clear();
  }, 15000);

  it("gracefully omits unavailable optional live metadata", async () => {
    const client = createClient();
    client.setQueryData(trendingQuery().queryKey, [
      media({
        title: { english: null, romaji: "Untitled English Version" },
        description: null,
        bannerImage: null,
        coverImage: { extraLarge: "https://example.test/cover.jpg", color: null },
        episodes: null,
        averageScore: null,
        seasonYear: null,
        format: null,
        genres: [],
      }),
    ]);

    await renderHome(client);

    const hero = spotlight();
    await waitFor(() =>
      expect(
        hero.getByRole("heading", { level: 1, name: "Untitled English Version" }),
      ).toBeVisible(),
    );
    expect(hero.getByRole("img", { name: "Untitled English Version" })).toHaveAttribute(
      "src",
      "https://example.test/cover.jpg",
    );
    expect(hero.queryByText(/A real AniList synopsis/)).not.toBeInTheDocument();
    expect(spotlightElement().textContent).not.toMatch(/NaN|undefined/);
    expect(hero.getByRole("link", { name: "Watch now" })).toHaveAttribute("href", "/watch/888888");
    client.clear();
  });
});

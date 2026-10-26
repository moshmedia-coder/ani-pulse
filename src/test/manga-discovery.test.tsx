import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AniPulseMenu } from "@/components/anipulse-menu";
import { MangaDiscovery } from "@/components/manga-discovery";
import { mangaDiscoveryQuery, mangaSearchQuery, type AniListMangaMedia } from "@/lib/anilist";

function manga(overrides: Partial<AniListMangaMedia> = {}): AniListMangaMedia {
  return {
    id: 701,
    idMal: 702,
    title: { english: "AniList Manga", romaji: "Manga Title" },
    description: "A real manga description.",
    bannerImage: null,
    coverImage: { extraLarge: "https://example.test/manga-cover.jpg", color: null },
    genres: ["Fantasy", "Adventure"],
    averageScore: 88,
    popularity: 12345,
    chapters: 40,
    volumes: 5,
    status: "RELEASING",
    startDate: { year: 2022, month: 3, day: 4 },
    ...overrides,
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
}

async function renderMangaPage(client: QueryClient) {
  const rootRoute = createRootRoute();
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const mangaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/manga",
    component: MangaDiscovery,
  });
  const mangaDetailRoute = createRoute({
    getParentRoute: () => mangaRoute,
    path: "$mangaId",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, mangaRoute.addChildren([mangaDetailRoute])]),
    history: createMemoryHistory({ initialEntries: ["/manga"] }),
  });
  await router.load();

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function setEmptySections(client: QueryClient) {
  for (const sort of ["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC"] as const) {
    client.setQueryData(mangaDiscoveryQuery(sort).queryKey, []);
  }
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Manga discovery page", () => {
  it("renders manga sections and links cards to in-app manga details", async () => {
    const client = createClient();
    const entry = manga();
    client.setQueryData(mangaDiscoveryQuery("TRENDING_DESC").queryKey, [entry]);
    client.setQueryData(mangaDiscoveryQuery("POPULARITY_DESC").queryKey, [entry]);
    client.setQueryData(mangaDiscoveryQuery("SCORE_DESC").queryKey, [entry]);

    await renderMangaPage(client);

    expect(
      screen.getByRole("heading", { level: 1, name: "Discover your next manga obsession." }),
    ).toBeVisible();
    for (const name of ["Trending Manga", "Popular Manga", "Top-Rated Manga"]) {
      const section = screen.getByRole("region", { name });
      expect(within(section).getByRole("heading", { name })).toBeVisible();
      expect(
        within(section).getByRole("heading", { level: 3, name: "AniList Manga" }),
      ).toBeVisible();
      expect(
        within(section).getByRole("link", { name: "Open AniList Manga manga details" }),
      ).toHaveAttribute("href", "/manga/701");
      expect(within(section).getByText("8.8")).toBeVisible();
      expect(within(section).getByText("40 chapters")).toBeVisible();
      expect(within(section).getByText("5 volumes")).toBeVisible();
    }
    expect(screen.getByRole("link", { name: "AniPulse home" })).toHaveAttribute("href", "/");
    client.clear();
  });

  it("shows loading, error, and empty states without fabricated results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    const loadingClient = createClient();
    await renderMangaPage(loadingClient);
    expect(screen.getByRole("status", { name: "Loading Trending Manga" })).toBeVisible();
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument();
    cleanup();
    loadingClient.clear();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const errorClient = createClient();
    await renderMangaPage(errorClient);
    expect(await screen.findAllByRole("alert")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(3);
    cleanup();
    errorClient.clear();

    vi.unstubAllGlobals();
    const emptyClient = createClient();
    setEmptySections(emptyClient);
    await renderMangaPage(emptyClient);
    expect(screen.getAllByRole("status")).toHaveLength(3);
    expect(screen.getAllByText("No manga are available in this section right now.")).toHaveLength(
      3,
    );
    emptyClient.clear();
  });

  it("searches only manga and links results to AniList", async () => {
    const result = manga({ id: 801, title: { english: null, romaji: "Search Manga" } });
    const client = createClient();
    setEmptySections(client);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { Page: { media: [result] } } })));
    vi.stubGlobal("fetch", fetchMock);

    await renderMangaPage(client);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search manga on AniList" }), {
      target: { value: "  Blue   Period " },
    });

    const searchSection = await screen.findByRole("region", { name: "Search results" });
    expect(
      await within(searchSection).findByRole("heading", { level: 3, name: "Search Manga" }),
    ).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
      variables: { search: string; type: string };
    };
    expect(body.variables).toEqual({ search: "blue period", type: "MANGA" });
    expect(body.query).toContain("type: $type");
    expect(
      within(searchSection).getByRole("link", { name: "Open Search Manga manga details" }),
    ).toHaveAttribute("href", "/manga/801");
    client.clear();
  });

  it("handles a missing manga cover and optional score gracefully", async () => {
    const client = createClient();
    const entry = manga({
      coverImage: { extraLarge: null, color: null },
      averageScore: null,
      chapters: null,
      volumes: null,
      startDate: null,
    });
    client.setQueryData(mangaDiscoveryQuery("TRENDING_DESC").queryKey, [entry]);
    client.setQueryData(mangaDiscoveryQuery("POPULARITY_DESC").queryKey, []);
    client.setQueryData(mangaDiscoveryQuery("SCORE_DESC").queryKey, []);

    await renderMangaPage(client);

    const section = screen.getByRole("region", { name: "Trending Manga" });
    expect(
      within(section).getByRole("link", { name: "Open AniList Manga manga details" }),
    ).toBeVisible();
    expect(within(section).queryByText("8.8")).not.toBeInTheDocument();
    expect(section.querySelector(".manga-cover-placeholder")).not.toBeNull();
    client.clear();
  });

  it("provides Manga navigation from the existing menu", () => {
    const onNavigate = vi.fn();
    render(
      <AniPulseMenu
        open
        onOpenChange={vi.fn()}
        onNavigate={onNavigate}
        paused={false}
        togglePaused={vi.fn()}
        savedCount={0}
        historyCount={0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Manga" }));

    expect(onNavigate).toHaveBeenCalledWith("Manga");
  });
});

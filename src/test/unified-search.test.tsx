import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimeHome } from "@/components/anime-home";
import { animeCatalog, matchesAnimeSearch } from "@/lib/anime-data";

const liveMedia = [
  {
    id: 1,
    idMal: 52991,
    title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
    coverImage: { extraLarge: "https://example.test/frieren.jpg", color: null },
    averageScore: 93,
    seasonYear: 2023,
    format: "TV",
    status: "FINISHED",
    genres: ["Adventure", "Drama", "Fantasy"],
  },
  {
    id: 2,
    idMal: 888888,
    title: { english: "New from AniList", romaji: "AniList New" },
    coverImage: { extraLarge: "https://example.test/new.jpg", color: null },
    averageScore: 82,
    seasonYear: 2025,
    format: "TV",
    status: "RELEASING",
    genres: ["Action"],
  },
  {
    id: 3,
    idMal: null,
    title: { english: "No Watch Route", romaji: "No Route" },
    coverImage: { extraLarge: "https://example.test/no-route.jpg", color: null },
    averageScore: null,
    seasonYear: null,
    format: "TV",
    status: "FINISHED",
    genres: ["Action"],
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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
    <>
      <input aria-label="Unrelated editable field" />
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </>,
  );
  return { ...result, client };
}

function successfulSearchFetch() {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { query: string };
    if (body.query.includes("search:")) {
      return jsonResponse({ data: { Page: { media: liveMedia } } });
    }
    return jsonResponse({ data: { Page: { media: [] } } });
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("unified anime search", () => {
  it("matches local catalog fields and updates local results immediately", async () => {
    const frieren = animeCatalog.find((anime) => anime.id === 52991)!;
    expect(matchesAnimeSearch(frieren, "fantasy")).toBe(true);
    expect(matchesAnimeSearch(frieren, "tv")).toBe(true);
    expect(matchesAnimeSearch(frieren, "2023")).toBe(true);
    expect(matchesAnimeSearch(frieren, "9.3")).toBe(true);
    expect(matchesAnimeSearch(frieren, "after the demon king")).toBe(true);
    expect(matchesAnimeSearch(frieren, "52991")).toBe(true);
    expect(
      matchesAnimeSearch(
        animeCatalog.find((anime) => anime.status === "finished")!,
        "finished",
      ),
    ).toBe(true);

    await renderHome(successfulSearchFetch());
    const search = screen.getByRole("textbox", { name: "Search anime" });
    fireEvent.change(search, { target: { value: "Frieren" } });

    expect(
      screen.getByRole("button", { name: "Details for Frieren: Beyond Journey's End" }),
    ).toBeInTheDocument();
  }, 15000);

  it("debounces live requests, requires two characters, and shows deduplicated live results", async () => {
    const fetchMock = successfulSearchFetch();
    const { client } = await renderHome(fetchMock);
    const search = screen.getByRole("textbox", { name: "Search anime" });
    fireEvent.change(search, { target: { value: "f" } });
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(
      fetchMock.mock.calls.filter((call) => String(call[1]?.body).includes("search:")),
    ).toHaveLength(0);

    fireEvent.change(search, { target: { value: "  FRIEREN  " } });
    expect(
      screen.getByRole("button", { name: "Details for Frieren: Beyond Journey's End" }),
    ).toBeInTheDocument();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    await waitFor(() =>
      expect(client.getQueryState(["anilist", "search", "frieren"])?.status).toBe("success"),
    );
    expect(
      fetchMock.mock.calls.filter((call) => String(call[1]?.body).includes("search:")),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Watch New from AniList" })).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Watch Frieren: Beyond Journey's End" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Watch No Watch Route" })).not.toBeInTheDocument();
  }, 15000);

  it("does not run a pending debounced request after the search is cleared", async () => {
    const fetchMock = successfulSearchFetch();
    await renderHome(fetchMock);
    const search = screen.getByRole("textbox", { name: "Search anime" });
    fireEvent.change(search, { target: { value: "frieren" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

    await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(
      fetchMock.mock.calls.filter((call) => String(call[1]?.body).includes("search:")),
    ).toHaveLength(0);
    expect(screen.queryByText("More from AniList")).not.toBeInTheDocument();
  }, 15000);

  it.each(["429", "network", "graphql"] as const)(
    "keeps local results available when AniList search fails with %s",
    async (failure) => {
      const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { query: string };
        if (!body.query.includes("search:")) {
          return jsonResponse({ data: { Page: { media: [] } } });
        }
        if (failure === "429") return jsonResponse({}, 429);
        if (failure === "graphql") return jsonResponse({ errors: [{ message: "Unavailable" }] });
        throw new TypeError("offline");
      });
      await renderHome(fetchMock);
      fireEvent.change(screen.getByRole("textbox", { name: "Search anime" }), {
        target: { value: "frieren" },
      });

      expect(
        screen.getByRole("button", { name: "Details for Frieren: Beyond Journey's End" }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/AniList search is temporarily unavailable/),
      ).toBeInTheDocument();
    },
    15000,
  );

  it("supports Ctrl/Meta+K without hijacking shortcuts in unrelated editable fields", async () => {
    await renderHome(successfulSearchFetch());
    const search = screen.getByRole("textbox", { name: "Search anime" });
    const unrelated = screen.getByRole("textbox", { name: "Unrelated editable field" });

    unrelated.focus();
    const unrelatedShortcut = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    unrelated.dispatchEvent(unrelatedShortcut);
    expect(document.activeElement).toBe(unrelated);
    expect(unrelatedShortcut.defaultPrevented).toBe(false);

    const metaShortcut = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(metaShortcut);
    expect(document.activeElement).toBe(search);
    expect(metaShortcut.defaultPrevented).toBe(true);

    const ctrlShortcut = new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(ctrlShortcut);
    expect(document.activeElement).toBe(search);
    expect(ctrlShortcut.defaultPrevented).toBe(true);
  }, 15000);
});

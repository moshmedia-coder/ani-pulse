import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveTrending } from "@/components/live-trending";
import { trendingQuery } from "@/lib/anilist";

const media = {
  id: 1,
  idMal: 52991,
  title: { english: "Frieren", romaji: "Sousou no Frieren" },
  description: null,
  bannerImage: null,
  coverImage: { extraLarge: "https://example.test/frieren.jpg", color: null },
  episodes: 28,
  duration: null,
  averageScore: 93,
  seasonYear: 2023,
  format: "TV",
  status: "FINISHED",
  genres: ["Fantasy", "Adventure"],
  trailer: null,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function renderTrending(client: QueryClient) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: LiveTrending,
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LiveTrending grid", () => {
  it("renders wrapped cards with metadata and navigable anime links", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity } },
    });
    client.setQueryData(trendingQuery().queryKey, [
      media,
      {
        ...media,
        id: 2,
        idMal: 888888,
        title: {
          english: "A Recommendation With An Exceptionally Long Title",
          romaji: "Long Title",
        },
        coverImage: { extraLarge: null, color: null },
        episodes: null,
        averageScore: null,
        seasonYear: null,
        format: null,
        status: null,
        genres: [],
      },
      ...Array.from({ length: 3 }, (_, index) => ({
        ...media,
        id: index + 3,
        idMal: 777001 + index,
        title: { english: `Additional title ${index + 1}`, romaji: `Additional ${index + 1}` },
      })),
    ]);

    await renderTrending(client);

    const trendingRegion = screen.getByRole("region", { name: "Trending anime" });
    expect(trendingRegion).toHaveClass("live-grid");
    expect(trendingRegion).not.toHaveAttribute("aria-roledescription", "carousel");
    expect(
      screen.queryByRole("button", { name: /Scroll trending anime (left|right)/ }),
    ).not.toBeInTheDocument();
    expect(within(trendingRegion).getAllByRole("link")).toHaveLength(5);
    expect(within(trendingRegion).getByRole("link", { name: "Watch Frieren" })).toHaveAttribute(
      "href",
      "/watch/52991",
    );
    const longTitleCard = within(trendingRegion).getByRole("link", {
      name: "Watch A Recommendation With An Exceptionally Long Title",
    });
    expect(longTitleCard).toHaveAttribute("href", "/watch/888888");
    const frierenCard = within(trendingRegion).getByRole("link", { name: "Watch Frieren" });
    expect(within(frierenCard).getByText("Fantasy")).toBeVisible();
    expect(within(frierenCard).getByText("Adventure")).toBeVisible();
    expect(within(frierenCard).getByText("9.3")).toBeVisible();
    expect(within(longTitleCard).getByText("—")).toBeVisible();
    client.clear();
  });
});

describe("LiveTrending AniList failure states", () => {
  it("announces loading while the trending request is pending", async () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
    });

    await renderTrending(client);

    expect(screen.getByRole("status")).toHaveTextContent("LOADING · AniList");
    expect(screen.getByRole("region", { name: "Trending anime" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    client.clear();
  });

  it("shows the unavailable message after the initial request fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
    });

    await renderTrending(client);

    const unavailableStatus = await screen.findByText(
      "Trending is temporarily unavailable. Please try again later.",
    );
    expect(unavailableStatus).toHaveAttribute("role", "status");
    expect(screen.queryByRole("region", { name: "Trending anime" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    client.clear();
  });

  it("keeps cached cards visible when a background refresh fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({
      defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
    });
    client.setQueryData(trendingQuery().queryKey, [media]);

    await renderTrending(client);
    expect(screen.getByRole("link", { name: "Watch Frieren" })).toBeInTheDocument();

    await client.invalidateQueries({ queryKey: trendingQuery().queryKey });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(screen.getByRole("link", { name: "Watch Frieren" })).toBeInTheDocument();
    expect(screen.queryByText(/Trending is temporarily unavailable/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("CACHED · AniList");
    client.clear();
  });
});

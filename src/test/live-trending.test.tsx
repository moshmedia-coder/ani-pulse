import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  genres: [],
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

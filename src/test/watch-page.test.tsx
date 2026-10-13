import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { WATCH_HISTORY_CHANGE_EVENT, watchedEpisodesStorageKey } from "@/lib/watch-history";

const frieren = {
  id: 1,
  idMal: 52991,
  title: { english: "Frieren: Beyond Journey's End", romaji: "Sousou no Frieren" },
  description: "A journey continues.",
  bannerImage: null,
  coverImage: { extraLarge: "https://example.test/frieren.jpg", color: null },
  episodes: 3,
  duration: 24,
  averageScore: 93,
  seasonYear: 2023,
  format: "TV",
  status: "FINISHED",
  genres: ["Adventure", "Drama"],
  trailer: { id: "preview-id", site: "youtube" },
  nextAiringEpisode: null,
  studios: { nodes: [{ name: "Studio Example" }] },
  recommendations: { nodes: [] },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function renderWatch(initialEntry: string, response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  });
  await router.load();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient, fetchMock };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("watch experience", () => {
  it("updates the ep query when navigating and disables controls at episode boundaries", async () => {
    const { router } = await renderWatch(
      "/watch/52991?ep=2",
      jsonResponse({ data: { Media: frieren } }),
    );
    expect(
      await screen.findByRole("heading", { name: "Frieren: Beyond Journey's End" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Episode 2" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: "Previous episode" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Next episode" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ ep: 3 }));
    expect(screen.getByRole("button", { name: "Episode 3" })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: "Next episode" })).toBeDisabled();
    expect(screen.getByText("You're at the latest available episode.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Previous episode" }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ ep: 2 }));
  });

  it("marks an episode watched only when a trailer preview can start", async () => {
    const eventListener = vi.fn();
    window.addEventListener(WATCH_HISTORY_CHANGE_EVENT, eventListener);
    const { fetchMock } = await renderWatch(
      "/watch/52991?ep=2",
      jsonResponse({ data: { Media: frieren } }),
    );
    const playButton = await screen.findByRole("button", {
      name: "Play episode 2 trailer preview",
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    fireEvent.click(playButton);

    expect(await screen.findByTitle("Frieren: Beyond Journey's End episode 2")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/preview-id?autoplay=1&rel=0",
    );
    expect(JSON.parse(sessionStorage.getItem(watchedEpisodesStorageKey(52991)) ?? "[]")).toEqual([
      2,
    ]);
    expect(eventListener).toHaveBeenCalledOnce();
    window.removeEventListener(WATCH_HISTORY_CHANGE_EVENT, eventListener);
  });

  it("explains unavailable previews without falsely recording watched history", async () => {
    await renderWatch(
      "/watch/52991",
      jsonResponse({ data: { Media: { ...frieren, trailer: null } } }),
    );
    const unavailableButton = await screen.findByRole("button", {
      name: "Trailer preview unavailable for episode 1",
    });

    expect(unavailableButton).toBeDisabled();
    expect(
      await screen.findByText("No trailer preview is available for this title."),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Portfolio demo — this player previews trailers only; it does not stream full episodes.",
      ),
    ).toBeVisible();
    expect(sessionStorage.getItem(watchedEpisodesStorageKey(52991))).toBeNull();
  });

  it("keeps local anime information available after AniList fails", async () => {
    await renderWatch("/watch/52991", jsonResponse({}, 429));

    const information = await screen.findByRole("heading", {
      name: "Frieren: Beyond Journey's End",
    });
    expect(information).toBeVisible();
    expect(await screen.findByText(/AniList details are unavailable/)).toBeVisible();
    expect(screen.getByText("Episode 1 of 28 available")).toBeVisible();
    expect(screen.getByRole("button", { name: "Episode 1" })).toBeInTheDocument();
  });

  it("does not invent an episode count when neither AniList nor the catalog has one", async () => {
    await renderWatch(
      "/watch/999999?ep=2",
      jsonResponse({
        data: {
          Media: {
            ...frieren,
            idMal: 999999,
            episodes: null,
            nextAiringEpisode: null,
          },
        },
      }),
    );

    expect(await screen.findByText("Episode 2 · Episode count unavailable")).toBeVisible();
    expect(screen.getByText("Count unavailable")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Available episodes" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Episode count is unavailable, so next episode navigation is disabled."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Next episode" })).toBeDisabled();
  });

  it("exposes theater and audio preference controls as selected states", async () => {
    await renderWatch("/watch/52991", jsonResponse({ data: { Media: frieren } }));

    const audioGroup = await screen.findByRole("group", { name: "Audio preference for demo" });
    expect(within(audioGroup).getByRole("button", { name: "SUB" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(within(audioGroup).getByRole("button", { name: "DUB" }));
    expect(within(audioGroup).getByRole("button", { name: "DUB" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const theaterButton = screen.getByRole("button", { name: "Theater" });
    fireEvent.click(theaterButton);
    expect(screen.getByRole("button", { name: "Default" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("main")).toHaveClass("is-theater");
  });
});

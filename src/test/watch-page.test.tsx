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
  trailer: { id: "tR8YH0G67Rk", site: "youtube" },
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
      "https://www.youtube-nocookie.com/embed/tR8YH0G67Rk?autoplay=1&rel=0",
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

  it("rejects invalid trailer IDs and unsupported trailer sites", async () => {
    for (const trailer of [
      { id: "not-a-video-id", site: "youtube" },
      { id: "tR8YH0G67Rk", site: "dailymotion" },
    ]) {
      await renderWatch("/watch/52991", jsonResponse({ data: { Media: { ...frieren, trailer } } }));
      expect(
        await screen.findByRole("button", {
          name: "Trailer preview unavailable for episode 1",
        }),
      ).toBeDisabled();
      expect(
        screen.queryByTitle("Frieren: Beyond Journey's End episode 1"),
      ).not.toBeInTheDocument();
      expect(sessionStorage.getItem(watchedEpisodesStorageKey(52991))).toBeNull();
      cleanup();
    }
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

  it("renders anime facts, language-specific voice actors, and navigable discovery lists", async () => {
    const recommendation = {
      id: 2,
      idMal: 999001,
      title: { english: "Recommended Series", romaji: "Recommended Series" },
      coverImage: { extraLarge: "https://example.test/recommendation.jpg", color: null },
      format: "TV",
      seasonYear: 2024,
      averageScore: 86,
      isAdult: false,
    };
    const longRecommendation = {
      ...recommendation,
      id: 4,
      idMal: 999003,
      title: {
        english: "A Recommendation With An Exceptionally Long Title",
        romaji: "長いタイトルのおすすめ",
      },
      coverImage: { extraLarge: null, color: null },
      format: null,
      seasonYear: null,
      averageScore: null,
    };
    const related = { ...recommendation, id: 3, idMal: 999002, format: "OVA" };
    const { fetchMock } = await renderWatch(
      "/watch/52991",
      jsonResponse({
        data: {
          Media: {
            ...frieren,
            season: "FALL",
            startDate: { year: 2023, month: 9, day: 29 },
            endDate: { year: 2024, month: 3, day: 22 },
            countryOfOrigin: "JP",
            isAdult: false,
            characters: {
              edges: [
                {
                  role: "MAIN",
                  node: {
                    id: 10,
                    name: { full: "Fern" },
                    image: { large: "https://example.test/fern.jpg" },
                  },
                  voiceActors: [{ id: 11, name: { full: "Atsumi Tanezaki" } }],
                  englishVoiceActors: [{ id: 12, name: { full: "Jill Harris" } }],
                },
                {
                  role: null,
                  node: {
                    id: 13,
                    name: { full: "A Character With An Exceptionally Long Name" },
                    image: { large: null },
                  },
                  voiceActors: [],
                  englishVoiceActors: [],
                },
                {
                  role: "SUPPORTING",
                  node: {
                    id: 14,
                    name: { full: "Stark" },
                    image: { large: "https://example.test/stark.jpg" },
                  },
                  voiceActors: [{ id: 15, name: { full: "Chiaki Kobayashi" } }],
                  englishVoiceActors: [],
                },
                {
                  role: "SUPPORTING",
                  node: {
                    id: 16,
                    name: { full: "Sein" },
                    image: { large: null },
                  },
                  voiceActors: [],
                  englishVoiceActors: [{ id: 17, name: { full: "Christopher Guerrero" } }],
                },
              ],
            },
            relations: {
              edges: [{ relationType: "PREQUEL", node: related }],
            },
            recommendations: {
              nodes: [
                { mediaRecommendation: recommendation },
                { mediaRecommendation: longRecommendation },
                {
                  mediaRecommendation: {
                    ...recommendation,
                    id: 5,
                    idMal: 999004,
                    title: { english: "Another Series", romaji: "Another Series" },
                  },
                },
                {
                  mediaRecommendation: {
                    ...recommendation,
                    id: 6,
                    idMal: 999005,
                    title: { english: "One More Series", romaji: "One More Series" },
                  },
                },
              ],
            },
          },
        },
      }),
    );

    expect(await screen.findByText("Sousou no Frieren")).toBeVisible();
    expect(screen.getByText("2023-09-29 – 2024-03-22")).toBeVisible();
    expect(screen.getByText("Japan")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Characters & Voice Actors" })).toBeVisible();
    expect(screen.getByText("Atsumi Tanezaki")).toBeVisible();
    expect(screen.getByText("Jill Harris")).toBeVisible();
    expect(screen.getByText("Chiaki Kobayashi")).toBeVisible();
    expect(screen.getByText("Christopher Guerrero")).toBeVisible();
    const characters = screen.getByRole("region", { name: "Characters and voice actors" });
    expect(characters.querySelector(".watch-character-grid")).not.toBeNull();
    expect(characters.querySelector(".watch-character-rail")).toBeNull();
    expect(within(characters).getAllByRole("article")).toHaveLength(4);
    expect(within(characters).getByText("Voice actor unavailable")).toBeVisible();
    expect(
      within(characters).getByText("A Character With An Exceptionally Long Name"),
    ).toBeVisible();
    const relatedRail = screen.getByRole("region", { name: "Related Anime" });
    const relatedLink = within(relatedRail).getByRole("link", { name: /Recommended Series/ });
    expect(relatedLink).toHaveAttribute("href", "/watch/999002");
    const recommendations = screen.getByRole("region", { name: "You Might Also Like" });
    expect(recommendations.querySelector(".watch-anime-grid")).not.toBeNull();
    expect(recommendations.querySelector(".watch-anime-rail")).toBeNull();
    expect(within(recommendations).getAllByRole("link")).toHaveLength(4);
    expect(
      within(recommendations).getByRole("link", { name: /Recommended Series/ }),
    ).toHaveAttribute("href", "/watch/999001");
    expect(
      within(recommendations).getByRole("link", {
        name: /A Recommendation With An Exceptionally Long Title/,
      }),
    ).toHaveAttribute("href", "/watch/999003");
    expect(
      within(within(recommendations).getByRole("link", { name: /Recommended Series/ })).getByText(
        "8.6",
      ),
    ).toBeVisible();
    expect(
      within(within(recommendations).getByRole("link", { name: /Recommended Series/ })).getByText(
        "TV · 2024",
      ),
    ).toBeVisible();
    expect(within(recommendations).getByText("Details unavailable")).toBeVisible();

    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      query: string;
    };
    expect(requestBody.query).toContain("characters(perPage: 12");
    expect(requestBody.query).toContain("voiceActors(language: JAPANESE)");
    expect(requestBody.query).toContain("voiceActors(language: ENGLISH)");
    expect(requestBody.query).toContain("relations { edges");
    expect(requestBody.query).toContain("isAdult: false");
  });

  it("shows graceful empty character and discovery states when AniList has no data", async () => {
    await renderWatch("/watch/52991", jsonResponse({ data: { Media: frieren } }));

    expect(
      await screen.findByText("Character details are not listed for this title yet."),
    ).toBeVisible();
    expect(screen.getByText("Related anime is not listed for this title yet.")).toBeVisible();
    expect(screen.getByText("Recommendations are not available for this title yet.")).toBeVisible();
  });

  it("keeps local metadata visible and does not invent missing facts", async () => {
    await renderWatch(
      "/watch/52991",
      jsonResponse({
        data: {
          Media: {
            ...frieren,
            genres: [],
            seasonYear: null,
            format: null,
            status: null,
            episodes: null,
            duration: null,
            averageScore: null,
            studios: { nodes: [] },
            startDate: { year: null, month: null, day: null },
            endDate: { year: null, month: null, day: null },
            countryOfOrigin: null,
            isAdult: null,
          },
        },
      }),
    );

    expect(await screen.findByText("Fantasy")).toBeVisible();
    expect(screen.getByText("Drama")).toBeVisible();
    expect(screen.getByText("Episodes")).toBeVisible();
    expect(screen.queryByText("Studio Example")).not.toBeInTheDocument();
    expect(screen.queryByText("Japan")).not.toBeInTheDocument();
  });
});

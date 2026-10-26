import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimeVote } from "@/components/anime-vote";
import type { AniListMedia } from "@/lib/anilist";

function candidate(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1001,
    idMal: 2001,
    title: { english: "Real Seasonal Anime", romaji: "Real Seasonal Anime" },
    description: "A real AniList synopsis.",
    bannerImage: null,
    coverImage: { extraLarge: "https://example.test/real-seasonal.jpg", color: null },
    episodes: 12,
    duration: 24,
    averageScore: 84,
    seasonYear: 2026,
    startDate: { year: 2026, month: 10, day: 1 },
    endDate: { year: null, month: null, day: null },
    format: "TV",
    status: "RELEASING",
    genres: ["Action"],
    trailer: null,
    ...overrides,
  };
}

function pageResponse(media: AniListMedia[]) {
  return new Response(
    JSON.stringify({
      data: {
        Page: {
          media,
          pageInfo: {
            total: media.length,
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            perPage: 4,
          },
        },
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

function renderVote() {
  const client = new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <AnimeVote />
    </QueryClientProvider>,
  );
  return client;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Anime vote", () => {
  it("loads actual releasing anime and uses the AniList query and artwork", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const request = JSON.parse(String(init.body)) as {
        query: string;
        variables: Record<string, unknown>;
      };
      expect(request.query).toContain("status: $status");
      expect(request.variables).toMatchObject({
        status: "RELEASING",
        sort: "POPULARITY_DESC",
        perPage: 4,
      });
      return pageResponse([
        candidate(),
        candidate({
          id: 1002,
          idMal: 2002,
          title: { english: null, romaji: "Romaji Seasonal Title" },
          coverImage: { extraLarge: "https://example.test/romaji-seasonal.jpg", color: null },
          averageScore: null,
        }),
      ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderVote();

    const group = screen.getByRole("group", { name: "Anime voting candidates" });
    const firstCandidate = await within(group).findByRole("button", {
      name: /Real Seasonal Anime/,
    });
    expect(firstCandidate.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.test/real-seasonal.jpg",
    );
    expect(firstCandidate).toHaveTextContent("2026 · 8.4");
    expect(
      await within(group).findByRole("button", { name: /Romaji Seasonal Title/ }),
    ).toBeVisible();
    expect(screen.getByText(/this visit only/)).toBeVisible();
    expect(screen.getByText(/not shared or counted globally/)).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state while AniList is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderVote();

    expect(screen.getByRole("status")).toHaveTextContent("Loading current-season anime");
  });

  it("shows an honest empty state when AniList has no eligible candidates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(pageResponse([]))),
    );
    renderVote();

    expect(
      await screen.findByText(
        "No current-season anime with artwork are available to vote for right now.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Vote for your favorite" })).toBeDisabled();
  });

  it("shows API errors and allows retrying", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [{ message: "Rate limited" }] }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(pageResponse([candidate()]));
    vi.stubGlobal("fetch", fetchMock);
    renderVote();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Current-season anime could not be loaded from AniList.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("button", { name: /Real Seasonal Anime/ })).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps one visit-scoped choice, prevents resubmitting, and supports changing that choice", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          pageResponse([
            candidate(),
            candidate({
              id: 1002,
              idMal: 2002,
              title: { english: "Second Real Anime", romaji: "Second Real Anime" },
            }),
          ]),
        ),
      ),
    );
    renderVote();

    const group = screen.getByRole("group", { name: "Anime voting candidates" });
    const first = await within(group).findByRole("button", { name: /Real Seasonal Anime/ });
    const second = await within(group).findByRole("button", { name: /Second Real Anime/ });
    const submit = screen.getByRole("button", { name: "Vote for your favorite" });
    expect(submit).toBeDisabled();

    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-pressed", "false");
    expect(second).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(submit);

    expect(screen.getByRole("status")).toHaveTextContent("Selected for this visit");
    expect(second).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Vote for your favorite" }),
    ).not.toBeInTheDocument();
    expect(within(group).getAllByRole("button", { pressed: true })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Change your vote" }));
    fireEvent.click(first);
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(second).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Vote for your favorite" }));
    expect(screen.getByRole("status")).toHaveTextContent("Selected for this visit");
    expect(within(group).getAllByRole("button", { pressed: true })).toHaveLength(1);
  });
});

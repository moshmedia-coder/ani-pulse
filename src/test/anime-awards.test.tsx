import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimeAwards } from "@/components/anime-awards";
import { animeAwards } from "@/lib/anime-data";
import { mediaByMalQuery, type AniListMedia } from "@/lib/anilist";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retryDelay: 0, gcTime: Infinity } },
  });
}

function awardMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 106286,
    idMal: 38826,
    title: { english: "Weathering With You", romaji: "Tenki no Ko" },
    description: null,
    bannerImage: null,
    coverImage: { extraLarge: "https://example.test/weathering.jpg", color: null },
    episodes: 1,
    duration: 112,
    averageScore: 85,
    seasonYear: 2019,
    format: "MOVIE",
    status: "FINISHED",
    genres: ["Drama", "Romance"],
    trailer: null,
    ...overrides,
  };
}

function renderAwards(client: QueryClient, onSelect = vi.fn()) {
  render(
    <QueryClientProvider client={client}>
      <AnimeAwards onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return onSelect;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Anime Awards", () => {
  it("shows the officially sourced result with AniList metadata and local artwork", () => {
    const client = createQueryClient();
    client.setQueryData(mediaByMalQuery(38826).queryKey, awardMedia());
    const onSelect = renderAwards(client);

    expect(animeAwards).toEqual([
      {
        animeId: 37510,
        malId: 38826,
        recognition: "Japan Academy Film Prize · Best Animation Work",
        year: 2020,
        source: "https://www.japan-academy-prize.jp/news/index_news2020.php",
      },
    ]);
    expect(screen.getByText("Weathering With You")).toBeVisible();
    expect(screen.getByText("Japan Academy Film Prize · Best Animation Work")).toBeVisible();
    expect(screen.getByRole("link", { name: "Official award results" })).toHaveAttribute(
      "href",
      animeAwards[0]!.source,
    );
    expect(
      screen.getByText("Limited verified results, not a complete awards archive."),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Details for Weathering With You/ }));
    expect(onSelect).toHaveBeenCalledWith(awardMedia(), "/images/anime/37510.jpg");
  });

  it("shows a loading state while AniList metadata is pending", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderAwards(createQueryClient());

    expect(screen.getByRole("status")).toHaveTextContent("Loading verified award details");
  });

  it("shows an honest unavailable state when the award anime cannot be matched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ data: { Media: null } }))),
    );
    renderAwards(createQueryClient());

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No verified award metadata is available right now.",
      ),
    );
    expect(screen.queryByRole("button", { name: /Details for/ })).not.toBeInTheDocument();
  });

  it("surfaces AniList errors and retries successfully", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(jsonResponse({ data: { Media: awardMedia() } }));
    vi.stubGlobal("fetch", fetchMock);
    renderAwards(createQueryClient());

    const retryButton = await screen.findByRole("button", { name: "Retry" });
    fireEvent.click(retryButton);

    await waitFor(() => expect(screen.getByText("Weathering With You")).toBeVisible());
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useParams,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MangaDetails } from "@/components/manga-details";
import { MangaDiscovery } from "@/components/manga-discovery";
import { mangaDetailsQuery, mangaDiscoveryQuery, type AniListMangaMedia } from "@/lib/anilist";

function manga(id: number, title: string): AniListMangaMedia {
  return {
    id,
    idMal: null,
    title: { english: title, romaji: `${title} Original Title` },
    description: `${title} synopsis.`,
    bannerImage: null,
    coverImage: { extraLarge: null, color: null },
    genres: ["Fantasy"],
    averageScore: 88,
    popularity: 1200,
    chapters: 20,
    volumes: 3,
    status: "FINISHED",
    startDate: { year: 2024, month: 2, day: 1 },
    staff: {
      edges: [{ role: "Story & Art", node: { name: { full: `${title} Creator` } } }],
    },
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  });
}

function MangaDetailPage() {
  const { mangaId } = useParams({ strict: false });
  const parsedId = typeof mangaId === "string" && /^\d+$/.test(mangaId) ? Number(mangaId) : null;
  return <MangaDetails mangaId={parsedId} />;
}

function MangaRouteContent() {
  return (
    <>
      <MangaDiscovery />
      <Outlet />
    </>
  );
}

async function renderRoute(path: string, queryClient = createClient()) {
  for (const sort of ["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC"] as const) {
    const query = mangaDiscoveryQuery(sort);
    if (queryClient.getQueryData(query.queryKey) === undefined) {
      queryClient.setQueryData(query.queryKey, []);
    }
  }
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const mangaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/manga",
    component: MangaRouteContent,
  });
  const detailsRoute = createRoute({
    getParentRoute: () => mangaRoute,
    path: "$mangaId",
    component: MangaDetailPage,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([homeRoute, mangaRoute.addChildren([detailsRoute])]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient, router };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Manga routing", () => {
  it("opens the selected manga for each card using its AniList ID", async () => {
    const first = manga(701, "First Manga");
    const second = manga(702, "Second Manga");
    const queryClient = createClient();
    queryClient.setQueryData(mangaDiscoveryQuery("TRENDING_DESC").queryKey, [first, second]);
    queryClient.setQueryData(mangaDiscoveryQuery("POPULARITY_DESC").queryKey, []);
    queryClient.setQueryData(mangaDiscoveryQuery("SCORE_DESC").queryKey, []);
    queryClient.setQueryData(mangaDetailsQuery(first.id).queryKey, first);
    queryClient.setQueryData(mangaDetailsQuery(second.id).queryKey, second);

    const { router } = await renderRoute("/manga", queryClient);
    fireEvent.click(screen.getByRole("link", { name: "Open First Manga manga details" }));

    expect(await screen.findByRole("heading", { level: 1, name: "First Manga" })).toBeVisible();
    expect(screen.getByText("First Manga synopsis.")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Authors" }).parentElement).toHaveTextContent(
      "First Manga Creator",
    );
    const hero = screen
      .getByRole("heading", { level: 1, name: "First Manga" })
      .closest(".manga-hero");
    expect(hero?.querySelector(".manga-detail-meta")).toHaveTextContent("FINISHED");
    expect(hero?.querySelector(".manga-detail-genres")).toHaveTextContent("Fantasy");
    expect(router.state.location.pathname).toBe("/manga/701");

    cleanup();
    const secondRoute = await renderRoute("/manga", queryClient);
    fireEvent.click(screen.getByRole("link", { name: "Open Second Manga manga details" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Second Manga" })).toBeVisible();
    expect(secondRoute.router.state.location.pathname).toBe("/manga/702");
    queryClient.clear();
  });

  it("loads the selected AniList manga when a detail URL is opened directly", async () => {
    const selected = manga(802, "Directly Opened Manga");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { Media: selected } }), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { queryClient } = await renderRoute("/manga/802");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Directly Opened Manga" }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as {
      variables: { id: number; type: string };
    };
    expect(request.variables).toEqual({ id: 802, type: "MANGA" });
    queryClient.clear();
  });

  it("renders detailed publication metadata, distinct official sources, gallery, and adaptation media", async () => {
    const selected = manga(805, "Featured Manga");
    selected.title.native = "原作タイトル";
    selected.coverImage.extraLarge =
      "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/805.jpg";
    selected.format = "MANGA";
    selected.countryOfOrigin = "JP";
    selected.endDate = { year: 2025, month: 6, day: 15 };
    selected.bannerImage = "https://s4.anilist.co/file/anilistcdn/media/manga/banner/featured.jpg";
    selected.trailer = null;
    selected.relations = {
      edges: [
        {
          relationType: "ADAPTATION",
          node: {
            id: 806,
            type: "ANIME",
            title: { english: "Featured Anime", romaji: "Featured Anime" },
            coverImage: {
              extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/806.jpg",
            },
            bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/806.jpg",
            trailer: { site: "youtube", id: "tR8YH0G67Rk" },
          },
        },
      ],
    };
    selected.staff = {
      edges: [
        { role: "Story", node: { name: { full: "Writer Name" } } },
        { role: "Art", node: { name: { full: "Artist Name" } } },
      ],
    };
    selected.externalLinks = [
      {
        site: "Tapas",
        url: "https://tapas.io/series/featured-manga",
        type: "INFO",
        language: "English",
      },
      {
        site: "VIZ",
        url: "https://www.viz.com/read/featured-manga",
        type: "INFO",
        language: "Japanese",
      },
      {
        site: "AniList",
        url: "https://anilist.co/manga/805",
        type: "INFO",
        language: null,
      },
    ];
    const queryClient = createClient();
    queryClient.setQueryData(mangaDetailsQuery(selected.id).queryKey, selected);

    const { container } = await renderRoute(`/manga/${selected.id}`, queryClient);

    expect(await screen.findByRole("heading", { level: 1, name: "Featured Manga" })).toBeVisible();
    expect(
      screen.getByText("Also known as: Featured Manga Original Title · 原作タイトル"),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Authors" }).parentElement).toHaveTextContent(
      "Writer Name",
    );
    expect(screen.getByRole("heading", { name: "Artists" }).parentElement).toHaveTextContent(
      "Artist Name",
    );
    const publication = screen.getByRole("region", { name: "Publication information" });
    expect(within(publication).getByText("Manga")).toBeVisible();
    expect(within(publication).getByText("JP")).toBeVisible();
    expect(within(publication).getByText("February 1, 2024 – June 15, 2025")).toBeVisible();

    const reading = screen.getByRole("region", { name: "Read manga" });
    expect(within(reading).getByRole("link", { name: "Read on Tapas" })).toHaveAttribute(
      "href",
      "https://tapas.io/series/featured-manga",
    );
    expect(within(reading).getByText("English edition")).toBeVisible();
    expect(within(reading).getByRole("link", { name: "Read on VIZ" })).toHaveAttribute(
      "href",
      "https://www.viz.com/read/featured-manga",
    );
    expect(within(reading).queryByRole("link", { name: "AniList" })).not.toBeInTheDocument();
    expect(container.querySelectorAll(".manga-reader-official-link")).toHaveLength(2);

    expect(screen.getByRole("img", { name: "Featured Manga cover artwork" })).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Featured Manga promotional banner artwork" }),
    ).toBeVisible();
    expect(container.querySelectorAll(".manga-gallery-item")).toHaveLength(4);
    expect(screen.getByRole("heading", { name: "Related Adaptation Artwork" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Featured Anime" })).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Featured Anime anime adaptation cover artwork" }),
    ).toBeVisible();
    expect(
      screen.getByRole("img", { name: "Featured Anime anime adaptation banner artwork" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: "View larger image: Featured Anime anime adaptation cover artwork",
      }),
    );
    expect(
      await screen.findByRole("dialog", {
        name: "Featured Anime anime adaptation cover artwork",
      }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const galleryButton = screen.getByRole("button", {
      name: "View larger image: Featured Manga cover artwork",
    });
    fireEvent.click(galleryButton);
    expect(
      await screen.findByRole("dialog", { name: "Featured Manga cover artwork" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    const video = container.querySelector("iframe");
    expect(video).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/tR8YH0G67Rk");
    expect(video).toHaveAttribute("title", "Featured Anime anime adaptation trailer");
    queryClient.clear();
  });

  it("cleans the synopsis and hides unavailable artwork, creator, publication, and video sections", async () => {
    const selected = manga(807, "Minimal Manga");
    selected.description = "&lt;p&gt;A clean synopsis&amp; details&lt;/p&gt;\\nSecond line";
    selected.coverImage.extraLarge = "https://example.test/unverified-cover.jpg";
    selected.bannerImage = "https://example.test/unverified-banner.jpg";
    selected.staff = { edges: [] };
    selected.format = null;
    selected.countryOfOrigin = null;
    selected.startDate = null;
    selected.endDate = null;
    selected.trailer = { site: "youtube", id: "invalid" };
    selected.relations = {
      edges: [
        {
          relationType: "SOURCE",
          node: {
            id: 808,
            type: "ANIME",
            title: { english: "Unrelated Anime", romaji: "Unrelated Anime" },
            coverImage: { extraLarge: "https://s4.anilist.co/unrelated-cover.jpg" },
            bannerImage: "https://s4.anilist.co/unrelated-banner.jpg",
            trailer: { site: "youtube", id: "tR8YH0G67Rk" },
          },
        },
      ],
    };
    selected.externalLinks = [];
    const queryClient = createClient();
    queryClient.setQueryData(mangaDetailsQuery(selected.id).queryKey, selected);

    const { container } = await renderRoute(`/manga/${selected.id}`, queryClient);

    expect(await screen.findByRole("heading", { level: 1, name: "Minimal Manga" })).toBeVisible();
    const synopsis = container.querySelector(".manga-detail-description > p");
    expect(synopsis).toHaveTextContent("A clean synopsis& details");
    expect(synopsis?.textContent).toContain("\nSecond line");
    expect(screen.queryByText(/&lt;|<p>/i)).not.toBeInTheDocument();
    expect(screen.getByText("No verified official reading source is available yet.")).toBeVisible();
    expect(screen.queryByRole("img", { name: "Minimal Manga cover" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Gallery" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Related Adaptation Artwork" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Authors & artists" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Publication information" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Manga promotional video" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Anime adaptation trailer" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    queryClient.clear();
  });

  it("shows an artwork error state if AniList banner artwork fails to load", async () => {
    const selected = manga(809, "Unavailable Art");
    selected.coverImage.extraLarge =
      "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/809.jpg";
    selected.bannerImage =
      "https://s4.anilist.co/file/anilistcdn/media/manga/banner/unavailable.jpg";
    const queryClient = createClient();
    queryClient.setQueryData(mangaDetailsQuery(selected.id).queryKey, selected);

    const { container } = await renderRoute(`/manga/${selected.id}`, queryClient);
    const galleryImage = await screen.findByRole("img", {
      name: "Unavailable Art promotional banner artwork",
    });
    fireEvent.error(galleryImage);

    expect(container.querySelectorAll(".manga-gallery-item")).toHaveLength(1);
    const coverImage = screen.getByRole("img", { name: "Unavailable Art cover artwork" });
    expect(coverImage).toBeVisible();
    fireEvent.error(coverImage);
    expect(screen.getByText("Artwork could not be loaded.")).toBeVisible();
    expect(container.querySelector(".manga-gallery-item")).toBeNull();
    queryClient.clear();
  });

  it("shows invalid, unavailable, and API error states without leaving the detail route", async () => {
    const invalidFetch = vi.fn();
    vi.stubGlobal("fetch", invalidFetch);
    const invalid = await renderRoute("/manga/not-a-number");
    expect(screen.getByRole("alert")).toHaveTextContent("This manga ID is invalid.");
    expect(invalidFetch).not.toHaveBeenCalled();
    invalid.queryClient.clear();
    cleanup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { Media: null } }), {
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const unavailable = await renderRoute("/manga/803");
    expect(await screen.findByText("This manga was not found on AniList.")).toBeVisible();
    unavailable.queryClient.clear();
    cleanup();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("AniList unavailable", {
          status: 400,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );
    const failed = await renderRoute("/manga/804");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AniList could not load this manga.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    failed.queryClient.clear();
  });
});

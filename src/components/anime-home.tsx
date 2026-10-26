import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command,
  Flame,
  Info,
  Menu,
  Pause,
  Play,
  Search,
  Shuffle,
  Star,
  Subtitles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { animeCatalog, matchesAnimeSearch, type Anime } from "@/lib/anime-data";
import {
  animeDiscoveryQuery,
  animeTitle,
  cleanDescription,
  recentEndDateCutoff,
  mediaByMalQuery,
  trendingQuery,
  type AniListAnimeSort,
  type AniListMedia,
} from "@/lib/anilist";
import { useFeaturedCarousel } from "@/components/use-featured-carousel";
import { Brand } from "@/components/anipulse-brand";
import { AniPulseMenu } from "@/components/anipulse-menu";
import { AnimeVote } from "@/components/anime-vote";
import { AnimeAwards } from "@/components/anime-awards";
import { VoiceActors } from "@/components/voice-actors";
import { LiveTrending } from "@/components/live-trending";
import { AiringSchedule } from "@/components/airing-schedule";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  readWatchedAnimeIds,
  readWatchedEpisodes,
  WATCH_HISTORY_CHANGE_EVENT,
} from "@/lib/watch-history";

type SpotlightAnime = {
  id: number;
  title: string;
  image: string;
  poster: string | null;
  score: number | null;
  year: number | null;
  episodes: number | null;
  genres: string[];
  type: string | null;
  description: string | null;
  status: string;
};

const SPOTLIGHT_INITIAL_MAL_ID = 64340;
const SPOTLIGHT_ITEM_COUNT = 7;

function toSpotlightAnime(media: AniListMedia): SpotlightAnime | null {
  const image = media.bannerImage || media.coverImage.extraLarge;
  const title = animeTitle(media).trim();
  if (!media.idMal || !Number.isSafeInteger(media.idMal) || media.idMal <= 0 || !image || !title) {
    return null;
  }

  return {
    id: media.idMal,
    title,
    image,
    poster: media.coverImage.extraLarge,
    score:
      media.averageScore != null && Number.isFinite(media.averageScore)
        ? media.averageScore / 10
        : null,
    year: media.startDate?.year ?? media.seasonYear ?? null,
    episodes:
      media.episodes != null && Number.isSafeInteger(media.episodes) && media.episodes > 0
        ? media.episodes
        : null,
    genres: media.genres.map((genre) => genre.trim()).filter(Boolean),
    type: media.format?.replaceAll("_", " ") ?? null,
    description: cleanDescription(media.description) || null,
    status:
      media.status === "FINISHED"
        ? "finished"
        : media.status === "RELEASING"
          ? "airing"
          : media.status === "NOT_YET_RELEASED"
            ? "upcoming"
            : "",
  };
}

function toHomepageAnime(media: AniListMedia[]) {
  const unique = new Map<number, SpotlightAnime>();
  for (const item of media) {
    const anime = toSpotlightAnime(item);
    if (anime && !unique.has(anime.id)) unique.set(anime.id, anime);
  }
  return [...unique.values()];
}

function Metadata({
  anime,
  hero = false,
  showGenres = false,
  showEpisodes = true,
}: {
  anime: SpotlightAnime | Anime;
  hero?: boolean;
  showGenres?: boolean;
  showEpisodes?: boolean;
}) {
  return (
    <div className="metadata">
      {anime.type && <span>{anime.type}</span>}
      {anime.year != null && <span>{anime.year}</span>}
      {(hero || showGenres) && anime.genres.length > 0 && <span>{anime.genres.join(" · ")}</span>}
      {showEpisodes && anime.episodes != null && (
        <span>
          <Subtitles />
          {anime.episodes}
        </span>
      )}
      {anime.score != null && (
        <span>
          <Star />
          {anime.score}
        </span>
      )}
    </div>
  );
}

function matchesHomeSearch(anime: Anime | SpotlightAnime, query: string) {
  if ("popularity" in anime) return matchesAnimeSearch(anime, query);
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalizedQuery) return true;
  return [
    anime.title,
    ...anime.genres,
    anime.type,
    anime.year,
    anime.score,
    anime.status,
    anime.description,
    anime.id,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

function AnimeCard({
  anime,
  onSelect,
  resumeEpisode,
}: {
  anime: Anime | SpotlightAnime;
  onSelect: (anime: Anime | SpotlightAnime) => void;
  resumeEpisode: number | undefined;
}) {
  return (
    <article className="anime-card">
      <Button
        variant="ghost"
        className="poster-button"
        onClick={() => onSelect(anime)}
        aria-label={`Details for ${anime.title}`}
      >
        <div className="poster-frame">
          <img
            src={"poster" in anime ? (anime.poster ?? anime.image) : anime.image}
            alt={anime.title}
            loading="lazy"
            width={300}
            height={435}
          />
          <span className="poster-tag">SUB · DUB</span>
          <span className="poster-play">
            <Play />
          </span>
        </div>
      </Button>
      <div className="anime-title">
        <span className={`status-dot ${anime.status}`} />
        <span title={anime.title}>{anime.title}</span>
      </div>
      {!("popularity" in anime) && anime.description && (
        <p className="anime-synopsis">{cleanDescription(anime.description)}</p>
      )}
      {resumeEpisode !== undefined && (
        <Link
          to="/watch/$animeId"
          params={{ animeId: String(anime.id) }}
          search={{ ep: resumeEpisode }}
          className="resume-badge"
          aria-label={`Resume ${anime.title} at episode ${resumeEpisode}`}
        >
          <Play />
          Resume Ep {resumeEpisode}
        </Link>
      )}
      <Metadata anime={anime} showGenres={!("popularity" in anime)} />
    </article>
  );
}

function AnimeList({
  title,
  icon = "arrow",
  items,
  onSelect,
  status,
  emptyMessage,
  isPending = false,
  isError = false,
  onRetry,
}: {
  title: string;
  icon?: string;
  items: (Anime | SpotlightAnime)[];
  onSelect: (anime: Anime | SpotlightAnime) => void;
  status?: string;
  emptyMessage?: string;
  isPending?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="list-section" aria-label={title}>
      <h2 className="section-heading">
        {icon === "flame" ? <Flame /> : <ChevronRight />}
        {title}
      </h2>
      <div className="rank-list">
        {isPending && items.length === 0 ? (
          <p className="detail-query-state" role="status">
            Loading AniList results…
          </p>
        ) : items.length > 0 ? (
          items.slice(0, expanded ? items.length : 4).map((anime, i) => (
            <Button
              key={anime.id}
              variant="ghost"
              className="rank-item"
              onClick={() => onSelect(anime)}
            >
              <img
                src={"poster" in anime ? (anime.poster ?? anime.image) : anime.image}
                alt=""
                loading="lazy"
                width={63}
                height={90}
              />
              <div className="rank-body">
                <div className="rank-title">
                  <span className={`status-dot ${status ?? anime.status}`} />
                  <span className="name">{anime.title}</span>
                </div>
                <Metadata anime={anime} showEpisodes={false} />
              </div>
              {icon === "flame" && (
                <span className="rank-number">{String(i + 1).padStart(2, "0")}</span>
              )}
            </Button>
          ))
        ) : (
          <p className="detail-query-state" role="status">
            {isError
              ? "AniList results are temporarily unavailable."
              : (emptyMessage ?? "No anime to show yet.")}
          </p>
        )}
      </div>
      {isError && items.length > 0 && (
        <p className="detail-query-state" role="status">
          AniList could not refresh these results; showing cached titles.
        </p>
      )}
      {isError && onRetry && (
        <Button variant="link" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
      {items.length > 4 && (
        <Button variant="secondary" className="list-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Show less" : "View more"}
          <ChevronDown className={expanded ? "rotate-180" : ""} />
        </Button>
      )}
    </section>
  );
}
const genres = [
  "All genres",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Supernatural",
  "Mystery",
  "Sports",
  "Slice of Life",
];
export function AnimeHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [tab, setTab] = useState("Newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Anime | SpotlightAnime | null>(null);
  const [saved, setSaved] = useState<number[]>([]);
  const [savedSpotlight, setSavedSpotlight] = useState<SpotlightAnime[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<number, number>>({});
  const [watchedAnimeIds, setWatchedAnimeIds] = useState<number[]>([]);
  const [historyOnly, setHistoryOnly] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const catalogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const genreRef = useRef<HTMLDivElement>(null);
  const [genreEdges, setGenreEdges] = useState({ start: true, end: false, overflow: false });
  const selectedMalId =
    selected && Number.isSafeInteger(selected.id) && selected.id > 0 ? selected.id : null;
  const selectedMediaQuery = useQuery({
    ...mediaByMalQuery(selectedMalId ?? 0),
    enabled: selectedMalId !== null,
  });
  const featuredQuery = useQuery(trendingQuery());
  const detailMedia = selectedMediaQuery.data;
  const detailTitle = selected
    ? (detailMedia ? animeTitle(detailMedia).trim() : "") || selected.title
    : "";
  const aniListScore = detailMedia?.averageScore;
  const detailScore =
    aniListScore != null && Number.isFinite(aniListScore) ? aniListScore / 10 : selected?.score;
  const aniListYear = detailMedia?.seasonYear;
  const detailYear =
    aniListYear != null && Number.isSafeInteger(aniListYear) && aniListYear > 0
      ? aniListYear
      : selected?.year;
  const aniListEpisodes = detailMedia?.episodes;
  const detailEpisodes =
    aniListEpisodes != null && Number.isSafeInteger(aniListEpisodes) && aniListEpisodes > 0
      ? aniListEpisodes
      : selected?.episodes;
  const detailFormat = detailMedia?.format?.trim() || selected?.type?.trim() || "";
  const detailGenres = detailMedia?.genres.map((item) => item.trim()).filter(Boolean).length
    ? detailMedia.genres.map((item) => item.trim()).filter(Boolean)
    : (selected?.genres ?? []);
  const detailStatus = detailMedia?.status?.trim() || selected?.status.trim() || "";
  const detailDescription =
    cleanDescription(detailMedia?.description ?? null) || selected?.description?.trim() || "";
  const detailImage =
    detailMedia?.coverImage.extraLarge || detailMedia?.bannerImage || selected?.image || "";
  const refreshWatchedEpisodes = useCallback(() => {
    const next: Record<number, number> = {};
    const animeIds = readWatchedAnimeIds();
    setWatchedAnimeIds(animeIds);
    for (const animeId of animeIds) {
      const episodes = readWatchedEpisodes(animeId);
      if (episodes.length > 0) {
        next[animeId] = episodes.reduce((latest, episode) => Math.max(latest, episode), 0);
      }
    }
    setWatchedEpisodes(next);
  }, []);
  const localMalIds = useMemo(() => new Set(animeCatalog.map((anime) => anime.id)), []);
  const liveFeatured = Array.from(
    new Map(
      (featuredQuery.data ?? [])
        .filter((media) => media.idMal != null && !localMalIds.has(media.idMal))
        .map((media) => toSpotlightAnime(media))
        .filter((media): media is SpotlightAnime => media !== null)
        .map((media) => [media.id, media]),
    ).values(),
  );
  const initialLiveFeatured = liveFeatured.find((anime) => anime.id === SPOTLIGHT_INITIAL_MAL_ID);
  const orderedLiveFeatured = initialLiveFeatured
    ? [
        initialLiveFeatured,
        ...liveFeatured.filter((anime) => anime.id !== SPOTLIGHT_INITIAL_MAL_ID),
      ]
    : liveFeatured;
  const activityIds = new Set([...watchedAnimeIds, ...saved]);
  const recommendationPreferences = new Map<string, number>();
  for (const id of activityIds) {
    const local = animeCatalog.find((anime) => anime.id === id);
    const cached = queryClient.getQueryData<AniListMedia>(mediaByMalQuery(id).queryKey);
    const savedAnime = savedSpotlight.find((anime) => anime.id === id);
    const genres = cached?.genres.length
      ? cached.genres
      : (savedAnime?.genres ?? local?.genres ?? []);
    for (const genre of genres) {
      const normalizedGenre = genre.trim();
      if (normalizedGenre) {
        recommendationPreferences.set(
          normalizedGenre,
          (recommendationPreferences.get(normalizedGenre) ?? 0) + 1,
        );
      }
    }
  }
  const hasRecommendationPreferences = recommendationPreferences.size > 0;
  const activityExcludedIds = new Set([...watchedAnimeIds, ...saved]);
  const recommendationItems = Array.from(
    new Map(
      (featuredQuery.data ?? [])
        .map((media) => toSpotlightAnime(media))
        .filter(
          (anime): anime is SpotlightAnime => anime !== null && !activityExcludedIds.has(anime.id),
        )
        .map((anime) => [anime.id, anime]),
    ).values(),
  )
    .map((anime) => ({
      anime,
      preferenceScore: anime.genres.reduce(
        (score, genre) => score + (recommendationPreferences.get(genre) ?? 0),
        0,
      ),
    }))
    .filter(({ preferenceScore }) => !hasRecommendationPreferences || preferenceScore > 0)
    .sort(
      (a, b) =>
        b.preferenceScore - a.preferenceScore || (b.anime.score ?? 0) - (a.anime.score ?? 0),
    )
    .map(({ anime }) => anime);
  const recommendationTitle = hasRecommendationPreferences
    ? "Recommended for you"
    : "Popular anime · new here";
  const recommendationEmptyMessage = featuredQuery.isPending
    ? "Loading AniList recommendations…"
    : featuredQuery.isError
      ? "AniList recommendations are temporarily unavailable."
      : hasRecommendationPreferences
        ? "No trending AniList titles match your activity yet."
        : "No popular AniList titles are available right now.";
  const featured: (SpotlightAnime | Anime)[] = featuredQuery.isPending
    ? []
    : Array.from(
        new Map<number, SpotlightAnime | Anime>(
          [
            ...orderedLiveFeatured,
            ...animeCatalog.map((anime) => ({
              ...anime,
              score: anime.score,
              year: anime.year,
              episodes: anime.episodes,
              type: anime.type,
              description: anime.description,
            })),
          ].map((anime): [number, SpotlightAnime | Anime] => [anime.id, anime]),
        ).values(),
      ).slice(0, SPOTLIGHT_ITEM_COUNT);
  const spotlightStatus = featuredQuery.isPending
    ? "Loading featured anime…"
    : liveFeatured.length === 0
      ? "Showing AniPulse catalog picks"
      : "Featured from AniList trending";
  const { slide, fading, paused, move, togglePaused } = useFeaturedCarousel(
    featured.map((anime) => anime.id),
    selected !== null || menuOpen || featuredQuery.isPending,
  );
  const activeSlide = featured.length > 0 ? slide % featured.length : 0;
  const current = featured[activeSlide] ?? null;
  const historyCount = Object.keys(watchedEpisodes).length;
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLowerCase();
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 300);
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);
  const hasSearch = normalizedQuery.length > 0;
  const sessionCatalogMode = watchlistOnly || historyOnly;
  const catalogSearchReady = !hasSearch || normalizedQuery === debouncedQuery;
  const catalogSort: AniListAnimeSort =
    tab === "Popular" ? "POPULARITY_DESC" : tab === "Top rated" ? "SCORE_DESC" : "START_DATE_DESC";
  const catalogDiscoveryQuery = useQuery({
    ...animeDiscoveryQuery({
      page,
      sort: catalogSort,
      ...(hasSearch ? { search: debouncedQuery } : {}),
      ...(genre !== "All genres" ? { genre } : {}),
    }),
    enabled: !sessionCatalogMode && catalogSearchReady,
  });
  const popularPicksQuery = useQuery(animeDiscoveryQuery({ sort: "POPULARITY_DESC" }));
  const justFinishedQuery = useQuery(
    animeDiscoveryQuery({
      sort: "END_DATE_DESC",
      status: "FINISHED",
      endDateAfter: recentEndDateCutoff(),
    }),
  );
  const topMoviesQuery = useQuery(
    animeDiscoveryQuery({ sort: "SCORE_DESC", format: "MOVIE", scoredOnly: true }),
  );
  const filtered = useMemo<(Anime | SpotlightAnime)[]>(() => {
    if (sessionCatalogMode) {
      const source: (Anime | SpotlightAnime)[] = [...animeCatalog, ...savedSpotlight];
      let list = source.filter(
        (anime) =>
          matchesHomeSearch(anime, query) &&
          (genre === "All genres" || anime.genres.includes(genre)) &&
          (!watchlistOnly || saved.includes(anime.id)) &&
          (!historyOnly || watchedEpisodes[anime.id] !== undefined),
      );
      if (tab === "Top rated") {
        list = [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      }
      if (tab === "Popular") {
        list = [...list].sort(
          (a, b) =>
            ("popularity" in b ? b.popularity : (b.score ?? 0)) -
            ("popularity" in a ? a.popularity : (a.score ?? 0)),
        );
      }
      return list;
    }
    return toHomepageAnime(catalogDiscoveryQuery.data?.media ?? []);
  }, [
    sessionCatalogMode,
    savedSpotlight,
    query,
    genre,
    watchlistOnly,
    saved,
    historyOnly,
    watchedEpisodes,
    tab,
    catalogDiscoveryQuery.data,
  ]);
  const catalogCount = sessionCatalogMode
    ? filtered.length
    : (catalogDiscoveryQuery.data?.pageInfo.total ?? 0);
  const pageCount = sessionCatalogMode
    ? Math.max(1, Math.ceil(filtered.length / 12))
    : Math.max(1, Math.ceil(catalogCount / 12));
  const visible = sessionCatalogMode ? filtered.slice((page - 1) * 12, page * 12) : filtered;
  function resetFilters() {
    setQuery("");
    setGenre("All genres");
    setWatchlistOnly(false);
    setHistoryOnly(false);
    setPage(1);
  }
  function selectAnime(anime: Anime | SpotlightAnime) {
    setSelected(anime);
  }
  function toggleSaved(id: number) {
    const removing = saved.includes(id);
    const liveMedia = featuredQuery.data?.find((media) => media.idMal === id);
    const selectedLive = selected?.id === id && !("popularity" in selected) ? selected : null;
    const spotlight = liveMedia ? toSpotlightAnime(liveMedia) : selectedLive;
    setSaved((prev) => (removing ? prev.filter((x) => x !== id) : [...prev, id]));
    setSavedSpotlight((prev) =>
      removing
        ? prev.filter((anime) => anime.id !== id)
        : spotlight && !prev.some((anime) => anime.id === id)
          ? [...prev, spotlight]
          : prev,
    );
  }
  function browse() {
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }
  useEffect(() => {
    refreshWatchedEpisodes();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshWatchedEpisodes();
    };
    window.addEventListener(WATCH_HISTORY_CHANGE_EVENT, refreshWatchedEpisodes);
    window.addEventListener("pageshow", refreshWatchedEpisodes);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener(WATCH_HISTORY_CHANGE_EVENT, refreshWatchedEpisodes);
      window.removeEventListener("pageshow", refreshWatchedEpisodes);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshWatchedEpisodes]);
  useEffect(() => {
    function handleSearchShortcut(event: KeyboardEvent) {
      const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isSearchShortcut) return;

      const target = event.target;
      const isSearchInput = target === inputRef.current;
      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("[contenteditable='true']") !== null ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (isEditable && !isSearchInput) return;

      event.preventDefault();
      inputRef.current?.focus();
    }

    window.addEventListener("keydown", handleSearchShortcut);
    return () => window.removeEventListener("keydown", handleSearchShortcut);
  }, []);
  function measureGenres() {
    const el = genreRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setGenreEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft >= max - 2,
      overflow: max > 2,
    });
  }
  function scrollGenres(dir: number) {
    genreRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  }
  useEffect(() => {
    measureGenres();
    window.addEventListener("resize", measureGenres);
    return () => window.removeEventListener("resize", measureGenres);
  }, []);
  return (
    <>
      <header className="site-header">
        <Button
          variant="outline"
          size="icon"
          className="icon-control menu-control"
          aria-label="Open menu"
          title="Menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu />
        </Button>
        <Brand />
        <div className="header-search">
          <Search size={18} />
          <input
            ref={inputRef}
            aria-label="Search anime"
            placeholder="Search anime..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") browse();
            }}
          />
          {query ? (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setPage(1);
              }}
            >
              <X />
            </Button>
          ) : (
            <kbd>⌘ K</kbd>
          )}
        </div>
        <div className="header-tools">
          <Button
            variant="outline"
            size="icon"
            className="icon-control"
            aria-label="Search"
            title="Search"
            onClick={() => {
              inputRef.current?.focus();
              browse();
            }}
          >
            <Search />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="icon-control shuffle-control"
            title="Random anime"
            aria-label="Random anime"
            onClick={() => {
              const randomAnime = animeCatalog[Math.floor(Math.random() * animeCatalog.length)];
              if (randomAnime) selectAnime(randomAnime);
            }}
          >
            <Shuffle />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="icon-control"
            title="Your watchlist"
            aria-label="Your watchlist"
            onClick={() => {
              setWatchlistOnly(!watchlistOnly);
              setPage(1);
              browse();
            }}
          >
            <Bookmark className={watchlistOnly ? "text-primary" : ""} />
          </Button>
        </div>
      </header>
      <main className="main-wrap">
        <section className="hero" aria-label="Featured anime" aria-busy={featuredQuery.isPending}>
          {featured.map((anime, index) => (
            <img
              key={anime.id}
              className={`hero-image ${activeSlide === index ? "is-active" : ""}`}
              src={anime.image}
              alt={anime.title}
              aria-hidden={activeSlide !== index}
              width={1920}
              height={1024}
            />
          ))}
          <div className="hero-top">
            <span className="feature-label">
              <Flame size={14} /> IN THE SPOTLIGHT
            </span>
            <span className="sr-only" role="status" aria-live="polite">
              {spotlightStatus}
            </span>
            <div className="hero-controls">
              <Button
                size="icon"
                variant="outline"
                className="icon-control"
                aria-label={paused ? "Resume featured anime" : "Pause featured anime"}
                title={paused ? "Resume slideshow" : "Pause slideshow"}
                onClick={togglePaused}
              >
                {paused ? <Play /> : <Pause />}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="icon-control"
                aria-label="Previous featured anime"
                disabled={featured.length < 2}
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <span className="hero-count">
                {featured.length === 0 ? "00" : `0${activeSlide + 1}`}{" "}
                <span>/ 0{featured.length}</span>
              </span>
              <Button
                size="icon"
                variant="outline"
                className="icon-control"
                aria-label="Next featured anime"
                disabled={featured.length < 2}
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          {current ? (
            <div key={current.id} className={`hero-content ${fading ? "is-fading" : ""}`}>
              <div className="eyebrow">
                <span className="status-dot" />
                {liveFeatured.length > 0 ? "FEATURED · ANILIST" : "FEATURED · ANIPULSE CATALOG"}
              </div>
              <Metadata anime={current} hero />
              <h1>{current.title}</h1>
              {current.description && <p className="hero-description">{current.description}</p>}
              <div className="hero-actions">
                <Button asChild>
                  <Link to="/watch/$animeId" params={{ animeId: String(current.id) }}>
                    <Play fill="currentColor" /> Watch now
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => selectAnime(current)}>
                  Details
                </Button>
                <Button variant="outline" onClick={() => toggleSaved(current.id)}>
                  {saved.includes(current.id) ? <Check /> : <Bookmark />}
                  {saved.includes(current.id) ? "In watchlist" : "Add to watchlist"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="hero-content">
              <div className="eyebrow">
                <span className="status-dot" />
                LOADING FEATURED ANIME…
              </div>
              <h1>Loading featured anime…</h1>
            </div>
          )}
          {featured.length > 0 && (
            <div className="hero-dots">
              {featured.map((a, i) => (
                <span key={a.id} className={`hero-dot ${i === activeSlide ? "active" : ""}`} />
              ))}
            </div>
          )}
        </section>
        <div className="genre-bar-wrap">
          <span className="genre-bar-label">Explore by genre</span>
          {genreEdges.overflow && (
            <Button
              variant="outline"
              size="icon"
              className="genre-arrow"
              aria-label="Scroll genres left"
              title="Scroll genres left"
              disabled={genreEdges.start}
              onClick={() => scrollGenres(-1)}
            >
              <ChevronLeft />
            </Button>
          )}
          <div
            className="genre-bar"
            ref={genreRef}
            role="group"
            aria-label="Filter catalog by genre"
            onScroll={measureGenres}
          >
            {genres.map((g) => (
              <Button
                key={g}
                variant={genre === g ? "default" : "secondary"}
                aria-pressed={genre === g}
                onClick={() => {
                  setGenre(g);
                  setPage(1);
                  browse();
                }}
              >
                {g}
              </Button>
            ))}
          </div>
          {genreEdges.overflow && (
            <Button
              variant="outline"
              size="icon"
              className="genre-arrow"
              aria-label="Scroll genres right"
              title="Scroll genres right"
              disabled={genreEdges.end}
              onClick={() => scrollGenres(1)}
            >
              <ChevronRight />
            </Button>
          )}
        </div>
        <LiveTrending />
        <div className="content-layout">
          <div>
            <div className="bookmark-banner">
              <div className="bookmark-icon">
                <Bookmark size={20} />
              </div>
              <div>
                <h3>Your next obsession starts here.</h3>
                <p>
                  {bookmarked
                    ? "AniPulse is on your favorites list."
                    : "A whole world of anime. One place to call home."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setBookmarked(!bookmarked)}>
                {bookmarked ? <Check /> : <Bookmark />}
                {bookmarked ? "Added" : "Make it a favorite"}
              </Button>
            </div>
            <section ref={catalogRef} className="scroll-mt-28" aria-labelledby="catalog-heading">
              <div className="catalog-intro">
                <div>
                  <h2 id="catalog-heading">Browse the catalog</h2>
                  <p>Search titles, explore genres, or sort the AniPulse collection.</p>
                </div>
                <p className="catalog-count" role="status" aria-live="polite">
                  {filtered.length} of {catalogCount} titles
                </p>
              </div>
              <div className="catalog-toolbar">
                <div className="catalog-tabs" role="group" aria-label="Sort catalog">
                  <span className="catalog-sort-label">Sort by</span>
                  {["Newest", "Popular", "Top rated"].map((t) => (
                    <Button
                      key={t}
                      variant="ghost"
                      data-active={tab === t}
                      aria-pressed={tab === t}
                      onClick={() => {
                        setTab(t);
                        setPage(1);
                      }}
                    >
                      {t.toUpperCase()}
                    </Button>
                  ))}
                  {(watchlistOnly || historyOnly) && (
                    <Button variant="ghost" onClick={resetFilters}>
                      {historyOnly ? "History" : "Watchlist"} <X />
                    </Button>
                  )}
                </div>
                <div className="pagination">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Previous page"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  <span>
                    {page} / {pageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Next page"
                    disabled={page === pageCount}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
              {hasSearch && (
                <div className="catalog-reset-row">
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Clear search &amp; filters <X />
                  </Button>
                </div>
              )}
              {hasSearch && <h3 className="search-group-title">In your catalog</h3>}
              {visible.length > 0 ? (
                <div className="anime-grid">
                  {visible.map((a) => (
                    <AnimeCard
                      key={a.id}
                      anime={a}
                      onSelect={selectAnime}
                      resumeEpisode={historyOnly ? watchedEpisodes[a.id] : undefined}
                    />
                  ))}
                </div>
              ) : !sessionCatalogMode &&
                (!catalogSearchReady || catalogDiscoveryQuery.isPending) ? (
                <p className="detail-query-state" role="status">
                  {hasSearch ? "Searching AniList…" : "Loading AniList catalog…"}
                </p>
              ) : !sessionCatalogMode && catalogDiscoveryQuery.isError ? (
                <div className="empty-state">
                  <h3>AniList catalog is temporarily unavailable</h3>
                  <p>Please try again. No local titles are being presented as live results.</p>
                  <Button variant="link" onClick={() => void catalogDiscoveryQuery.refetch()}>
                    Try again <ArrowRight />
                  </Button>
                </div>
              ) : (
                <div className="empty-state">
                  <Search className="mx-auto mb-3" />
                  <h3>
                    {historyOnly
                      ? "No anime watched this session"
                      : watchlistOnly
                        ? "Your watchlist is waiting"
                        : "No titles match these browse options"}
                  </h3>
                  <p>
                    {historyOnly
                      ? "Anime with watched episodes will appear here."
                      : watchlistOnly
                        ? "Save an anime to see it here."
                        : "Change your search or genre, or clear the active filters."}
                  </p>
                  <Button variant="link" onClick={resetFilters}>
                    Browse all anime <ArrowRight />
                  </Button>
                </div>
              )}
              {!sessionCatalogMode && catalogDiscoveryQuery.isError && visible.length > 0 && (
                <p className="detail-query-state" role="status">
                  AniList could not refresh the catalog; showing cached titles.
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => void catalogDiscoveryQuery.refetch()}
                  >
                    Retry
                  </Button>
                </p>
              )}
            </section>
          </div>
          <aside className="sidebar">
            <AnimeList
              title="Popular picks"
              icon="flame"
              items={toHomepageAnime(popularPicksQuery.data?.media ?? [])}
              onSelect={selectAnime}
              isPending={popularPicksQuery.isPending}
              isError={popularPicksQuery.isError}
              onRetry={() => void popularPicksQuery.refetch()}
              emptyMessage="No popular anime are available right now."
            />
            <AnimeList
              title={recommendationTitle}
              items={recommendationItems}
              onSelect={selectAnime}
              emptyMessage={recommendationEmptyMessage}
            />
          </aside>
        </div>

        <div className="bottom-lists">
          <AnimeList
            title="Just finished"
            items={toHomepageAnime(justFinishedQuery.data?.media ?? [])}
            onSelect={selectAnime}
            status="finished"
            isPending={justFinishedQuery.isPending}
            isError={justFinishedQuery.isError}
            onRetry={() => void justFinishedQuery.refetch()}
            emptyMessage="No anime finished in the last 180 days."
          />
          <AnimeList
            title="Top movies"
            items={toHomepageAnime(
              (topMoviesQuery.data?.media ?? []).filter(
                (anime) => anime.averageScore != null && anime.averageScore > 0,
              ),
            )}
            onSelect={selectAnime}
            isPending={topMoviesQuery.isPending}
            isError={topMoviesQuery.isError}
            onRetry={() => void topMoviesQuery.refetch()}
            emptyMessage="No scored anime movies are available right now."
          />
          <AnimeAwards
            onSelect={(media, image) => {
              const anime = toSpotlightAnime(media);
              if (anime) selectAnime({ ...anime, image, poster: image });
            }}
          />
        </div>
        <div className="bottom-lists community-lists">
          <AiringSchedule />

          <VoiceActors />
          <AnimeVote />
        </div>
        <footer className="site-footer">
          <div className="footer-top">
            <div>
              <Brand />
              <p>For the stories that stay with you.</p>
            </div>
            <div className="footer-links">
              <Button
                variant="ghost"
                onClick={() => {
                  resetFilters();
                  setTab("Popular");
                  browse();
                }}
              >
                Trending
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  browse();
                  inputRef.current?.focus();
                }}
              >
                Search
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setWatchlistOnly(true);
                  setPage(1);
                  browse();
                }}
              >
                Watchlist
              </Button>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 AniPulse · A personal anime portfolio</span>
            <span>
              Made for the love of anime <span className="text-primary">✦</span>
            </span>
          </div>
        </footer>
      </main>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-xl">
          {selected && (
            <>
              <DialogTitle className="pr-5 text-2xl font-display">{detailTitle}</DialogTitle>
              <div className="detail-layout">
                {detailImage && (
                  <img src={detailImage} alt={detailTitle} width={140} height={203} />
                )}
                <div className="detail-copy">
                  <div className="metadata">
                    {detailFormat && <span>{detailFormat.replaceAll("_", " ")}</span>}
                    {detailYear != null && <span>{detailYear}</span>}
                    {detailEpisodes != null && (
                      <span>
                        <Subtitles />
                        {detailEpisodes} episodes
                      </span>
                    )}
                    {detailScore != null && Number.isFinite(detailScore) && (
                      <span>
                        <Star />
                        {detailScore.toFixed(1)}
                      </span>
                    )}
                    {detailStatus && (
                      <span>
                        Status:{" "}
                        {detailStatus
                          .replaceAll("_", " ")
                          .toLowerCase()
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </span>
                    )}
                  </div>
                  {detailDescription && (
                    <DialogDescription className="leading-relaxed">
                      {detailDescription}
                    </DialogDescription>
                  )}
                  {detailGenres.length > 0 && (
                    <div className="text-xs text-primary">{detailGenres.join(" · ")}</div>
                  )}
                  {selectedMediaQuery.isPending && (
                    <p className="detail-query-state" role="status">
                      Loading additional details…
                    </p>
                  )}
                  {selectedMediaQuery.isError && !detailMedia && (
                    <p className="detail-query-state" role="status">
                      AniList details unavailable; showing catalog information.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link
                        to="/watch/$animeId"
                        params={{ animeId: String(selected.id) }}
                        {...(watchedEpisodes[selected.id] !== undefined && {
                          search: { ep: watchedEpisodes[selected.id] },
                        })}
                      >
                        <Play fill="currentColor" /> Watch now
                      </Link>
                    </Button>
                    <Button variant="outline" onClick={() => toggleSaved(selected.id)}>
                      {saved.includes(selected.id) ? <Check /> : <Bookmark />}
                      {saved.includes(selected.id) ? "Saved to watchlist" : "Add to watchlist"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AniPulseMenu
        open={menuOpen}
        onOpenChange={setMenuOpen}
        paused={paused}
        togglePaused={togglePaused}
        savedCount={saved.length}
        historyCount={historyCount}
        onNavigate={(view) => {
          resetFilters();
          setMenuOpen(false);
          if (view === "Manga") {
            void navigate({ to: "/manga" });
            return;
          }
          if (view === "Home") {
            setTab("Newest");
            window.scrollTo({ top: 0, behavior: "smooth" });
            return;
          }
          if (view === "Schedule" || view === "Vote anime") {
            document
              .querySelector(view === "Schedule" ? ".schedule" : "#anime-vote")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }
          if (view === "Trending") setTab("Popular");
          if (view === "History") {
            refreshWatchedEpisodes();
            setHistoryOnly(true);
          }
          if (view === "Watchlist") setWatchlistOnly(true);
          browse();
        }}
      />
    </>
  );
}

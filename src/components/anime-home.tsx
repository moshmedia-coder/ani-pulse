import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
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
import { animeCatalog, animeAwards, type Anime } from "@/lib/anime-data";
import { useFeaturedCarousel } from "@/components/use-featured-carousel";
import heroImage from "@/assets/frieren-hero.jpg";
import soloHero from "@/assets/solo-leveling-hero.jpg";
import demonHero from "@/assets/demon-slayer-hero.jpg";
import chainsawHero from "@/assets/chainsaw-man-hero.jpg";
import { Brand } from "@/components/anipulse-brand";
import { AniPulseMenu } from "@/components/anipulse-menu";
import { AnimeVote } from "@/components/anime-vote";
import { VoiceActors } from "@/components/voice-actors";
import { LiveTrending } from "@/components/live-trending";
import { Link } from "@tanstack/react-router";
import { readWatchedEpisodes, WATCH_HISTORY_CHANGE_EVENT } from "@/lib/watch-history";

function Metadata({ anime, hero = false }: { anime: Anime; hero?: boolean }) {
  return (
    <div className="metadata">
      <span>{anime.type}</span>
      {!hero && <span>{anime.year}</span>}
      <span>
        <Subtitles />
        {anime.episodes}
      </span>
      <span>
        <Star />
        {anime.score}
      </span>
      {hero && (
        <span>
          <Clock3 />
          24 min
        </span>
      )}
    </div>
  );
}
function AnimeCard({
  anime,
  onSelect,
  resumeEpisode,
}: {
  anime: Anime;
  onSelect: (anime: Anime) => void;
  resumeEpisode?: number;
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
          <img src={anime.image} alt={anime.title} loading="lazy" width={300} height={435} />
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
      <Metadata anime={anime} />
    </article>
  );
}
function AnimeList({
  title,
  icon = "arrow",
  items,
  onSelect,
  status,
}: {
  title: string;
  icon?: string;
  items: Anime[];
  onSelect: (anime: Anime) => void;
  status?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="list-section">
      <h2 className="section-heading">
        {icon === "flame" ? <Flame /> : <ChevronRight />}
        {title}
      </h2>
      <div className="rank-list">
        {items.slice(0, expanded ? items.length : 4).map((anime, i) => (
          <Button
            key={anime.id}
            variant="ghost"
            className="rank-item"
            onClick={() => onSelect(anime)}
          >
            <img src={anime.image} alt="" loading="lazy" width={63} height={90} />
            <div className="rank-body">
              <div className="rank-title">
                <span className={`status-dot ${status ?? anime.status}`} />
                <span className="name">{anime.title}</span>
              </div>
              <Metadata anime={anime} />
            </div>
            {icon === "flame" && (
              <span className="rank-number">{String(i + 1).padStart(2, "0")}</span>
            )}
          </Button>
        ))}
      </div>
      <Button variant="secondary" className="list-more" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show less" : "View more"}
        <ChevronDown className={expanded ? "rotate-180" : ""} />
      </Button>
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
const featuredImages = [heroImage, soloHero, demonHero, chainsawHero];
const featuredIds = [52991, 52299, 51009, 44511];
export function AnimeHome() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [tab, setTab] = useState("Newest");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Anime | null>(null);
  const [saved, setSaved] = useState<number[]>([]);
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<number, number>>({});
  const [historyOnly, setHistoryOnly] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [day, setDay] = useState("Thu");
  const [moreSchedule, setMoreSchedule] = useState(false);
  const catalogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLDivElement>(null);
  const [genreEdges, setGenreEdges] = useState({ start: true, end: false, overflow: false });
  const refreshWatchedEpisodes = useCallback(() => {
    const next: Record<number, number> = {};
    for (const anime of animeCatalog) {
      const episodes = readWatchedEpisodes(anime.id);
      if (episodes.length > 0) {
        next[anime.id] = episodes.reduce((latest, episode) => Math.max(latest, episode), 0);
      }
    }
    setWatchedEpisodes(next);
  }, []);
  const featured = featuredIds
    .map((id) => animeCatalog.find((a) => a.id === id))
    .filter((a): a is Anime => Boolean(a));
  const { slide, fading, paused, move, togglePaused } = useFeaturedCarousel(
    featured.length,
    selected !== null || menuOpen,
  );
  const current = featured[slide] ?? animeCatalog[0];
  const historyCount = Object.keys(watchedEpisodes).length;
  const filtered = useMemo(() => {
    let list = animeCatalog.filter(
      (a) =>
        a.title.toLowerCase().includes(query.toLowerCase()) &&
        (genre === "All genres" || a.genres.includes(genre)) &&
        (!watchlistOnly || saved.includes(a.id)) &&
        (!historyOnly || watchedEpisodes[a.id] !== undefined),
    );
    if (tab === "Top rated") list = [...list].sort((a, b) => b.score - a.score);
    if (tab === "Popular") list = [...list].sort((a, b) => b.popularity - a.popularity);
    return list;
  }, [query, genre, tab, watchlistOnly, saved, historyOnly, watchedEpisodes]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const visible = filtered.slice((page - 1) * 12, page * 12);
  function resetFilters() {
    setQuery("");
    setGenre("All genres");
    setWatchlistOnly(false);
    setHistoryOnly(false);
    setPage(1);
  }
  function selectAnime(anime: Anime) {
    setSelected(anime);
  }
  function toggleSaved(id: number) {
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
  const scheduleItems = animeCatalog.slice(
    day === "Thu" ? 0 : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day),
    moreSchedule ? 12 : 6,
  );
  if (!current) return null;
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
              onClick={() => setQuery("")}
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
            onClick={() =>
              selectAnime(animeCatalog[Math.floor(Math.random() * animeCatalog.length)] ?? current)
            }
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
        <section className="hero" aria-label="Featured anime">
          {featured.map((anime, index) => (
            <img
              key={anime.id}
              className={`hero-image ${slide === index ? "is-active" : ""}`}
              src={featuredImages[index]}
              alt={index === 0 ? "Frieren in a mountain valley" : anime.title}
              aria-hidden={slide !== index}
              width={1920}
              height={1024}
            />
          ))}
          <div className="hero-top">
            <span className="feature-label">
              <Flame size={14} /> IN THE SPOTLIGHT
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
                onClick={() => move(-1)}
              >
                <ChevronLeft />
              </Button>
              <span className="hero-count">
                0{slide + 1} <span>/ 0{featured.length}</span>
              </span>
              <Button
                size="icon"
                variant="outline"
                className="icon-control"
                aria-label="Next featured anime"
                onClick={() => move(1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div key={current.id} className={`hero-content ${fading ? "is-fading" : ""}`}>
            <div className="eyebrow">
              <span className="status-dot" />
              {slide === 0 ? "A JOURNEY BEYOND THE END" : "YOUR NEXT GREAT ADVENTURE"}
            </div>
            <Metadata anime={current} hero />
            <h1>{current.title}</h1>
            <p className="hero-description">{current.description}</p>
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
          <div className="hero-dots">
            {featured.map((a, i) => (
              <span key={a.id} className={`hero-dot ${i === slide ? "active" : ""}`} />
            ))}
          </div>
        </section>
        <div className="genre-bar-wrap">
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
            aria-label="Genres"
            onScroll={measureGenres}
          >
            {genres.map((g) => (
              <Button
                key={g}
                variant={genre === g ? "default" : "secondary"}
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
            <section ref={catalogRef} className="scroll-mt-28" aria-label="Anime catalog">
              <div className="catalog-toolbar">
                <div className="catalog-tabs">
                  {["Newest", "Popular", "Top rated"].map((t) => (
                    <Button
                      key={t}
                      variant="ghost"
                      data-active={tab === t}
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
              {visible.length ? (
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
              ) : (
                <div className="empty-state">
                  <Search className="mx-auto mb-3" />
                  <h3>
                    {historyOnly
                      ? "No anime watched this session"
                      : watchlistOnly
                        ? "Your watchlist is waiting"
                        : "No anime found"}
                  </h3>
                  <p>
                    {historyOnly
                      ? "Anime with watched episodes will appear here."
                      : watchlistOnly
                        ? "Save an anime to see it here."
                        : "Try another title or genre."}
                  </p>
                  <Button variant="link" onClick={resetFilters}>
                    Browse all anime <ArrowRight />
                  </Button>
                </div>
              )}
            </section>

          </div>
          <aside className="sidebar">
            <AnimeList
              title="Top airing"
              icon="flame"
              items={animeCatalog.filter((a) => a.type !== "MOVIE").slice(0, 7)}
              onSelect={selectAnime}
            />
            <AnimeList
              title="On the horizon"
              items={animeCatalog.slice(6, 12)}
              onSelect={selectAnime}
              status="upcoming"
            />
          </aside>
        </div>

            <div className="bottom-lists">
              <AnimeList
                title="Just finished"
                items={[...animeCatalog].filter((a) => a.status === "finished")}
                onSelect={selectAnime}
                status="finished"
              />
              <AnimeList
                title="Top movies"
                items={animeCatalog.filter((a) => a.type === "MOVIE")}
                onSelect={selectAnime}
                status="finished"
              />
              <section className="list-section awards-section" aria-label="Anime Award">
                <h2 className="section-heading"><ChevronRight />Anime Award</h2>
                <div className="rank-list">
                  {animeAwards.map((award) => {
                    const anime = animeCatalog.find((item) => item.id === award.animeId);
                    if (!anime) return null;
                    return (
                      <Button
                        key={anime.id}
                        variant="ghost"
                        className="rank-item award-item"
                        aria-label={`Details for ${anime.title}, ${award.recognition}`}
                        onClick={() => selectAnime(anime)}
                      >
                        <img src={anime.image} alt="" loading="lazy" width={63} height={90} />
                        <div className="rank-body">
                          <div className="rank-title"><span className="status-dot upcoming" /><span className="name">{anime.title}</span></div>
                          <p className="award-recognition">{award.recognition}</p>
                          <span className="award-year">{award.year}</span>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              </section>
            </div>
        <div className="bottom-lists community-lists">
              <section className="schedule">
                <div className="schedule-head">
                  <h2>Airing schedule</h2>
                  <p className="schedule-label">THIS WEEK</p>
                </div>
                <div className="schedule-days">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      key={d}
                      className={d === day ? "selected" : ""}
                      onClick={() => setDay(d)}
                    >
                      {d}
                    </Button>
                  ))}
                </div>
                <p className="schedule-date">
                  {day}, October{" "}
                  {5 + ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(day)} · Times in
                  UTC
                </p>
                {scheduleItems.map((a, i) => (
                  <div className="schedule-row" key={a.id}>
                    <time>{String(14 + i).padStart(2, "0")}:30</time>
                    <span>{a.title}</span>
                    <em>EP {i + 1}</em>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  className="list-more"
                  onClick={() => setMoreSchedule(!moreSchedule)}
                >
                  {moreSchedule ? "Show less" : "Full schedule"}
                  <ArrowRight />
                </Button>
              </section>

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
        <DialogContent className="max-w-xl">
          {selected && (
            <>
              <DialogTitle className="pr-5 text-2xl font-display">{selected.title}</DialogTitle>
              <div className="detail-layout">
                <img src={selected.image} alt={selected.title} width={140} height={203} />
                <div className="detail-copy">
                  <Metadata anime={selected} />
                  <DialogDescription className="leading-relaxed">
                    {selected.description}
                  </DialogDescription>
                  <div className="text-xs text-primary">{selected.genres.join(" · ")}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild>
                      <Link
                        to="/watch/$animeId"
                        params={{ animeId: String(selected.id) }}
                        search={
                          watchedEpisodes[selected.id] !== undefined
                            ? { ep: watchedEpisodes[selected.id] }
                            : undefined
                        }
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
      <AniPulseMenu open={menuOpen} onOpenChange={setMenuOpen} paused={paused} togglePaused={togglePaused} savedCount={saved.length} historyCount={historyCount} onNavigate={(view) => {
        resetFilters();
        setMenuOpen(false);
        if (view === "Home") { setTab("Newest"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
        if (view === "Schedule" || view === "Vote anime") { document.querySelector(view === "Schedule" ? ".schedule" : "#anime-vote")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
        if (view === "Trending") setTab("Popular");
        if (view === "History") {
          refreshWatchedEpisodes();
          setHistoryOnly(true);
        }
        if (view === "Watchlist") setWatchlistOnly(true);
        browse();
      }} />
    </>
  );
}

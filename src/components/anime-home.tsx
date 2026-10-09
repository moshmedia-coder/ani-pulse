import { useEffect, useMemo, useRef, useState } from "react";
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
  Play,
  Search,
  Shuffle,
  Star,
  Subtitles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { animeCatalog, type Anime } from "@/lib/anime-data";
import heroImage from "@/assets/frieren-hero.jpg";

export function Brand() {
  return (
    <div className="brand">
      <svg className="brand-mark" viewBox="0 0 32 36" fill="none" aria-hidden="true">
        <path
          d="M4 29V6l12 16L28 6v23M4 29l-3 4m27-4 3 4"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      MIRURO<small>TV</small>
    </div>
  );
}
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
function AnimeCard({ anime, onSelect }: { anime: Anime; onSelect: (anime: Anime) => void }) {
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
const featuredIds = [52991, 52299, 51009, 44511];
export function AnimeHome() {
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("All genres");
  const [tab, setTab] = useState("Newest");
  const [page, setPage] = useState(1);
  const [slide, setSlide] = useState(0);
  const [selected, setSelected] = useState<Anime | null>(null);
  const [saved, setSaved] = useState<number[]>([]);
  const [bookmarked, setBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [day, setDay] = useState("Thu");
  const [moreSchedule, setMoreSchedule] = useState(false);
  const catalogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const genreRef = useRef<HTMLDivElement>(null);
  const [genreEdges, setGenreEdges] = useState({ start: true, end: false, overflow: false });
  const featured = featuredIds
    .map((id) => animeCatalog.find((a) => a.id === id))
    .filter((a): a is Anime => Boolean(a));
  const current = featured[slide] ?? animeCatalog[0];
  const filtered = useMemo(() => {
    let list = animeCatalog.filter(
      (a) =>
        a.title.toLowerCase().includes(query.toLowerCase()) &&
        (genre === "All genres" || a.genres.includes(genre)) &&
        (!watchlistOnly || saved.includes(a.id)),
    );
    if (tab === "Top rated") list = [...list].sort((a, b) => b.score - a.score);
    if (tab === "Popular") list = [...list].sort((a, b) => b.popularity - a.popularity);
    return list;
  }, [query, genre, tab, watchlistOnly, saved]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const visible = filtered.slice((page - 1) * 12, page * 12);
  function resetFilters() {
    setQuery("");
    setGenre("All genres");
    setWatchlistOnly(false);
    setPage(1);
  }
  function toggleSaved(id: number) {
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  function browse() {
    catalogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMenuOpen(false);
  }
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
              setSelected(animeCatalog[Math.floor(Math.random() * animeCatalog.length)] ?? current)
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
          <img
            className="hero-image"
            src={slide === 0 ? heroImage : current.image}
            alt={slide === 0 ? "Frieren in a mountain valley" : current.title}
            width={1920}
            height={1024}
          />
          <div className="hero-top">
            <span className="feature-label">
              <Flame size={14} /> IN THE SPOTLIGHT
            </span>
            <div className="hero-controls">
              <Button
                size="icon"
                variant="outline"
                className="icon-control"
                aria-label="Previous featured anime"
                onClick={() => setSlide((slide + featured.length - 1) % featured.length)}
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
                onClick={() => setSlide((slide + 1) % featured.length)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
          <div className="hero-content">
            <div className="eyebrow">
              <span className="status-dot" />
              {slide === 0 ? "A JOURNEY BEYOND THE END" : "YOUR NEXT GREAT ADVENTURE"}
            </div>
            <Metadata anime={current} hero />
            <h1>{current.title}</h1>
            <p className="hero-description">{current.description}</p>
            <div className="hero-actions">
              <Button onClick={() => setSelected(current)}>
                <Play fill="currentColor" /> Explore anime
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
        </div>
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
                    ? "Miruro is on your favorites list."
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
                  {watchlistOnly && (
                    <Button variant="ghost" onClick={resetFilters}>
                      Watchlist <X />
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
                    <AnimeCard key={a.id} anime={a} onSelect={setSelected} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Search className="mx-auto mb-3" />
                  <h3>{watchlistOnly ? "Your watchlist is waiting" : "No anime found"}</h3>
                  <p>
                    {watchlistOnly
                      ? "Save an anime to see it here."
                      : "Try another title or genre."}
                  </p>
                  <Button variant="link" onClick={resetFilters}>
                    Browse all anime <ArrowRight />
                  </Button>
                </div>
              )}
            </section>
            <div className="bottom-lists">
              <AnimeList
                title="Just finished"
                items={[...animeCatalog].filter((a) => a.status === "finished")}
                onSelect={setSelected}
                status="finished"
              />
              <AnimeList
                title="Top movies"
                items={animeCatalog.filter((a) => a.type === "MOVIE")}
                onSelect={setSelected}
                status="finished"
              />
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
            </div>
          </div>
          <aside className="sidebar">
            <AnimeList
              title="Top airing"
              icon="flame"
              items={animeCatalog.filter((a) => a.type !== "MOVIE").slice(0, 7)}
              onSelect={setSelected}
            />
            <AnimeList
              title="On the horizon"
              items={animeCatalog.slice(6, 12)}
              onSelect={setSelected}
              status="upcoming"
            />
          </aside>
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
            <span>© 2026 Miruro · A personal anime portfolio</span>
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
                  <Button onClick={() => toggleSaved(selected.id)}>
                    {saved.includes(selected.id) ? <Check /> : <Bookmark />}
                    {saved.includes(selected.id) ? "Saved to watchlist" : "Add to watchlist"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle>
            <Brand />
          </DialogTitle>
          <DialogDescription>Your anime universe</DialogDescription>
          <Button
            variant="ghost"
            onClick={() => {
              resetFilters();
              browse();
            }}
          >
            <Play />
            Browse anime
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTab("Popular");
              browse();
            }}
          >
            <Flame />
            Trending
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setWatchlistOnly(true);
              setPage(1);
              browse();
            }}
          >
            <Bookmark />
            My watchlist
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setMenuOpen(false);
              document.querySelector(".schedule")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <CalendarDays />
            Airing schedule
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

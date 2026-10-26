import { useEffect, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { BookOpen, Search, Star } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/anipulse-brand";
import { Button } from "@/components/ui/button";
import {
  animeTitle,
  mangaDiscoveryQuery,
  mangaSearchQuery,
  type AniListMangaMedia,
  type MangaSort,
} from "@/lib/anilist";

function MangaCard({ manga }: { manga: AniListMangaMedia }) {
  const title = animeTitle(manga).trim() || manga.title.romaji;
  const metadata = [
    manga.chapters != null && manga.chapters > 0 ? `${manga.chapters} chapters` : null,
    manga.volumes != null && manga.volumes > 0 ? `${manga.volumes} volumes` : null,
    manga.startDate?.year != null ? String(manga.startDate.year) : null,
  ].filter((value): value is string => value !== null);

  return (
    <article className="manga-card">
      <Link
        className="manga-card-link"
        to="/manga/$mangaId"
        params={{ mangaId: String(manga.id) }}
        aria-label={`Open ${title} manga details`}
      >
        <div className="manga-cover">
          {manga.coverImage.extraLarge ? (
            <img
              src={manga.coverImage.extraLarge}
              alt={title}
              loading="lazy"
              width={300}
              height={435}
            />
          ) : (
            <span className="manga-cover-placeholder" aria-hidden="true">
              <BookOpen />
            </span>
          )}
          {manga.status && (
            <span className="manga-status">{manga.status.replaceAll("_", " ")}</span>
          )}
        </div>
        <div className="manga-card-copy">
          <h3 title={title}>{title}</h3>
          <div className="manga-card-meta">
            {manga.averageScore != null && Number.isFinite(manga.averageScore) && (
              <span>
                <Star aria-hidden="true" />
                {(manga.averageScore / 10).toFixed(1)}
              </span>
            )}
            {metadata.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          {manga.genres.length > 0 && (
            <p className="manga-genres">{manga.genres.slice(0, 3).join(" · ")}</p>
          )}
        </div>
      </Link>
    </article>
  );
}

function MangaSection({
  title,
  query,
}: {
  title: string;
  query: UseQueryResult<AniListMangaMedia[], Error>;
}) {
  return (
    <section
      className="manga-section"
      aria-labelledby={`manga-${title.toLowerCase().replaceAll(" ", "-")}`}
    >
      <div className="manga-section-heading">
        <h2 id={`manga-${title.toLowerCase().replaceAll(" ", "-")}`}>{title}</h2>
        {query.data && <span>{query.data.length} titles</span>}
      </div>
      {query.isPending ? (
        <div className="manga-grid" role="status" aria-label={`Loading ${title}`}>
          {Array.from({ length: 6 }, (_, index) => (
            <div className="manga-skeleton" key={index} />
          ))}
        </div>
      ) : query.isError ? (
        <div className="manga-query-state" role="alert">
          <p>AniList couldn’t load this section. Please try again.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      ) : query.data.length === 0 ? (
        <p className="manga-query-state" role="status">
          No manga are available in this section right now.
        </p>
      ) : (
        <div className="manga-grid">
          {query.data.map((manga) => (
            <MangaCard key={manga.id} manga={manga} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MangaDiscovery() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const normalizedSearch = search.trim().replace(/\s+/g, " ").toLowerCase();

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(normalizedSearch), 250);
    return () => window.clearTimeout(timeout);
  }, [normalizedSearch]);

  const trending = useQuery(mangaDiscoveryQuery("TRENDING_DESC"));
  const popular = useQuery(mangaDiscoveryQuery("POPULARITY_DESC"));
  const topRated = useQuery(mangaDiscoveryQuery("SCORE_DESC"));
  const searchResults = useQuery({
    ...mangaSearchQuery(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
  });
  const searching = normalizedSearch.length >= 2 && normalizedSearch === debouncedSearch;

  return (
    <>
      <header className="site-header manga-header">
        <Link to="/" aria-label="AniPulse home">
          <Brand />
        </Link>
        <div className="manga-header-actions">
          <span aria-current="page">Manga</span>
          <Button asChild variant="outline">
            <Link to="/">Explore anime</Link>
          </Button>
        </div>
      </header>
      <main className="main-wrap manga-main">
        <div className="manga-intro">
          <p className="manga-eyebrow">THE ANILIST MANGA COLLECTION</p>
          <h1>Discover your next manga obsession.</h1>
          <p>Explore what readers are following, loving, and rating on AniList.</p>
        </div>
        <label className="manga-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search manga on AniList</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search manga..."
          />
        </label>
        {search.length > 0 && search.length < 2 && (
          <p className="manga-search-hint" role="status">
            Enter at least two characters to search.
          </p>
        )}
        {searching && <MangaSection title="Search results" query={searchResults} />}
        <div className="manga-sections">
          <MangaSection title="Trending Manga" query={trending} />
          <MangaSection title="Popular Manga" query={popular} />
          <MangaSection title="Top-Rated Manga" query={topRated} />
        </div>
      </main>
    </>
  );
}

export { MangaCard };

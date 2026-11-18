import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star, Subtitles } from "lucide-react";
import { animeTitle, trendingQuery } from "@/lib/anilist";

export function LiveTrending() {
  const { data, isError, isFetching, isPending } = useQuery(trendingQuery());

  if (isError && !data) {
    return (
      <section className="live-trending" aria-labelledby="live-trending-title">
        <div className="section-heading live-heading">
          <h2 id="live-trending-title">
            Trending now <ChevronRight />
          </h2>
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          Trending is temporarily unavailable. Please try again later.
        </p>
      </section>
    );
  }

  if (!isPending && data?.length === 0) {
    return (
      <section className="live-trending" aria-labelledby="live-trending-title">
        <div className="section-heading live-heading">
          <h2 id="live-trending-title">
            Trending now <ChevronRight />
          </h2>
          <span className="live-badge" role="status" aria-live="polite">
            <span className="status-dot" />
            TRENDING · AniList
          </span>
        </div>
        <p className="text-xs text-muted-foreground" role="status">
          No trending titles are available right now.
        </p>
      </section>
    );
  }

  return (
    <section className="live-trending" aria-labelledby="live-trending-title">
      <div className="section-heading live-heading">
        <h2 id="live-trending-title">
          Trending now <ChevronRight />
        </h2>
        <span className="live-badge" role="status" aria-live="polite">
          <span className="status-dot" />
          {isPending
            ? "LOADING · AniList"
            : isError
              ? "CACHED · AniList"
              : isFetching
                ? "UPDATING · AniList"
                : "TRENDING · AniList"}
        </span>
      </div>
      <div className="live-grid" role="region" aria-label="Trending anime" aria-busy={isPending}>
        {isPending
          ? Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="live-card skeleton" aria-hidden="true">
                <div className="live-skeleton-poster" />
                <div className="live-card-details">
                  <div className="live-skeleton-title" />
                  <div className="live-skeleton-meta" />
                </div>
              </div>
            ))
          : data?.map((m) => {
              const format = m.format?.replaceAll("_", " ").trim();
              const year = m.startDate?.year ?? m.seasonYear;
              const releaseYear =
                year != null && Number.isSafeInteger(year) && year > 0 ? year : null;
              const title = animeTitle(m);

              return (
                <Link
                  key={m.id}
                  to="/watch/$animeId"
                  params={{ animeId: String(m.idMal) }}
                  className="live-card"
                  aria-label={`Watch ${title}`}
                >
                  <div className="poster-frame">
                    {m.coverImage.extraLarge ? (
                      <img
                        src={m.coverImage.extraLarge}
                        alt=""
                        loading="lazy"
                        width={300}
                        height={435}
                      />
                    ) : (
                      <span className="poster-placeholder" aria-hidden="true" />
                    )}
                    <span className="poster-play">
                      <Play />
                    </span>
                  </div>
                  <div className="live-card-details">
                    <div className="anime-title live-anime-title">
                      <span title={title}>{title}</span>
                    </div>
                    <div className="metadata live-meta">
                      {(format || releaseYear != null) && (
                        <span>{[format, releaseYear].filter(Boolean).join(" ")}</span>
                      )}
                      {m.episodes != null && Number.isSafeInteger(m.episodes) && m.episodes > 0 && (
                        <span>
                          <Subtitles aria-hidden="true" />
                          {m.episodes}
                        </span>
                      )}
                      {m.averageScore != null &&
                        Number.isFinite(m.averageScore) &&
                        m.averageScore > 0 && (
                          <span>
                            <Star aria-hidden="true" />
                            {(m.averageScore / 10).toFixed(1)}
                          </span>
                        )}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

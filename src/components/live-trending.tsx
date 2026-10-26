import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star } from "lucide-react";
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
          : data?.map((m, index) => {
              const status =
                m.status === "RELEASING"
                  ? "airing"
                  : m.status === "FINISHED"
                    ? "finished"
                    : m.status === "NOT_YET_RELEASED"
                      ? "upcoming"
                      : null;
              const episodeInfo =
                m.episodes != null
                  ? `${m.episodes} EPS`
                  : m.nextAiringEpisode
                    ? `EP ${m.nextAiringEpisode.episode}`
                    : null;
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
                    {episodeInfo && (
                      <span className="poster-tag live-episode-tag">{episodeInfo}</span>
                    )}
                    <span className="live-rank">#{index + 1}</span>
                    <span className="poster-play">
                      <Play />
                    </span>
                  </div>
                  <div className="live-card-details">
                    <div className="anime-title live-anime-title">
                      {status && (
                        <span
                          className={`status-dot ${status}`}
                          role="img"
                          aria-label={`${status} status`}
                        />
                      )}
                      <span title={title}>{title}</span>
                    </div>
                    <div className="metadata live-meta">
                      {m.format && <span>{m.format.replaceAll("_", " ")}</span>}
                      {m.seasonYear != null && <span>{m.seasonYear}</span>}
                      <span>
                        <Star />
                        {m.averageScore != null ? (m.averageScore / 10).toFixed(1) : "—"}
                      </span>
                      {m.genres.map((genre) => (
                        <span key={genre}>{genre}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

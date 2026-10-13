import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { animeTitle, trendingQuery } from "@/lib/anilist";

export function LiveTrending() {
  const { data, isError, isFetching, isPending } = useQuery(trendingQuery());
  const trackRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false, overflow: false });

  const measureTrack = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setEdges({
      start: track.scrollLeft <= 2,
      end: track.scrollLeft >= max - 2,
      overflow: max > 2,
    });
  }, []);

  useEffect(() => {
    measureTrack();
    window.addEventListener("resize", measureTrack);
    return () => window.removeEventListener("resize", measureTrack);
  }, [data, measureTrack]);

  function scrollTrack(direction: number) {
    trackRef.current?.scrollBy({ left: direction * 320, behavior: "smooth" });
  }

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
      <div className="live-rail">
        {edges.overflow && (
          <Button
            variant="outline"
            size="icon"
            className="genre-arrow"
            aria-label="Scroll trending anime left"
            title="Scroll trending anime left"
            disabled={edges.start}
            onClick={() => scrollTrack(-1)}
          >
            <ChevronLeft />
          </Button>
        )}
        <div
          className="live-track"
          ref={trackRef}
          role="region"
          aria-label="Trending anime"
          aria-busy={isPending}
          tabIndex={0}
          onScroll={measureTrack}
        >
          {isPending
            ? Array.from({ length: 8 }, (_, i) => <div key={i} className="live-card skeleton" />)
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

                return (
                  <Link
                    key={m.id}
                    to="/watch/$animeId"
                    params={{ animeId: String(m.idMal) }}
                    className="live-card"
                    aria-label={`Watch ${animeTitle(m)}`}
                  >
                    <div className="poster-frame">
                      <img
                        src={m.coverImage.extraLarge ?? ""}
                        alt={animeTitle(m)}
                        loading="lazy"
                        width={300}
                        height={435}
                      />
                      {m.format && (
                        <span className="poster-tag live-format-tag">
                          {m.format.replaceAll("_", " ")}
                        </span>
                      )}
                      {episodeInfo && (
                        <span className="poster-tag live-episode-tag">{episodeInfo}</span>
                      )}
                      <span className="live-rank">#{index + 1}</span>
                      <span className="poster-play">
                        <Play />
                      </span>
                    </div>
                    <div className="anime-title live-anime-title">
                      {status && (
                        <span
                          className={`status-dot ${status}`}
                          role="img"
                          aria-label={`${status} status`}
                        />
                      )}
                      <span title={animeTitle(m)}>{animeTitle(m)}</span>
                    </div>
                    <div className="metadata live-meta">
                      {m.format && <span>{m.format.replaceAll("_", " ")}</span>}
                      {m.seasonYear != null && <span>{m.seasonYear}</span>}
                      <span>
                        <Star />
                        {m.averageScore != null ? (m.averageScore / 10).toFixed(1) : "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
        </div>
        {edges.overflow && (
          <Button
            variant="outline"
            size="icon"
            className="genre-arrow"
            aria-label="Scroll trending anime right"
            title="Scroll trending anime right"
            disabled={edges.end}
            onClick={() => scrollTrack(1)}
          >
            <ChevronRight />
          </Button>
        )}
      </div>
    </section>
  );
}

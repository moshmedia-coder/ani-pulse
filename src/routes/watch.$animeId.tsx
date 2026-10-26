import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/anipulse-brand";
import { WatchComments } from "@/components/watch-comments";
import { WatchDiscovery } from "@/components/watch-discovery";
import { animeCatalog } from "@/lib/anime-data";
import { animeTitle, mediaByMalQuery } from "@/lib/anilist";
import { resolveYouTubeTrailerId } from "@/lib/watch-preview";
import {
  notifyWatchHistoryChanged,
  readWatchedEpisodes,
  watchedEpisodesStorageKey,
} from "@/lib/watch-history";

export const Route = createFileRoute("/watch/$animeId")({
  validateSearch: z.object({ ep: z.coerce.number().int().min(1).catch(1).optional() }),
  head: ({ params }) => {
    const local = animeCatalog.find((a) => String(a.id) === params.animeId);
    const name = local?.title ?? "Anime";
    return {
      meta: [
        { title: `Watch ${name} — AniPulse` },
        { name: "description", content: `Episodes, trailer, and details for ${name} on AniPulse.` },
        { property: "og:title", content: `Watch ${name} — AniPulse` },
        { property: "og:description", content: `Episodes, trailer, and details for ${name}.` },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: WatchPage,
});

function WatchPage() {
  const { animeId } = Route.useParams();
  const { ep = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const malId = Number(animeId);
  const validMalId = Number.isSafeInteger(malId) && malId > 0;
  const local = animeCatalog.find((a) => a.id === malId);
  const {
    data: media,
    isError,
    isPending,
  } = useQuery({
    ...mediaByMalQuery(validMalId ? malId : 0),
    enabled: validMalId,
  });

  const title =
    (media ? animeTitle(media).trim() : "") ||
    local?.title ||
    (isPending ? "Loading…" : "Unknown anime");
  const banner = media?.bannerImage ?? media?.coverImage.extraLarge ?? local?.image;
  const mediaEpisodeCount =
    media?.episodes != null && Number.isSafeInteger(media.episodes) && media.episodes > 0
      ? media.episodes
      : null;
  const localEpisodeCount =
    local && Number.isSafeInteger(local.episodes) && local.episodes > 0 ? local.episodes : null;
  const nextAiringEpisode =
    media?.nextAiringEpisode?.episode != null &&
    Number.isSafeInteger(media.nextAiringEpisode.episode) &&
    media.nextAiringEpisode.episode > 0
      ? media.nextAiringEpisode.episode
      : null;
  const total = mediaEpisodeCount ?? localEpisodeCount;
  const released = nextAiringEpisode !== null ? Math.max(0, nextAiringEpisode - 1) : total;
  const episode = released !== null ? Math.min(ep, Math.max(1, released)) : ep;
  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<"SUB" | "DUB">("SUB");
  const [theater, setTheater] = useState(false);
  const [grid, setGrid] = useState(true);
  const [watched, setWatched] = useState<number[]>([]);
  const storageKey = watchedEpisodesStorageKey(malId);

  useEffect(() => {
    setWatched(readWatchedEpisodes(malId));
  }, [malId]);
  useEffect(() => setPlaying(false), [episode, malId]);

  function play() {
    if (!trailer || (released !== null && episode > released) || !validMalId) return;
    setPlaying(true);
    const next = Array.from(new Set([...watched, episode]));
    setWatched(next);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
    notifyWatchHistoryChanged();
  }
  const goTo = (n: number) => navigate({ search: { ep: n }, replace: true });

  const episodes = useMemo(
    () => Array.from({ length: released ?? 0 }, (_, i) => i + 1),
    [released],
  );
  const trailer = resolveYouTubeTrailerId(media?.trailer);
  const canPlayEpisode =
    trailer !== null && (released === null || episode <= released) && validMalId;
  const episodeBoundaryMessage =
    episode <= 1
      ? "You're at the first episode."
      : released === null
        ? "Episode count is unavailable, so next episode navigation is disabled."
        : episode >= released
          ? "You're at the latest available episode."
          : "";
  return (
    <div className="watch-page">
      <header className="site-header">
        <Link to="/" className="watch-back" aria-label="Back to home">
          <ArrowLeft />
        </Link>
        <Link to="/">
          <Brand />
        </Link>
      </header>

      <main className={`watch-layout ${theater ? "is-theater" : ""}`}>
        <section className="watch-main">
          <div className="player">
            {playing && trailer ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0`}
                title={`${title} episode ${episode}`}
                allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                className="player-cover"
                onClick={play}
                disabled={!canPlayEpisode}
                aria-label={
                  canPlayEpisode
                    ? `Play episode ${episode} trailer preview`
                    : `Trailer preview unavailable for episode ${episode}`
                }
              >
                {banner && <img src={banner} alt="" />}
                <span className="player-play">
                  <Play fill="currentColor" />
                </span>
                <span className="player-caption">
                  Episode {episode} · {audio}
                </span>
                {!canPlayEpisode && (
                  <span className="player-note">
                    {isPending
                      ? "Loading trailer details…"
                      : released === 0
                        ? "No episodes have aired yet."
                        : "No trailer preview is available for this title."}
                  </span>
                )}
              </button>
            )}
          </div>
          <p className="player-disclaimer">
            Portfolio demo — this player previews trailers only; it does not stream full episodes.
          </p>

          <div className="player-bar">
            <Button
              variant="outline"
              size="sm"
              disabled={episode <= 1}
              title={episode <= 1 ? "You are at the first episode" : "Go to previous episode"}
              onClick={() => goTo(episode - 1)}
            >
              <ChevronLeft /> Previous episode
            </Button>
            <div className="audio-toggle" role="group" aria-label="Audio preference for demo">
              {(["SUB", "DUB"] as const).map((a) => (
                <button
                  key={a}
                  data-active={audio === a}
                  aria-pressed={audio === a}
                  onClick={() => setAudio(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={theater}
              onClick={() => setTheater(!theater)}
            >
              {theater ? <Minimize2 /> : <Maximize2 />} {theater ? "Default" : "Theater"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={released === null || episode >= released}
              title={
                released === null
                  ? "Episode count unavailable"
                  : episode >= released
                    ? "You are at the latest available episode"
                    : "Go to next episode"
              }
              onClick={() => goTo(episode + 1)}
            >
              Next episode <ChevronRight />
            </Button>
          </div>
          <p className="audio-note">
            SUB/DUB is a display preference here; trailer audio is provided by YouTube.
          </p>
        </section>

        <aside className="episode-panel">
          <div className="episode-head">
            <h2>
              Available episodes{" "}
              <span>
                {released === null
                  ? "Count unavailable"
                  : nextAiringEpisode !== null
                    ? `${released} / ${total ?? released}`
                    : released}
              </span>
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setGrid(!grid)}
              aria-label="Toggle episode layout"
              aria-pressed={!grid}
            >
              {grid ? <List /> : <LayoutGrid />}
            </Button>
          </div>
          {episodes.length > 0 ? (
            <div
              className={grid ? "episode-grid" : "episode-list"}
              role="group"
              aria-label="Available episodes"
            >
              {episodes.map((n) => (
                <button
                  key={n}
                  data-active={n === episode}
                  data-watched={watched.includes(n)}
                  aria-current={n === episode ? "step" : undefined}
                  onClick={() => goTo(n)}
                  aria-label={`Episode ${n}${watched.includes(n) ? ", watched this session" : ""}`}
                >
                  {grid ? n : `Episode ${n}`}
                </button>
              ))}
            </div>
          ) : (
            <p className="episode-unavailable">
              {released === 0
                ? "No episodes are available yet."
                : "Episode availability could not be determined."}
            </p>
          )}
          {episodeBoundaryMessage && (
            <p className="episode-boundary" aria-live="polite">
              {episodeBoundaryMessage}
            </p>
          )}
          {media?.nextAiringEpisode && (
            <p className="episode-next">
              <Bookmark /> Ep {media.nextAiringEpisode.episode} airs in{" "}
              {Math.ceil(media.nextAiringEpisode.timeUntilAiring / 86400)} days
            </p>
          )}
        </aside>
      </main>

      <WatchDiscovery
        media={media}
        local={local}
        title={title}
        episode={episode}
        episodeCount={total}
        releasedCount={released}
        isPending={isPending}
        isError={isError}
      />
      {validMalId && <WatchComments animeId={malId} />}
    </div>
  );
}

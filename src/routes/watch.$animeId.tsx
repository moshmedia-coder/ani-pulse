import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Play,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/anipulse-brand";
import { animeCatalog } from "@/lib/anime-data";
import { animeTitle, cleanDescription, mediaByMalQuery } from "@/lib/anilist";

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
  const local = animeCatalog.find((a) => a.id === malId);
  const { data: media, isPending } = useQuery({ ...mediaByMalQuery(malId), enabled: Number.isFinite(malId) });

  const title = media ? animeTitle(media) : (local?.title ?? (isPending ? "Loading…" : "Unknown anime"));
  const total = Math.max(1, media?.episodes ?? media?.nextAiringEpisode?.episode ?? local?.episodes ?? 12);
  const released = media?.nextAiringEpisode ? Math.max(1, media.nextAiringEpisode.episode - 1) : total;
  const episode = Math.min(ep, released);
  const banner = media?.bannerImage ?? media?.coverImage.extraLarge ?? local?.image;
  const description = cleanDescription(media?.description ?? null) || local?.description || "";

  const [playing, setPlaying] = useState(false);
  const [audio, setAudio] = useState<"SUB" | "DUB">("SUB");
  const [theater, setTheater] = useState(false);
  const [grid, setGrid] = useState(true);
  const [watched, setWatched] = useState<number[]>([]);
  const storageKey = `anipulse-watched-${malId}`;

  useEffect(() => {
    setWatched(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
  }, [storageKey]);
  useEffect(() => setPlaying(false), [episode, malId]);

  function play() {
    setPlaying(true);
    const next = Array.from(new Set([...watched, episode]));
    setWatched(next);
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  }
  const goTo = (n: number) => navigate({ search: { ep: n }, replace: true });

  const episodes = useMemo(() => Array.from({ length: released }, (_, i) => i + 1), [released]);
  const trailer = media?.trailer?.site === "youtube" ? media.trailer.id : null;

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
              <button className="player-cover" onClick={play} aria-label={`Play episode ${episode}`}>
                {banner && <img src={banner} alt="" />}
                <span className="player-play">
                  <Play fill="currentColor" />
                </span>
                <span className="player-caption">
                  Episode {episode} · {audio}
                </span>
                {playing && !trailer && <span className="player-note">No preview available for this title.</span>}
              </button>
            )}
          </div>
          <p className="player-disclaimer">
            Portfolio demo — plays the official trailer. Full episodes are available on licensed services.
          </p>

          <div className="player-bar">
            <Button variant="outline" size="sm" disabled={episode <= 1} onClick={() => goTo(episode - 1)}>
              <ChevronLeft /> Prev
            </Button>
            <div className="audio-toggle" role="group" aria-label="Audio">
              {(["SUB", "DUB"] as const).map((a) => (
                <button key={a} data-active={audio === a} onClick={() => setAudio(a)}>
                  {a}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setTheater(!theater)}>
              {theater ? <Minimize2 /> : <Maximize2 />} {theater ? "Default" : "Theater"}
            </Button>
            <Button variant="outline" size="sm" disabled={episode >= released} onClick={() => goTo(episode + 1)}>
              Next <ChevronRight />
            </Button>
          </div>

          <div className="watch-info">
            {media?.coverImage.extraLarge || local?.image ? (
              <img src={media?.coverImage.extraLarge ?? local?.image} alt={title} width={130} height={188} />
            ) : null}
            <div>
              <h1>{title}</h1>
              <div className="metadata">
                {media?.format && <span>{media.format.replace("_", " ")}</span>}
                {(media?.seasonYear ?? local?.year) && <span>{media?.seasonYear ?? local?.year}</span>}
                <span>
                  <Star /> {media?.averageScore ? (media.averageScore / 10).toFixed(1) : (local?.score ?? "—")}
                </span>
                {media?.duration && (
                  <span>
                    <Clock3 /> {media.duration} min
                  </span>
                )}
                {media?.studios?.nodes[0] && <span>{media.studios.nodes[0].name}</span>}
              </div>
              <p>{description}</p>
              <div className="text-xs text-primary">{(media?.genres ?? local?.genres ?? []).join(" · ")}</div>
            </div>
          </div>
        </section>

        <aside className="episode-panel">
          <div className="episode-head">
            <h2>
              Episodes <span>{released}{media?.nextAiringEpisode ? ` / ${total}` : ""}</span>
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setGrid(!grid)} aria-label="Toggle episode layout">
              {grid ? <List /> : <LayoutGrid />}
            </Button>
          </div>
          <div className={grid ? "episode-grid" : "episode-list"}>
            {episodes.map((n) => (
              <button
                key={n}
                data-active={n === episode}
                data-watched={watched.includes(n)}
                onClick={() => goTo(n)}
                aria-label={`Episode ${n}`}
              >
                {grid ? n : `Episode ${n}`}
              </button>
            ))}
          </div>
          {media?.nextAiringEpisode && (
            <p className="episode-next">
              <Bookmark /> Ep {media.nextAiringEpisode.episode} airs in{" "}
              {Math.ceil(media.nextAiringEpisode.timeUntilAiring / 86400)} days
            </p>
          )}
        </aside>
      </main>

      {!!media?.recommendations?.nodes.length && (
        <section className="watch-recs">
          <h2>You may also like</h2>
          <div className="live-track">
            {media.recommendations.nodes
              .map((n) => n.mediaRecommendation)
              .filter((r): r is NonNullable<typeof r> => !!r?.idMal)
              .map((r) => (
                <Link key={r.id} to="/watch/$animeId" params={{ animeId: String(r.idMal) }} className="live-card">
                  <div className="poster-frame">
                    <img src={r.coverImage.extraLarge ?? ""} alt={animeTitle(r)} loading="lazy" />
                  </div>
                  <span className="live-title">{animeTitle(r)}</span>
                </Link>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

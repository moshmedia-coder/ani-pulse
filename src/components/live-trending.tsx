import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Play, Star } from "lucide-react";
import { animeTitle, trendingQuery } from "@/lib/anilist";

export function LiveTrending() {
  const { data, isError, isPending } = useQuery(trendingQuery());
  if (isError) return null;
  return (
    <section className="live-trending" aria-labelledby="live-trending-title">
      <div className="section-heading">
        <h2 id="live-trending-title">
          Trending now <ChevronRight />
        </h2>
        <span className="live-badge">
          <span className="status-dot" /> LIVE · AniList
        </span>
      </div>
      <div className="live-track">
        {isPending
          ? Array.from({ length: 8 }, (_, i) => <div key={i} className="live-card skeleton" />)
          : data.map((m) => (
              <Link
                key={m.id}
                to="/watch/$animeId"
                params={{ animeId: String(m.idMal) }}
                className="live-card"
                aria-label={`Watch ${animeTitle(m)}`}
              >
                <div className="poster-frame">
                  <img src={m.coverImage.extraLarge ?? ""} alt={animeTitle(m)} loading="lazy" />
                  <span className="poster-play">
                    <Play />
                  </span>
                </div>
                <span className="live-title">{animeTitle(m)}</span>
                <span className="live-meta">
                  {m.format?.replace("_", " ")} · <Star /> {m.averageScore ? (m.averageScore / 10).toFixed(1) : "—"}
                </span>
              </Link>
            ))}
      </div>
    </section>
  );
}

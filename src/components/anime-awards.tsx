import { useQueries } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { animeCatalog, animeAwards } from "@/lib/anime-data";
import { animeTitle, mediaByMalQuery, type AniListMedia } from "@/lib/anilist";

export function AnimeAwards({
  onSelect,
}: {
  onSelect: (media: AniListMedia, image: string) => void;
}) {
  const results = useQueries({
    queries: animeAwards.map((award) => mediaByMalQuery(award.malId)),
  });
  const failedIndex = results.findIndex((result) => result.isError);
  const entries = animeAwards.flatMap((award, index) => {
    const media = results[index]?.data;
    const anime = animeCatalog.find((item) => item.id === award.animeId);
    const title = media ? animeTitle(media).trim() : "";

    if (!media || media.idMal !== award.malId || !anime || !title) return [];
    return [{ award, anime, media, title }];
  });

  return (
    <section className="list-section awards-section" aria-label="Anime Awards">
      <h2 className="section-heading">
        <ChevronRight />
        Anime Awards
      </h2>
      {entries.length > 0 ? (
        <div className="rank-list">
          {entries.map(({ award, anime, media, title }) => (
            <div className="award-entry" key={`${award.malId}-${award.year}`}>
              <Button
                variant="ghost"
                className="rank-item award-item"
                aria-label={`Details for ${title}, ${award.recognition}`}
                onClick={() => onSelect(media, anime.image)}
              >
                <img src={anime.image} alt="" loading="lazy" width={76} height={110} />
                <div className="rank-body">
                  <div className="rank-title">
                    <span className="status-dot upcoming" />
                    <span className="name">{title}</span>
                  </div>
                  <p className="award-recognition">{award.recognition}</p>
                  <span className="award-year">{award.year}</span>
                </div>
              </Button>
              <a
                className="award-source"
                href={award.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                Official award results
              </a>
            </div>
          ))}
        </div>
      ) : failedIndex >= 0 ? (
        <div role="alert" className="detail-query-state">
          <p>Verified award metadata could not be loaded from AniList.</p>
          <Button variant="outline" onClick={() => void results[failedIndex]?.refetch()}>
            Retry
          </Button>
        </div>
      ) : results.some((result) => result.isPending) ? (
        <p role="status" className="detail-query-state">
          Loading verified award details…
        </p>
      ) : (
        <p role="status" className="detail-query-state">
          No verified award metadata is available right now.
        </p>
      )}
      <p className="award-note">Limited verified results, not a complete awards archive.</p>
    </section>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { animeDiscoveryQuery, animeTitle } from "@/lib/anilist";

export function AnimeVote() {
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const candidatesQuery = useQuery(
    animeDiscoveryQuery({
      sort: "POPULARITY_DESC",
      status: "RELEASING",
      perPage: 4,
    }),
  );
  const candidates = (candidatesQuery.data?.media ?? []).flatMap((anime) => {
    const title = animeTitle(anime).trim();
    const image = anime.coverImage.extraLarge;
    if (!title || !image || !Number.isSafeInteger(anime.id) || anime.id <= 0) return [];
    return [{ id: anime.id, title, image, year: anime.seasonYear, score: anime.averageScore }];
  });

  return (
    <section className="vote-section" id="anime-vote" aria-label="Vote anime">
      <h2 className="section-heading">
        <ChevronRight />
        Vote anime
      </h2>
      <p className="community-subtitle">Your pick of the season</p>
      <div
        className="rank-list"
        role="group"
        aria-label="Anime voting candidates"
        aria-busy={candidatesQuery.isPending}
      >
        {candidatesQuery.isPending && candidates.length === 0 ? (
          <p className="detail-query-state" role="status">
            Loading current-season anime…
          </p>
        ) : candidatesQuery.isError && candidates.length === 0 ? (
          <div className="detail-query-state" role="alert">
            <p>Current-season anime could not be loaded from AniList.</p>
            <Button variant="outline" onClick={() => void candidatesQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="detail-query-state" role="status">
            No current-season anime with artwork are available to vote for right now.
          </p>
        ) : (
          candidates.map((anime) => (
            <Button
              key={anime.id}
              variant="ghost"
              className={`rank-item vote-item ${choice === anime.id ? "is-selected" : ""}`}
              aria-pressed={choice === anime.id}
              disabled={submitted}
              onClick={() => setChoice(anime.id)}
            >
              <img src={anime.image} alt="" loading="lazy" width={63} height={90} />
              <div className="rank-body">
                <div className="rank-title">
                  <span className="name">{anime.title}</span>
                </div>
                <span className="award-year">
                  {anime.year ?? "Year unavailable"}
                  {anime.score != null && anime.score > 0
                    ? ` · ${(anime.score / 10).toFixed(1)} ★`
                    : ""}
                </span>
              </div>
              <span className="vote-radio">{choice === anime.id && <Check size={13} />}</span>
            </Button>
          ))
        )}
      </div>
      {candidatesQuery.isError && candidates.length > 0 && (
        <p className="detail-query-state" role="status">
          AniList could not refresh these candidates; showing cached titles.
          <Button variant="link" size="sm" onClick={() => void candidatesQuery.refetch()}>
            Retry
          </Button>
        </p>
      )}
      <p className="vote-session-note">
        Your selection is for this visit only; votes are not shared or counted globally.
      </p>
      {submitted ? (
        <div className="vote-confirmation" role="status">
          <Check size={16} />
          <span>Selected for this visit</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Change your vote"
            title="Change your vote"
            onClick={() => setSubmitted(false)}
          >
            <RotateCcw size={15} />
          </Button>
        </div>
      ) : (
        <Button
          className="vote-submit"
          disabled={choice === null || candidates.length === 0}
          onClick={() => {
            if (choice !== null && candidates.some((candidate) => candidate.id === choice)) {
              setSubmitted(true);
            }
          }}
        >
          <Check /> Vote for your favorite
        </Button>
      )}
    </section>
  );
}

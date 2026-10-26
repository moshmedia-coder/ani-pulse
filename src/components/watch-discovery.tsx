import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { animeCatalog, type Anime } from "@/lib/anime-data";
import { animeTitle, type AniListMedia, type AniListRelatedMedia } from "@/lib/anilist";

interface WatchDiscoveryProps {
  media: AniListMedia | null | undefined;
  local: Anime | undefined;
  title: string;
  episode: number;
  episodeCount: number | null;
  releasedCount: number | null;
  isPending: boolean;
  isError: boolean;
}

const RELATED_TYPES = new Set(["ADAPTATION", "PREQUEL", "SEQUEL", "SIDE_STORY", "SPIN_OFF"]);

function releaseDate(date?: { year: number | null; month: number | null; day: number | null }) {
  if (!date?.year) return null;
  const parts = [String(date.year)];
  if (date.month) parts.push(String(date.month).padStart(2, "0"));
  if (date.day) parts.push(String(date.day).padStart(2, "0"));
  return parts.join("-");
}

function countryName(code?: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function getRelated(media: AniListMedia | null | undefined) {
  const seen = new Set<number>();
  return (media?.relations?.edges ?? [])
    .filter(
      (edge) =>
        (RELATED_TYPES.has(edge.relationType ?? "") || edge.node?.format === "OVA") &&
        edge.node?.isAdult !== true &&
        edge.node?.idMal != null &&
        Number.isSafeInteger(edge.node.idMal) &&
        edge.node.idMal > 0 &&
        !seen.has(edge.node.id),
    )
    .map((edge) => {
      seen.add(edge.node!.id);
      return edge.node!;
    });
}

function getRecommendations(media: AniListMedia | null | undefined) {
  const seen = new Set<number>();
  return (media?.recommendations?.nodes ?? [])
    .map((item) => item.mediaRecommendation)
    .filter(
      (item): item is AniListRelatedMedia =>
        item !== null &&
        item.isAdult !== true &&
        item.idMal != null &&
        Number.isSafeInteger(item.idMal) &&
        item.idMal > 0 &&
        !seen.has(item.id),
    )
    .filter((item) => {
      seen.add(item.id);
      return true;
    });
}

function AnimeRail({
  title,
  items,
  emptyMessage,
  variant = "rail",
}: {
  title: string;
  items: AniListRelatedMedia[];
  emptyMessage: string;
  variant?: "rail" | "grid";
}) {
  return (
    <section className="watch-rail-section" aria-label={title}>
      <div className="watch-section-heading">
        <h2>{title}</h2>
        <span>{items.length ? `${items.length} titles` : "AniList"}</span>
      </div>
      {items.length ? (
        <div className={variant === "grid" ? "watch-anime-grid" : "watch-anime-rail"}>
          {items.map((item) => {
            const local = animeCatalog.find((anime) => anime.id === item.idMal);
            const poster = item.coverImage.extraLarge ?? local?.image;
            const itemTitle = animeTitle(item) || local?.title || "Untitled anime";
            return (
              <Link
                key={item.id}
                to="/watch/$animeId"
                params={{ animeId: String(item.idMal) }}
                className="watch-anime-card"
              >
                <span className="watch-anime-poster">
                  {poster ? (
                    <img src={poster} alt="" loading="lazy" />
                  ) : (
                    <span className="watch-poster-placeholder" aria-hidden="true">
                      AP
                    </span>
                  )}
                  {item.averageScore != null && (
                    <span className="watch-card-score">
                      <Star aria-hidden="true" /> {(item.averageScore / 10).toFixed(1)}
                    </span>
                  )}
                </span>
                <span className="watch-card-title">{itemTitle}</span>
                <span className="watch-card-meta">
                  {[item.format?.replaceAll("_", " "), item.seasonYear]
                    .filter(Boolean)
                    .join(" · ") || "Details unavailable"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="watch-empty-state">{emptyMessage}</p>
      )}
    </section>
  );
}

export function WatchDiscovery({
  media,
  local,
  title,
  episode,
  episodeCount,
  releasedCount,
  isPending,
  isError,
}: WatchDiscoveryProps) {
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const synopsis = media?.description?.trim() || local?.description || "";
  const cleanSynopsis = synopsis
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const alternateTitle =
    media?.title.english && media.title.romaji && media.title.english !== media.title.romaji
      ? media.title.romaji
      : null;
  const rating =
    media?.averageScore != null && Number.isFinite(media.averageScore)
      ? (media.averageScore / 10).toFixed(1)
      : local?.score != null && Number.isFinite(local.score)
        ? local.score.toFixed(1)
        : null;
  const start =
    releaseDate(media?.startDate) ?? (media?.seasonYear ?? local?.year)?.toString() ?? null;
  const end = releaseDate(media?.endDate);
  const release = start && end && start !== end ? `${start} – ${end}` : (start ?? end);
  const seasonYear = media?.seasonYear ?? local?.year;
  const season = [media?.season, seasonYear].filter(Boolean).join(" ");
  const mediaGenres = media?.genres.map((genre) => genre.trim()).filter(Boolean) ?? [];
  const genres = mediaGenres.length ? mediaGenres : (local?.genres ?? []);
  const facts = [
    { label: "Format", value: media?.format?.replaceAll("_", " ") ?? local?.type ?? null },
    { label: "Status", value: media?.status?.replaceAll("_", " ") ?? (local?.status || null) },
    {
      label: "Episodes",
      value:
        episodeCount == null
          ? null
          : releasedCount != null && releasedCount !== episodeCount
            ? `${episodeCount} (${releasedCount} available)`
            : episodeCount,
    },
    { label: "Score", value: rating ? `${rating} / 10` : null },
    { label: "Duration", value: media?.duration ? `${media.duration} min / episode` : null },
    { label: "Season", value: season || null },
    { label: "Release", value: release },
    { label: "Country", value: countryName(media?.countryOfOrigin) },
    {
      label: "Studio",
      value:
        media?.studios?.nodes
          .map((studio) => studio.name)
          .filter(Boolean)
          .join(", ") || null,
    },
    {
      label: "Adult content",
      value: media?.isAdult == null ? null : media.isAdult ? "Flagged" : "Not flagged",
    },
  ].filter(
    (fact): fact is { label: string; value: string | number } =>
      fact.value != null && fact.value !== "",
  );
  const characters = media?.characters?.edges ?? [];

  return (
    <div className="watch-discovery">
      <section className="watch-info" aria-labelledby="watch-anime-title">
        {(media?.coverImage.extraLarge || local?.image) && (
          <img
            src={media?.coverImage.extraLarge ?? local?.image}
            alt={`${title} poster`}
            width={150}
            height={218}
          />
        )}
        <div className="watch-info-copy">
          <p className="watch-kicker">ANIME DETAILS</p>
          <h1 id="watch-anime-title">{title}</h1>
          {alternateTitle && <p className="watch-alternate-title">{alternateTitle}</p>}
          <p className="watch-current-episode">
            {releasedCount == null
              ? `Episode ${episode} · Episode count unavailable`
              : `Episode ${episode} of ${releasedCount} available${releasedCount !== episodeCount && episodeCount != null ? ` (${episodeCount} total planned)` : ""}`}
          </p>
          <div className="watch-genres" aria-label="Genres">
            {genres.map((genre) => (
              <span key={genre}>{genre}</span>
            ))}
          </div>
          {cleanSynopsis && (
            <div className="watch-synopsis">
              <p>
                {descriptionExpanded || cleanSynopsis.length <= 260
                  ? cleanSynopsis
                  : `${cleanSynopsis.slice(0, 260).trimEnd()}…`}
              </p>
              {cleanSynopsis.length > 260 && (
                <button
                  type="button"
                  aria-expanded={descriptionExpanded}
                  onClick={() => setDescriptionExpanded(!descriptionExpanded)}
                >
                  {descriptionExpanded ? "Show less" : "Read full synopsis"}
                </button>
              )}
            </div>
          )}
          <dl className="watch-facts">
            {facts.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {isError && (
            <p className="watch-fallback-note" role="status">
              AniList details are unavailable; showing catalog information where possible.
            </p>
          )}
          {isPending && <p className="watch-fallback-note">Loading anime details…</p>}
        </div>
      </section>

      <section className="watch-rail-section" aria-label="Characters and voice actors">
        <div className="watch-section-heading">
          <h2>Characters &amp; Voice Actors</h2>
          {characters.length > 0 && <span>{characters.length} characters</span>}
        </div>
        {characters.length > 0 ? (
          <div className="watch-character-grid">
            {characters.map(({ node, role, voiceActors, englishVoiceActors }) => {
              const japanese = voiceActors?.find((actor) => actor.name.full)?.name.full;
              const english = englishVoiceActors?.find((actor) => actor.name.full)?.name.full;
              return (
                <article className="watch-character-card" key={node.id}>
                  <div className="watch-character-portrait">
                    {node.image.large ? (
                      <img src={node.image.large} alt="" loading="lazy" />
                    ) : (
                      <span aria-hidden="true">{node.name.full?.slice(0, 1) ?? "?"}</span>
                    )}
                  </div>
                  <h3>{node.name.full ?? "Name unavailable"}</h3>
                  {role && <p className="watch-character-role">{role}</p>}
                  <dl>
                    {japanese && (
                      <div>
                        <dt>Japanese</dt>
                        <dd>{japanese}</dd>
                      </div>
                    )}
                    {english && (
                      <div>
                        <dt>English</dt>
                        <dd>{english}</dd>
                      </div>
                    )}
                    {!japanese && !english && <p>Voice actor unavailable</p>}
                  </dl>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="watch-empty-state">
            {isPending
              ? "Loading character and voice actor details…"
              : isError
                ? "Character and voice actor details are unavailable right now."
                : "Character details are not listed for this title yet."}
          </p>
        )}
      </section>

      <AnimeRail
        title="Related Anime"
        items={getRelated(media)}
        emptyMessage={
          isPending ? "Loading related anime…" : "Related anime is not listed for this title yet."
        }
      />
      <AnimeRail
        title="You Might Also Like"
        items={getRecommendations(media)}
        variant="grid"
        emptyMessage={
          isPending
            ? "Loading recommendations…"
            : isError
              ? "Recommendations are unavailable right now."
              : "Recommendations are not available for this title yet."
        }
      />
    </div>
  );
}

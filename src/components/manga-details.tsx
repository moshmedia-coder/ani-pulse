import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, Star } from "lucide-react";
import { Brand } from "@/components/anipulse-brand";
import {
  MangaAdaptationArtworkGallery,
  MangaArtworkGallery,
  MangaPromotionalVideo,
} from "@/components/manga-promotional-media";
import { MangaReader } from "@/components/manga-reader";
import { Button } from "@/components/ui/button";
import { animeTitle, mangaDetailsQuery, type AniListMangaMedia } from "@/lib/anilist";
import {
  cleanMangaSynopsis,
  mangaAdaptationArtwork,
  mangaArtwork,
  mangaCredits,
  mangaPromotionalVideo,
  mangaPublicationDate,
} from "@/lib/manga-details";

function MangaCover({ title, src }: { title: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="manga-detail-cover">
      {src && !failed ? (
        <img
          src={src}
          alt={`${title} cover`}
          width={420}
          height={610}
          onError={() => setFailed(true)}
        />
      ) : (
        <BookOpen aria-hidden="true" />
      )}
    </div>
  );
}

function CreditSection({
  title,
  credits,
}: {
  title: string;
  credits: { name: string; role: string }[];
}) {
  if (credits.length === 0) return null;
  return (
    <section className="manga-credit-group" aria-labelledby={`manga-${title.toLowerCase()}-title`}>
      <h3 id={`manga-${title.toLowerCase()}-title`}>{title}</h3>
      <ul>
        {credits.map(({ name, role }) => (
          <li key={`${name}-${role}`}>
            <span>{name}</span>
            <span>{role}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function dateLabel(media: AniListMangaMedia) {
  const start = mangaPublicationDate(media.startDate);
  const end = mangaPublicationDate(media.endDate);
  if (start && end) return start === end ? start : `${start} – ${end}`;
  return start ?? end;
}

function displayFormat(format: string | null | undefined) {
  return format
    ?.replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

export function MangaDetails({ mangaId }: { mangaId: number | null }) {
  const validId = mangaId !== null && Number.isSafeInteger(mangaId) && mangaId > 0;
  const query = useQuery({
    ...mangaDetailsQuery(validId ? mangaId : 0),
    enabled: validId,
  });
  const manga = query.data ?? undefined;
  const title = manga ? animeTitle(manga).trim() || manga.title.romaji : "";
  const alternateTitles = manga
    ? [manga.title.romaji, manga.title.native?.trim() ?? ""]
        .filter((alternative) => alternative && alternative !== title)
        .filter((alternative, index, list) => list.indexOf(alternative) === index)
    : [];
  const credits = mangaCredits(manga);
  const synopsis = cleanMangaSynopsis(manga?.description);
  const artwork = mangaArtwork(manga, title);
  const adaptationArtwork = mangaAdaptationArtwork(manga, artwork);
  const coverUrl = artwork.find((image) => image.alt === `${title} cover artwork`)?.url ?? null;
  const promotionalVideo = mangaPromotionalVideo(manga);
  const publicationDate = manga ? dateLabel(manga) : null;
  const publicationFormat = displayFormat(manga?.format);
  const mangaTags = (manga?.tags ?? [])
    .filter((tag) => !tag.isAdult && tag.name.trim())
    .slice(0, 10);

  return (
    <>
      <header className="site-header manga-header">
        <Link to="/" aria-label="AniPulse home">
          <Brand />
        </Link>
        <div className="manga-header-actions">
          <Link to="/manga">Manga</Link>
          <Button asChild variant="outline">
            <Link to="/">Explore anime</Link>
          </Button>
        </div>
      </header>
      <main className="main-wrap manga-main manga-detail-main">
        <Link className="manga-back-link" to="/manga">
          <BookOpen aria-hidden="true" /> Back to manga discovery
        </Link>
        {!validId ? (
          <p className="manga-query-state" role="alert">
            This manga ID is invalid.
          </p>
        ) : query.isPending ? (
          <p className="manga-query-state" role="status">
            Loading manga details…
          </p>
        ) : query.isError ? (
          <div className="manga-query-state" role="alert">
            <p>AniList could not load this manga. Please try again.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry
            </Button>
          </div>
        ) : !manga ? (
          <p className="manga-query-state" role="status">
            This manga was not found on AniList.
          </p>
        ) : (
          <div className="manga-detail-page">
            <section className="manga-hero" aria-labelledby="manga-detail-title">
              <MangaCover title={title} src={coverUrl} />
              <div className="manga-hero-copy">
                <p className="manga-eyebrow">ANILIST MANGA</p>
                <h1 id="manga-detail-title">{title}</h1>
                {alternateTitles.length > 0 && (
                  <p className="manga-alternative-titles">
                    Also known as: {alternateTitles.join(" · ")}
                  </p>
                )}
                <div className="manga-detail-meta">
                  {manga.averageScore !== null && Number.isFinite(manga.averageScore) && (
                    <span>
                      <Star aria-hidden="true" /> {(manga.averageScore / 10).toFixed(1)} / 10
                    </span>
                  )}
                  {manga.status && <span>{manga.status.replaceAll("_", " ")}</span>}
                  {manga.startDate?.year != null && <span>{manga.startDate.year}</span>}
                  {manga.chapters !== null && manga.chapters > 0 && (
                    <span>{manga.chapters} chapters</span>
                  )}
                  {manga.volumes !== null && manga.volumes > 0 && (
                    <span>{manga.volumes} volumes</span>
                  )}
                  {Number.isFinite(manga.popularity) && manga.popularity >= 0 && (
                    <span>{manga.popularity.toLocaleString()} followers</span>
                  )}
                </div>
                {manga.genres.length > 0 && (
                  <ul className="manga-detail-genres" aria-label="Genres">
                    {manga.genres.map((genre) => (
                      <li key={genre}>{genre}</li>
                    ))}
                  </ul>
                )}
                <a
                  className="manga-anilist-link"
                  href={`https://anilist.co/manga/${manga.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on AniList
                </a>
              </div>
            </section>

            <div className="manga-detail-sections">
              {synopsis && (
                <section
                  className="manga-detail-section manga-detail-description"
                  aria-labelledby="manga-synopsis-title"
                >
                  <div className="manga-section-title">
                    <p className="manga-eyebrow">THE STORY</p>
                    <h2 id="manga-synopsis-title">Synopsis</h2>
                  </div>
                  <p>{synopsis}</p>
                </section>
              )}

              {(credits.authors.length > 0 || credits.artists.length > 0) && (
                <section
                  className="manga-detail-section manga-credits"
                  aria-labelledby="manga-credits-title"
                >
                  <div className="manga-section-title">
                    <p className="manga-eyebrow">CREATORS</p>
                    <h2 id="manga-credits-title">Authors &amp; artists</h2>
                  </div>
                  <div className="manga-credit-columns">
                    <CreditSection title="Authors" credits={credits.authors} />
                    <CreditSection title="Artists" credits={credits.artists} />
                  </div>
                </section>
              )}

              {(publicationFormat ||
                manga.countryOfOrigin ||
                publicationDate ||
                mangaTags.length > 0) && (
                <section
                  className="manga-detail-section manga-publication"
                  aria-labelledby="manga-publication-title"
                >
                  <div className="manga-section-title">
                    <p className="manga-eyebrow">PUBLICATION</p>
                    <h2 id="manga-publication-title">Publication information</h2>
                  </div>
                  <dl>
                    {publicationFormat && (
                      <div>
                        <dt>Format</dt>
                        <dd>{publicationFormat}</dd>
                      </div>
                    )}
                    {manga.countryOfOrigin && (
                      <div>
                        <dt>Country of origin</dt>
                        <dd>{manga.countryOfOrigin}</dd>
                      </div>
                    )}
                    {publicationDate && (
                      <div>
                        <dt>Publication dates</dt>
                        <dd>{publicationDate}</dd>
                      </div>
                    )}
                  </dl>
                  {mangaTags.length > 0 && (
                    <div className="manga-anilist-tags">
                      <h3>AniList tags</h3>
                      <ul>
                        {mangaTags.map((tag) => (
                          <li key={`${tag.category}-${tag.name}`}>
                            <span>{tag.name}</span>
                            <small>{tag.category}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              <MangaArtworkGallery artwork={artwork} />
              <MangaAdaptationArtworkGallery adaptations={adaptationArtwork} />
              <MangaPromotionalVideo video={promotionalVideo} />
              <MangaReader
                {...(manga.externalLinks !== undefined
                  ? { externalLinks: manga.externalLinks }
                  : {})}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

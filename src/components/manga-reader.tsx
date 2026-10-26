import type { AniListMangaExternalLink } from "@/lib/anilist";
import { verifiedOfficialReadingLinks } from "@/lib/manga-reader";

export function MangaReader({
  externalLinks,
}: {
  externalLinks?: AniListMangaExternalLink[] | null;
}) {
  const officialLinks = verifiedOfficialReadingLinks(externalLinks);

  return (
    <section className="manga-reader" aria-labelledby="manga-reader-heading">
      <div className="manga-reader-heading">
        <div>
          <p className="manga-eyebrow">READING</p>
          <h2 id="manga-reader-heading">Read manga</h2>
        </div>
      </div>
      {officialLinks.length > 0 ? (
        <div className="manga-reader-actions">
          {officialLinks.map((link) => (
            <div className="manga-reader-option" key={link.url}>
              <a
                className="manga-reader-official-link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read on {link.site}
              </a>
              {link.language && <span>{link.language} edition</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="manga-reader-fallback">
          No verified official reading source is available yet.
        </p>
      )}
    </section>
  );
}

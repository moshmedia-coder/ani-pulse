import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type {
  MangaAdaptationArtworkGroup,
  MangaArtwork,
  MangaPromotionalVideo,
} from "@/lib/manga-details";

function GalleryImageGrid({
  artwork,
  onSelect,
  onImageError,
}: {
  artwork: MangaArtwork[];
  onSelect: (image: MangaArtwork) => void;
  onImageError: (image: MangaArtwork) => void;
}) {
  return (
    <div className="manga-gallery-grid">
      {artwork.map((image) => (
        <button
          className="manga-gallery-item"
          key={image.url}
          type="button"
          onClick={() => onSelect(image)}
          aria-label={`View larger image: ${image.alt}`}
        >
          <img
            src={image.url}
            alt={image.alt}
            loading="lazy"
            onError={() => onImageError(image)}
          />
          <span>View artwork</span>
        </button>
      ))}
    </div>
  );
}

function GalleryLightbox({
  selected,
  onClose,
  description,
}: {
  selected: MangaArtwork | null;
  onClose: () => void;
  description: string;
}) {
  return (
    <Dialog
      open={selected !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="manga-gallery-dialog">
        {selected && (
          <>
            <DialogTitle>{selected.alt}</DialogTitle>
            <DialogDescription className="sr-only">{description}</DialogDescription>
            <img className="manga-gallery-large" src={selected.url} alt={selected.alt} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MangaArtworkGallery({ artwork }: { artwork: MangaArtwork[] }) {
  const [selected, setSelected] = useState<MangaArtwork | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const availableArtwork = artwork.filter((image) => !failedImages.has(image.url));

  if (artwork.length === 0) return null;

  return (
    <>
      <section className="manga-detail-section manga-gallery" aria-labelledby="manga-gallery-title">
        <div className="manga-section-title">
          <p className="manga-eyebrow">ARTWORK</p>
          <h2 id="manga-gallery-title">Gallery</h2>
        </div>
        {availableArtwork.length > 0 ? (
          <GalleryImageGrid
            artwork={availableArtwork}
            onSelect={setSelected}
            onImageError={(image) =>
              setFailedImages((current) => new Set([...current, image.url]))
            }
          />
        ) : (
          <p className="manga-gallery-unavailable" role="status">
            Artwork could not be loaded.
          </p>
        )}
      </section>
      <GalleryLightbox
        selected={selected}
        onClose={() => setSelected(null)}
        description="Full-size manga artwork. Close this dialog to return to the manga details."
      />
    </>
  );
}

export function MangaAdaptationArtworkGallery({
  adaptations,
}: {
  adaptations: MangaAdaptationArtworkGroup[];
}) {
  const [selected, setSelected] = useState<MangaArtwork | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const availableAdaptations = adaptations
    .map((adaptation) => ({
      ...adaptation,
      artwork: adaptation.artwork.filter((image) => !failedImages.has(image.url)),
    }))
    .filter(({ artwork }) => artwork.length > 0);

  if (adaptations.length === 0) return null;

  return (
    <>
      <section
        className="manga-detail-section manga-adaptation-artwork"
        aria-labelledby="manga-adaptation-artwork-title"
      >
        <div className="manga-section-title">
          <p className="manga-eyebrow">RELATED ANIME</p>
          <h2 id="manga-adaptation-artwork-title">Related Adaptation Artwork</h2>
        </div>
        {availableAdaptations.length > 0 ? (
          <div className="manga-adaptation-groups">
            {availableAdaptations.map((adaptation) => (
              <section
                className="manga-adaptation-group"
                key={adaptation.id}
                aria-label={`${adaptation.title} adaptation artwork`}
              >
                <h3>{adaptation.title}</h3>
                <GalleryImageGrid
                  artwork={adaptation.artwork}
                  onSelect={setSelected}
                  onImageError={(image) =>
                    setFailedImages((current) => new Set([...current, image.url]))
                  }
                />
              </section>
            ))}
          </div>
        ) : (
          <p className="manga-gallery-unavailable" role="status">
            Artwork could not be loaded.
          </p>
        )}
      </section>
      <GalleryLightbox
        selected={selected}
        onClose={() => setSelected(null)}
        description="Full-size anime adaptation artwork. Close this dialog to return to the manga details."
      />
    </>
  );
}

export function MangaPromotionalVideo({ video }: { video: MangaPromotionalVideo | null }) {
  if (!video) return null;
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(video.videoId)}`;

  return (
    <section className="manga-detail-section manga-video" aria-labelledby="manga-video-title">
      <div className="manga-section-title">
        <p className="manga-eyebrow">
          {video.kind === "adaptation" ? "RELATED ANIME" : "PROMOTIONAL MEDIA"}
        </p>
        <h2 id="manga-video-title">
          {video.kind === "adaptation" ? "Anime adaptation trailer" : "Manga promotional video"}
        </h2>
      </div>
      <div className="manga-video-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.videoId)}`}
          title={video.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <a className="manga-video-source" href={watchUrl} target="_blank" rel="noopener noreferrer">
        Watch on YouTube
      </a>
    </section>
  );
}

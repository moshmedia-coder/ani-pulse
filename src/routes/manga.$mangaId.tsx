import { createFileRoute } from "@tanstack/react-router";
import { MangaDetails } from "@/components/manga-details";

export const Route = createFileRoute("/manga/$mangaId")({
  head: () => ({
    meta: [
      { title: "AniPulse — Manga details and reading" },
      {
        name: "description",
        content: "Explore manga details and verified publisher reading options on AniPulse.",
      },
    ],
  }),
  component: MangaDetailsRoute,
});

function MangaDetailsRoute() {
  const { mangaId } = Route.useParams();
  const parsedId = /^\d+$/.test(mangaId) ? Number(mangaId) : null;
  return <MangaDetails mangaId={parsedId} />;
}

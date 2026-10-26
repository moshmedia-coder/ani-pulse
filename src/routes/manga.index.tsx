import { createFileRoute } from "@tanstack/react-router";
import { MangaDiscovery } from "@/components/manga-discovery";

export const Route = createFileRoute("/manga/")({
  head: () => ({
    meta: [
      { title: "AniPulse — Discover manga" },
      {
        name: "description",
        content: "Discover trending, popular, and top-rated manga with AniList.",
      },
    ],
  }),
  component: MangaDiscovery,
});

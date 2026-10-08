import { createFileRoute } from "@tanstack/react-router";
import { AnimeHome } from "@/components/anime-home";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Miruro — Discover your next anime obsession" },
      {
        name: "description",
        content:
          "Explore popular anime, discover new favorites, curate your watchlist, and browse the weekly airing schedule.",
      },
      { property: "og:title", content: "Miruro — Discover your next anime obsession" },
      {
        property: "og:description",
        content: "Your anime universe: trending series, unforgettable movies, and new adventures.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnimeHome,
});

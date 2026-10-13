export interface Anime {
  id: number;
  title: string;
  image: string;
  score: number;
  year: number;
  episodes: number;
  genres: string[];
  popularity: number;
  type: string;
  status: string;
  description: string;
}

export function matchesAnimeSearch(anime: Anime, query: string) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalizedQuery) return true;

  return [
    anime.title,
    ...anime.genres,
    anime.type,
    anime.year,
    anime.score,
    anime.status,
    anime.description,
    anime.id,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export const animeAwards = [
  {
    animeId: 199,
    recognition: "Academy Awards · Best Animated Feature",
    year: 2003,
    source: "https://www.oscars.org/oscars/ceremonies/2003",
  },
  {
    animeId: 40748,
    recognition: "Crunchyroll Anime Awards · Anime of the Year",
    year: 2021,
    source: "https://www.ign.com/articles/crunchyrolls-anime-awards-winners-announced",
  },
  {
    animeId: 32281,
    recognition: "Sitges · Anima’t Best Feature Film",
    year: 2016,
    source: "https://sitgesfilmfestival.com/en/festival/historia/2016/awards",
  },
  {
    animeId: 37510,
    recognition: "Japan Academy Film Prize · Animation of the Year",
    year: 2020,
    source: "https://www.japan-academy-prize.jp/news/index_news2020.php",
  },
];

export const animeCatalog: Anime[] = [
  {
    id: 52991,
    title: "Frieren: Beyond Journey's End",
    image: "/images/anime/52991.jpg",
    score: 9.3,
    year: 2023,
    episodes: 28,
    genres: ["Adventure", "Drama", "Fantasy"],
    popularity: 99,
    type: "TV",
    status: "",
    description:
      "After the demon king is defeated, an elven mage begins a new journey to understand the people she once traveled with. Some adventures begin where others end.",
  },
  {
    id: 52299,
    title: "Solo Leveling",
    image: "/images/anime/52299.jpg",
    score: 8.3,
    year: 2024,
    episodes: 12,
    genres: ["Action", "Adventure", "Fantasy"],
    popularity: 97,
    type: "TV",
    status: "",
    description:
      "In a world of hunters and monsters, the weakest hunter receives a mysterious power that lets him level up without limits.",
  },
  {
    id: 51009,
    title: "Demon Slayer: Swordsmith Village Arc",
    image: "/images/anime/51009.jpg",
    score: 8.2,
    year: 2023,
    episodes: 11,
    genres: ["Action", "Fantasy"],
    popularity: 94,
    type: "TV",
    status: "",
    description:
      "Tanjiro journeys to the Swordsmith Village, where new allies and powerful demons await in a battle to protect those he loves.",
  },
  {
    id: 44511,
    title: "Chainsaw Man",
    image: "/images/anime/44511.jpg",
    score: 8.5,
    year: 2022,
    episodes: 12,
    genres: ["Action", "Supernatural"],
    popularity: 95,
    type: "TV",
    status: "",
    description:
      "A young devil hunter with a chainsaw heart finds a new life, dangerous enemies, and dreams worth fighting for.",
  },
  {
    id: 40748,
    title: "Jujutsu Kaisen",
    image: "/images/anime/40748.jpg",
    score: 8.6,
    year: 2020,
    episodes: 24,
    genres: ["Action", "Supernatural"],
    popularity: 98,
    type: "TV",
    status: "",
    description:
      "Enter the world of Jujutsu Kaisen, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 21,
    title: "One Piece",
    image: "/images/anime/21.jpg",
    score: 8.7,
    year: 1999,
    episodes: 1122,
    genres: ["Action", "Adventure", "Fantasy"],
    popularity: 100,
    type: "TV",
    status: "",
    description:
      "Enter the world of One Piece, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 54492,
    title: "The Apothecary Diaries",
    image: "/images/anime/54492.jpg",
    score: 8.9,
    year: 2023,
    episodes: 24,
    genres: ["Drama", "Mystery"],
    popularity: 92,
    type: "TV",
    status: "",
    description:
      "A sharp-witted apothecary uncovers the secrets of the imperial palace, one mystery at a time.",
  },
  {
    id: 50265,
    title: "SPY x FAMILY",
    image: "/images/anime/50265.jpg",
    score: 8.5,
    year: 2022,
    episodes: 12,
    genres: ["Action", "Comedy"],
    popularity: 93,
    type: "TV",
    status: "",
    description:
      "Enter the world of SPY x FAMILY, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 46569,
    title: "Hell's Paradise",
    image: "/images/anime/46569.jpg",
    score: 8.1,
    year: 2023,
    episodes: 13,
    genres: ["Action", "Adventure", "Fantasy"],
    popularity: 90,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Hell's Paradise, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 52034,
    title: "Oshi No Ko",
    image: "/images/anime/52034.jpg",
    score: 8.6,
    year: 2023,
    episodes: 11,
    genres: ["Drama", "Mystery"],
    popularity: 91,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Oshi No Ko, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 49596,
    title: "Blue Lock",
    image: "/images/anime/49596.jpg",
    score: 8.2,
    year: 2022,
    episodes: 24,
    genres: ["Sports", "Drama"],
    popularity: 88,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Blue Lock, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 28851,
    title: "A Silent Voice",
    image: "/images/anime/28851.jpg",
    score: 8.9,
    year: 2016,
    episodes: 1,
    genres: ["Drama", "Romance"],
    popularity: 94,
    type: "MOVIE",
    status: "finished",
    description:
      "A former bully seeks forgiveness from the deaf classmate he hurt. A moving story of connection, kindness, and second chances.",
  },
  {
    id: 32281,
    title: "Your Name.",
    image: "/images/anime/32281.jpg",
    score: 8.8,
    year: 2016,
    episodes: 1,
    genres: ["Drama", "Romance", "Supernatural"],
    popularity: 96,
    type: "MOVIE",
    status: "finished",
    description:
      "Two strangers discover they are mysteriously swapping lives. Across time and distance, they search for the connection that binds them.",
  },
  {
    id: 199,
    title: "Spirited Away",
    image: "/images/anime/199.jpg",
    score: 8.8,
    year: 2001,
    episodes: 1,
    genres: ["Adventure", "Fantasy"],
    popularity: 93,
    type: "MOVIE",
    status: "finished",
    description:
      "A young girl enters a spirit world to save her parents, finding courage and unexpected friendships along the way.",
  },
  {
    id: 37510,
    title: "Weathering with You",
    image: "/images/anime/37510.jpg",
    score: 8.3,
    year: 2019,
    episodes: 1,
    genres: ["Drama", "Romance", "Fantasy"],
    popularity: 89,
    type: "MOVIE",
    status: "finished",
    description:
      "Enter the world of Weathering with You, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 38000,
    title: "Demon Slayer: Kimetsu no Yaiba",
    image: "/images/anime/38000.jpg",
    score: 8.4,
    year: 2019,
    episodes: 26,
    genres: ["Action", "Fantasy"],
    popularity: 95,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Demon Slayer: Kimetsu no Yaiba, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 16498,
    title: "Attack on Titan",
    image: "/images/anime/16498.jpg",
    score: 8.6,
    year: 2013,
    episodes: 25,
    genres: ["Action", "Drama", "Mystery"],
    popularity: 99,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Attack on Titan, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 38524,
    title: "Attack on Titan Season 3 Part 2",
    image: "/images/anime/38524.jpg",
    score: 9.1,
    year: 2019,
    episodes: 10,
    genres: ["Action", "Drama"],
    popularity: 97,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Attack on Titan Season 3 Part 2, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
  {
    id: 41467,
    title: "Bleach: Thousand-Year Blood War",
    image: "/images/anime/41467.jpg",
    score: 9.0,
    year: 2022,
    episodes: 13,
    genres: ["Action", "Adventure", "Supernatural"],
    popularity: 92,
    type: "TV",
    status: "finished",
    description:
      "Enter the world of Bleach: Thousand-Year Blood War, where unforgettable characters, unexpected discoveries, and extraordinary adventures await.",
  },
];

import type { AniListMangaExternalLink } from "@/lib/anilist";

const OFFICIAL_READING_DOMAINS = [
  {
    aliases: ["azuki"],
    label: "Azuki",
    domain: "azuki.co",
    path: /^\/series\/[^/]+/i,
  },
  {
    aliases: ["bookwalker", "global bookwalker"],
    label: "BOOK☆WALKER",
    domain: "bookwalker.jp",
    path: /^\/de\d+/i,
  },
  {
    aliases: ["comikey"],
    label: "Comikey",
    domain: "comikey.com",
    path: /^\/(?:comics?|series)\/[^/]+/i,
  },
  {
    aliases: ["inkr"],
    label: "INKR",
    domain: "inkr.com",
    path: /^\/(?:title|series)\/[^/]+/i,
  },
  {
    aliases: ["k manga", "kmanga"],
    label: "K MANGA",
    domain: "kodansha.com",
    path: /^\/(?:title|titles)\/[^/]+/i,
  },
  {
    aliases: ["manga plus", "manga plus by shueisha"],
    label: "MANGA Plus",
    domain: "mangaplus.shueisha.co.jp",
    path: /^\/(?:title|titles|manga|view|viewer)\/[^/]+/i,
  },
  {
    aliases: ["manga up", "manga up!"],
    label: "Manga UP!",
    domain: "manga-up.com",
    path: /^\/manga\/[^/]+/i,
  },
  {
    aliases: ["tapas"],
    label: "Tapas",
    domain: "tapas.io",
    path: /^\/series\/[^/]+/i,
  },
  {
    aliases: ["viz"],
    label: "VIZ",
    domain: "viz.com",
    path: /^\/read\/[^/]+/i,
  },
  {
    aliases: ["webtoon", "webtoons"],
    label: "WEBTOON",
    domain: "webtoons.com",
    path: /^\/[a-z-]+\/[^/]+\/[^/]+\/list/i,
  },
];

export interface OfficialMangaReadingLink {
  site: string;
  url: string;
  language: string | null;
}

export function verifiedOfficialReadingLinks(
  links: AniListMangaExternalLink[] | null | undefined,
): OfficialMangaReadingLink[] {
  const unique = new Map<string, OfficialMangaReadingLink>();
  for (const link of links ?? []) {
    try {
      const url = new URL(link.url);
      const normalizedSite = link.site
        .trim()
        .toLowerCase()
        .replace(/[™®]/g, "")
        .replace(/\s+/g, " ");
      const publisher = OFFICIAL_READING_DOMAINS.find((entry) =>
        entry.aliases.includes(normalizedSite),
      );
      const allowedDomain =
        publisher &&
        (url.hostname === publisher.domain || url.hostname.endsWith(`.${publisher.domain}`));
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        link.type !== "INFO" ||
        !allowedDomain ||
        !publisher.path.test(url.pathname)
      ) {
        continue;
      }

      for (const key of [...url.searchParams.keys()]) {
        if (/^utm_/i.test(key)) url.searchParams.delete(key);
      }
      url.hash = "";
      const normalizedUrl = url.href.replace(/\/$/, "");
      if (!unique.has(normalizedUrl)) {
        unique.set(normalizedUrl, {
          site: publisher.label,
          url: normalizedUrl,
          language: link.language?.trim() || null,
        });
      }
    } catch {
      continue;
    }
  }
  return [...unique.values()];
}

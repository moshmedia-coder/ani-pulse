import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { animeCatalog } from "@/lib/anime-data";
import { mediaByMalQuery } from "@/lib/anilist";

describe("anime catalog identity mappings", () => {
  it("keeps Swordsmith Village and Jujutsu Kaisen on their own IDs and poster assets", () => {
    const swordsmithVillage = animeCatalog.find(
      (anime) => anime.title === "Demon Slayer: Swordsmith Village Arc",
    );
    const jujutsuKaisen = animeCatalog.find((anime) => anime.title === "Jujutsu Kaisen");

    expect(swordsmithVillage).toMatchObject({
      id: 51019,
      image: "/images/anime/51019.png",
    });
    expect(jujutsuKaisen).toMatchObject({
      id: 40748,
      image: "/images/anime/40748.jpg",
    });
    expect(swordsmithVillage).toBeDefined();
    expect(jujutsuKaisen).toBeDefined();
    expect(mediaByMalQuery(swordsmithVillage!.id).queryKey).toEqual(["anilist", "media", 51019]);
    expect(existsSync(resolve("public", "images", "anime", "51019.png"))).toBe(true);
    expect(existsSync(resolve("public", "images", "anime", "40748.jpg"))).toBe(true);
  });
});

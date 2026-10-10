import { ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { animeCatalog } from "@/lib/anime-data";

const actors = [
  { name: "Yuki Kaji", role: "Eren Yeager", animeId: 16498, source: "https://myanimelist.net/people/672/Yuuki_Kaji" },
  { name: "Natsuki Hanae", role: "Tanjiro Kamado", animeId: 51009, source: "https://myanimelist.net/people/16635/Natsuki_Hanae" },
  { name: "Saori Hayami", role: "Yor Forger", animeId: 50265, source: "https://myanimelist.net/people/869/Saori_Hayami" },
  { name: "Junichi Suwabe", role: "Ryomen Sukuna", animeId: 40748, source: "https://myanimelist.net/people/95/Junichi_Suwabe" },
];

export function VoiceActors() {
  return <section className="voice-actors" aria-label="Popular anime voice actors">
    <h2 className="section-heading"><ChevronRight />Popular voice actors</h2>
    <p className="community-subtitle">The voices behind your favorites</p>
    <div className="rank-list">
      {actors.map((actor) => {
        const anime = animeCatalog.find((item) => item.id === actor.animeId);
        return <Button asChild variant="ghost" className="rank-item actor-item" key={actor.name}><a href={actor.source} target="_blank" rel="noopener noreferrer" aria-label={`${actor.name}, Japanese voice of ${actor.role}, view profile`}>
          {anime && <img src={anime.image} alt={`${anime.title} artwork`} loading="lazy" width={72} height={90} />}
          <div className="rank-body"><div className="rank-title"><span className="name">{actor.name}</span></div><p className="actor-role">{actor.role}</p><span className="actor-language">Japanese voice</span></div><ExternalLink size={13} className="text-muted-foreground shrink-0" />
        </a></Button>;
      })}
    </div>
  </section>;
}
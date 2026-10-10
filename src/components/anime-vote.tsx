import { useState } from "react";
import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { animeCatalog } from "@/lib/anime-data";
import { Button } from "@/components/ui/button";

export function AnimeVote() {
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const candidates = animeCatalog.slice(0, 4);
  return <section className="vote-section" id="anime-vote" aria-label="Vote anime">
    <h2 className="section-heading"><ChevronRight />Vote anime</h2>
    <p className="community-subtitle">Your pick of the season</p>
    <div className="rank-list" role="group" aria-label="Anime voting candidates">
      {candidates.map((anime) => <Button key={anime.id} variant="ghost" className={`rank-item vote-item ${choice === anime.id ? "is-selected" : ""}`} aria-pressed={choice === anime.id} disabled={submitted} onClick={() => setChoice(anime.id)}><img src={anime.image} alt="" loading="lazy" width={63} height={90} /><div className="rank-body"><div className="rank-title"><span className="name">{anime.title}</span></div><span className="award-year">{anime.year} · {anime.score} ★</span></div><span className="vote-radio">{choice === anime.id && <Check size={13} />}</span></Button>)}
    </div>
    {submitted ? <div className="vote-confirmation" role="status"><Check size={16} /><span>Selected for this visit</span><Button variant="ghost" size="icon" aria-label="Change your vote" title="Change your vote" onClick={() => setSubmitted(false)}><RotateCcw size={15} /></Button></div> : <Button className="vote-submit" disabled={choice === null} onClick={() => setSubmitted(true)}><Check /> Vote for your favorite</Button>}
  </section>;
}
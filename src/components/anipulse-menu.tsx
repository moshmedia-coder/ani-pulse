import { useState } from "react";
import { Bookmark, CalendarDays, Check, History, Home, Monitor, Settings, TrendingUp, UserRound, Vote } from "lucide-react";
import { Brand } from "@/components/anipulse-brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type MenuView = "Home" | "Trending" | "Schedule" | "History" | "Watchlist" | "Vote anime";
export function AniPulseMenu({ open, onOpenChange, onNavigate, paused, togglePaused, savedCount, historyCount }: {
  open: boolean; onOpenChange: (open: boolean) => void; onNavigate: (view: MenuView) => void;
  paused: boolean; togglePaused: () => void; savedCount: number; historyCount: number;
}) {
  const [active, setActive] = useState<MenuView>("Home");
  const [settings, setSettings] = useState(false);
  const links = [{ label: "Home", icon: Home }, { label: "Trending", icon: TrendingUp }, { label: "Schedule", icon: CalendarDays }, { label: "History", icon: History }, { label: "Watchlist", icon: Bookmark }, { label: "Vote anime", icon: Vote }] as const;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="left" className="anipulse-menu">
      <div className="menu-heading"><SheetTitle><Brand /></SheetTitle><SheetDescription className="sr-only">AniPulse navigation</SheetDescription></div>
      <nav aria-label="Main navigation" className="menu-links">
        {links.map(({ label, icon: Icon }) => <Button key={label} variant="ghost" className={`menu-link ${active === label ? "is-selected" : ""}`} onClick={() => { setActive(label); onNavigate(label); }}><Icon /><span>{label}</span>{label === "Watchlist" && <small>{savedCount}</small>}{label === "History" && <small>{historyCount}</small>}</Button>)}
      </nav>
      <div className="menu-bottom">
        {settings && <div className="menu-settings"><h3>Preferences</h3><Button variant="outline" onClick={togglePaused} aria-pressed={!paused}>{!paused && <Check />} Auto-play featured anime</Button><p>Dark appearance</p></div>}
        <div className="menu-status"><span><i /> Portfolio edition</span><span className="menu-version">v1.0.0</span></div>
        <div className="menu-appearance"><Monitor size={19} /><span>Dark</span><Check size={16} /></div>
        <div className="menu-profile"><Button variant="ghost" onClick={() => onNavigate("Watchlist")}><UserRound /> My collection <small>{savedCount}</small></Button><Button variant="outline" size="icon" title="Preferences" aria-label="Preferences" onClick={() => setSettings(!settings)} aria-expanded={settings}><Settings /></Button></div>
      </div>
    </SheetContent>
  </Sheet>;
}
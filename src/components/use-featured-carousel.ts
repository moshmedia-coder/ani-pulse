import { useEffect, useState } from "react";

export function useFeaturedCarousel(count: number, blocked: boolean) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (paused || blocked || count < 2) return;
    const fade = window.setTimeout(() => setFading(true), 5700);
    const advance = window.setTimeout(() => {
      setSlide((previous) => (previous + 1) % count);
      setFading(false);
    }, 6000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(advance);
    };
  }, [slide, paused, blocked, count]);

  function move(direction: number) {
    setFading(false);
    setSlide((previous) => (previous + direction + count) % count);
  }

  function togglePaused() {
    setFading(false);
    setPaused((previous) => !previous);
  }

  return { slide, fading: fading && !blocked, paused, move, togglePaused };
}
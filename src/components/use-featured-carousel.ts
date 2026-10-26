import { useEffect, useRef, useState } from "react";

export function useFeaturedCarousel(itemIds: readonly number[], blocked: boolean) {
  const count = itemIds.length;
  const itemKey = itemIds.join(",");
  const previousItemIds = useRef(itemIds);
  const currentItemIds = useRef(itemIds);
  currentItemIds.current = itemIds;
  const [slide, setSlide] = useState(0);
  const previousId = previousItemIds.current[slide];
  const synchronizedSlide =
    previousId === undefined ? -1 : currentItemIds.current.indexOf(previousId);
  const activeSlide = synchronizedSlide < 0 ? 0 : synchronizedSlide;
  const [paused, setPaused] = useState(false);
  const [fading, setFading] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const previousId = previousItemIds.current[slide];
    const nextSlide = previousId === undefined ? -1 : currentItemIds.current.indexOf(previousId);
    previousItemIds.current = currentItemIds.current;
    if (nextSlide !== slide) {
      setSlide(nextSlide < 0 ? 0 : nextSlide);
    }
  }, [itemKey, slide]);

  useEffect(() => {
    if (paused || blocked || reducedMotion || count < 2) return;
    const fade = window.setTimeout(() => setFading(true), 5700);
    const advance = window.setTimeout(() => {
      setSlide((previous) => (activeSlide + 1) % count);
      setFading(false);
    }, 6000);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(advance);
    };
  }, [slide, activeSlide, paused, blocked, count, reducedMotion, itemKey]);

  function move(direction: number) {
    if (count < 1) return;
    setFading(false);
    setSlide((activeSlide + direction + count) % count);
  }

  function togglePaused() {
    setFading(false);
    setPaused((previous) => !previous);
  }

  return { slide: activeSlide, fading: fading && !blocked, paused, move, togglePaused };
}

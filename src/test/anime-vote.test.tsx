import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimeVote } from "@/components/anime-vote";

describe("Anime vote", () => {
  it("requires a selection, confirms it, and allows changing it", () => {
    render(<AnimeVote />);
    expect(screen.getByRole("button", { name: "Vote for your favorite" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Solo Leveling/ }));
    expect(screen.getByRole("button", { name: /Solo Leveling/ })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Vote for your favorite" }));
    expect(screen.getByRole("status")).toHaveTextContent("Selected for this visit");
    fireEvent.click(screen.getByRole("button", { name: "Change your vote" }));
    expect(screen.getByRole("button", { name: "Vote for your favorite" })).toBeEnabled();
  });
});
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AiringSchedule } from "@/components/airing-schedule";
import { airingScheduleQuery, type AiringScheduleEntry } from "@/lib/anilist";

function entry(overrides: Partial<AiringScheduleEntry> = {}): AiringScheduleEntry {
  return {
    id: 1,
    animeId: 52991,
    title: "Frieren: Beyond Journey's End",
    image: "https://example.test/frieren.jpg",
    episode: 5,
    airingAt: Math.floor(new Date(2026, 9, 17, 17, 35).getTime() / 1000),
    ...overrides,
  };
}

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
}

async function renderSchedule(client: QueryClient) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: AiringSchedule,
  });
  const watchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/watch/$animeId",
    component: () => null,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, watchRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await router.load();

  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("homepage airing schedule", () => {
  it("shows actual episode metadata, local air time, countdown, artwork, and watch navigation", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 17, 10));
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, [entry()]);

    await renderSchedule(client);

    const row = screen.getByRole("link", {
      name: /Frieren: Beyond Journey's End.*episode 5/,
    });
    expect(row).toHaveAttribute("href", "/watch/52991");
    expect(within(row).getByRole("presentation")).toHaveAttribute(
      "src",
      "https://example.test/frieren.jpg",
    );
    expect(within(row).getByText("EP 5")).toBeVisible();
    expect(within(row).getByText("Airing soon · in 25m")).toBeVisible();
    expect(
      within(row).getByText(
        new Date(entry().airingAt * 1000).toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
        }),
      ),
    ).toHaveAttribute("datetime", new Date(entry().airingAt * 1000).toISOString());
    const dateLabel = new Date(2026, 9, 17).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    expect(screen.getByText(new RegExp(dateLabel))).toBeVisible();
    expect(screen.getByText(/Your local time/)).toBeVisible();
    client.clear();
  });

  it("shows verified upcoming rows without inventing missing image or episode metadata", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 12));
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, [
      entry({ animeId: 888888, title: "Upcoming Anime", image: null, episode: null }),
    ]);

    await renderSchedule(client);

    const row = screen.getByRole("link", {
      name: /Upcoming Anime.*episode information unavailable/,
    });
    expect(row).toHaveAttribute("href", "/watch/888888");
    expect(within(row).getByText("Episode TBD")).toBeVisible();
    expect(within(row).queryByRole("img")).not.toBeInTheDocument();
    expect(within(row).getByText("Upcoming Anime")).toBeVisible();
    client.clear();
  });

  it("filters real schedules by the selected local date", async () => {
    vi.setSystemTime(new Date(2026, 9, 17, 12));
    const saturdayEntry = entry();
    const sundayEntry = entry({
      id: 2,
      animeId: 888888,
      title: "Sunday Episode",
      airingAt: Math.floor(new Date(2026, 9, 18, 18).getTime() / 1000),
    });
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, [saturdayEntry, sundayEntry]);

    await renderSchedule(client);
    expect(screen.getByRole("link", { name: /Frieren/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Sunday Episode/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Select Sunday/ }));

    expect(screen.getByRole("link", { name: /Sunday Episode/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: /Frieren/ })).not.toBeInTheDocument();
    client.clear();
  });

  it("shows a clear empty state when no upcoming schedules are available", async () => {
    const client = createClient();
    client.setQueryData(airingScheduleQuery().queryKey, []);

    await renderSchedule(client);

    expect(screen.getByText(/No upcoming episodes scheduled for/)).toBeVisible();
    expect(screen.queryByRole("link", { name: /episode/ })).not.toBeInTheDocument();
    client.clear();
  });

  it("announces loading while the schedule request is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    await renderSchedule(createClient());

    expect(screen.getByRole("status")).toHaveTextContent("Loading airing schedule");
  });

  it("shows an explicit error instead of mock schedule rows when AniList fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: "Schedule unavailable" }] })),
    );
    await renderSchedule(createClient());

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Airing schedule is temporarily unavailable",
      ),
    );
    expect(screen.queryByRole("link", { name: /episode/ })).not.toBeInTheDocument();
  });
});

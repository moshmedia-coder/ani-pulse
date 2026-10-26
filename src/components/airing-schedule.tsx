import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { airingScheduleQuery, type AiringScheduleEntry } from "@/lib/anilist";

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function startOfCurrentWeek(date: Date) {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysSinceMonday);
}

function formatCountdown(airingAt: number, now: number) {
  const minutesRemaining = Math.ceil((airingAt * 1000 - now) / 60_000);
  if (minutesRemaining <= 0 || minutesRemaining >= 24 * 60) return null;
  if (minutesRemaining < 60) return `Airing soon · in ${minutesRemaining}m`;
  const hours = Math.floor(minutesRemaining / 60);
  const minutes = minutesRemaining % 60;
  return `in ${hours}h ${minutes}m`;
}

function ScheduleRow({ entry, now }: { entry: AiringScheduleEntry; now: number }) {
  const airingDate = new Date(entry.airingAt * 1000);
  const countdown = formatCountdown(entry.airingAt, now);

  return (
    <Link
      className="schedule-row"
      to="/watch/$animeId"
      params={{ animeId: String(entry.animeId) }}
      aria-label={`${entry.title}, ${airingDate.toLocaleString()}, ${
        entry.episode === null ? "episode information unavailable" : `episode ${entry.episode}`
      }`}
    >
      {entry.image ? (
        <img src={entry.image} alt="" loading="lazy" width={28} height={38} />
      ) : (
        <span className="schedule-cover-placeholder" aria-hidden="true" />
      )}
      <time dateTime={airingDate.toISOString()}>
        {airingDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
      </time>
      <span className="schedule-title">
        {entry.title}
        {countdown && <small className="schedule-countdown">{countdown}</small>}
      </span>
      <em>{entry.episode === null ? "Episode TBD" : `EP ${entry.episode}`}</em>
    </Link>
  );
}

export function AiringSchedule() {
  const scheduleQuery = useQuery(airingScheduleQuery());
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [moreSchedule, setMoreSchedule] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const weekStart = startOfCurrentWeek(new Date());
  const weekDays = Array.from(
    { length: 7 },
    (_, index) =>
      new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index),
  );
  const selectedDay = weekDays.find((date) => localDateKey(date) === selectedDate) ?? weekDays[0]!;
  const scheduleItems = (scheduleQuery.data ?? []).filter(
    (entry) =>
      entry.airingAt * 1000 > now &&
      localDateKey(new Date(entry.airingAt * 1000)) === localDateKey(selectedDay),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="schedule" aria-label="Airing schedule" aria-busy={scheduleQuery.isPending}>
      <div className="schedule-head">
        <h2>Airing schedule</h2>
        <p className="schedule-label">THIS WEEK</p>
      </div>
      <div className="schedule-days" role="group" aria-label="Select schedule date">
        {weekDays.map((date) => {
          const dateKey = localDateKey(date);
          const label = date.toLocaleDateString(undefined, { weekday: "short" });
          return (
            <Button
              variant="ghost"
              size="sm"
              key={dateKey}
              className={dateKey === localDateKey(selectedDay) ? "selected" : ""}
              aria-pressed={dateKey === localDateKey(selectedDay)}
              aria-label={`Select ${date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}`}
              onClick={() => {
                setSelectedDate(dateKey);
                setMoreSchedule(false);
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <p className="schedule-date">
        {selectedDay.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}{" "}
        · Your local time
      </p>
      {scheduleQuery.isPending ? (
        <p className="schedule-state" role="status">
          Loading airing schedule…
        </p>
      ) : scheduleQuery.isError ? (
        <p className="schedule-state" role="alert">
          Airing schedule is temporarily unavailable.
        </p>
      ) : scheduleItems.length === 0 ? (
        <p className="schedule-state">
          No upcoming episodes scheduled for{" "}
          {selectedDay.toLocaleDateString(undefined, { weekday: "long" })}.
        </p>
      ) : (
        scheduleItems
          .slice(0, moreSchedule ? 12 : 6)
          .map((entry) => <ScheduleRow key={entry.id} entry={entry} now={now} />)
      )}
      {!scheduleQuery.isPending && !scheduleQuery.isError && scheduleItems.length > 6 && (
        <Button
          variant="ghost"
          className="list-more"
          onClick={() => setMoreSchedule(!moreSchedule)}
        >
          {moreSchedule ? "Show less" : "Full schedule"}
          <ArrowRight />
        </Button>
      )}
    </section>
  );
}

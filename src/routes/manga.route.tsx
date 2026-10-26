import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/manga")({
  component: MangaLayout,
});

function MangaLayout() {
  return <Outlet />;
}

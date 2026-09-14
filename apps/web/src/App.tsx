import { Outlet } from "react-router-dom";
import type { RouteRecord } from "vite-react-ssg";
import { Component as IndexPage } from "@/pages/page";

function RootLayout() {
  return <Outlet />;
}

// Single route table. Order matters: static segments must stay ahead of the
// `/:username` wildcard once it lands (docs/superpower/2026-09-14-react-frontend-migration.md §3.5).
export const routes: RouteRecord[] = [
  {
    path: "/",
    element: <RootLayout />,
    entry: "src/App.tsx",
    children: [
      { index: true, element: <IndexPage /> },
      { path: "*", lazy: () => import("@/pages/not-found/page") },
    ],
  },
];

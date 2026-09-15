import { Link, Outlet, useLocation } from "react-router-dom";
import {
  useFactFoldAdminLayoutI18n,
  type FactFoldAdminLayoutI18n,
} from "./fact-fold-admin-layout.i18n";
import { dataBool } from "@/lib/dom";

const TABS: ReadonlyArray<{ path: string; testId: string; label: keyof FactFoldAdminLayoutI18n }> = [
  { path: "/admin/fact-or-fold/subjects", testId: "ff-admin-tab-subjects", label: "tabSubjects" },
  { path: "/admin/fact-or-fold/schedule", testId: "ff-admin-tab-schedule", label: "tabSchedule" },
  { path: "/admin/fact-or-fold/stats", testId: "ff-admin-tab-stats", label: "tabStats" },
  { path: "/admin/fact-or-fold/reports", testId: "ff-admin-tab-reports", label: "tabReports" },
  { path: "/admin/fact-or-fold/settings", testId: "ff-admin-tab-settings", label: "tabSettings" },
];

// app/ratel/src/features/arcade/games/fact_or_fold/pages/admin/layout.rs
// (`FactFoldAdminLayout`) — the tab bar between the five Fact-or-Fold admin
// surfaces, nested inside AdminLayout. A tab is selected only on an exact
// route match (`/subjects/new` selects none); the Dioxus `Link` also marks
// that tab `aria-current="page"`.
export function Component() {
  const tr = useFactFoldAdminLayoutI18n();
  const { pathname } = useLocation();
  const current = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  return (
    <div className="ff-admin-arena">
      <header className="ff-admin-arena__topbar">
        <nav className="ff-admin-arena__tabs" role="tablist">
          {TABS.map((tab) => {
            const selected = current === tab.path;
            return (
              <Link
                key={tab.path}
                className="ff-admin-arena__tab"
                data-testid={tab.testId}
                aria-selected={dataBool(selected)}
                aria-current={selected ? "page" : undefined}
                to={tab.path}
              >
                {tr[tab.label] as string}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="ff-admin-arena__main">
        <Outlet />
      </main>
    </div>
  );
}

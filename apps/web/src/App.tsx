import type { ComponentType } from "react";
import type { RouteRecord } from "vite-react-ssg";
import { Component as IndexPage } from "@/pages/page";
import { pageDirOf, routeTree, type RouteNode } from "@/lib/route-tree";

type PageModule = { Component: ComponentType };

// Every page except the landing page is lazy; layouts are eager so the
// shell around a lazy page renders (and hydrates) without waiting on it.
const pages = import.meta.glob<PageModule>("./pages/**/page.tsx");
const layouts = import.meta.glob<PageModule>("./layouts/*.tsx", { eager: true });

function toRecord(node: RouteNode, parent: string): RouteRecord {
  const path = node.path ? joinPath(parent, node.path) : parent;
  const base = node.index ? { index: true as const } : { path: node.path };

  if (node.layout) {
    const layout = layouts[`./layouts/${node.layout}.tsx`];
    if (!layout) throw new Error(`missing layout module: src/layouts/${node.layout}.tsx`);
    const Layout = layout.Component;
    return {
      ...base,
      element: <Layout />,
      children: (node.children ?? []).map((child) => toRecord(child, path)),
    } as RouteRecord;
  }

  if (node.name) {
    const dir = pageDirOf(path || "/");
    if (dir === "") return { ...base, element: <IndexPage /> } as RouteRecord;
    const load = pages[`./pages/${dir}/page.tsx`];
    if (!load) throw new Error(`missing page module: src/pages/${dir}/page.tsx (${node.name})`);
    return { ...base, lazy: load } as RouteRecord;
  }

  return {
    ...base,
    children: (node.children ?? []).map((child) => toRecord(child, path)),
  } as RouteRecord;
}

function joinPath(parent: string, child: string): string {
  const segments = [...parent.split("/"), ...child.split("/")].filter(Boolean);
  return `/${segments.join("/")}`;
}

export const routes: RouteRecord[] = [{ ...toRecord(routeTree, ""), entry: "src/App.tsx" }];

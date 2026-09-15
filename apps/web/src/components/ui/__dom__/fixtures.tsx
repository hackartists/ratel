// Render fixtures for apps/web/scripts/component-dom-parity.mjs. Each entry
// renders one representative prop set; `<name>.expected.html` next to this
// file is the DOM the Dioxus component produces for the same props (derived
// from the Rust source), compared after the React render and its effects
// settle (and after `interact`, when present).
import * as React from "react";
import { BottomSheet, BottomSheetHeader } from "../bottom-sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../collapsible";
import { CommentImageGrid } from "../comment-image-grid";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "../context-menu";
import { FileExtension, FileExtensionIcon } from "../file-extension-icon";
import { ImageUploadPreview } from "../image-upload-preview";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../pagination";
import { ScrollArea, ScrollDirection, ScrollType } from "../scroll-area";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItemIndicator,
  SelectList,
  SelectOption,
  SelectTrigger,
  SelectValue,
} from "../select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetSide, SheetTitle } from "../sheet";
import { SpaceCard } from "../space-card";
import { TabContent, TabList, TabTrigger, Tabs } from "../tabs";

export interface DomFixture {
  render: () => React.ReactElement;
  /** Runs after the first render settles (e.g. open a menu). */
  interact?: (container: HTMLElement) => void;
}

const noop = () => {};

export const fixtures: Record<string, DomFixture> = {
  "space-card": {
    render: () => (
      <SpaceCard fillHeight className="gap-4" data-testid="space-card">
        Body
      </SpaceCard>
    ),
  },
  "file-extension-icon": {
    render: () => (
      <>
        <FileExtensionIcon ext={FileExtension.PDF} size={20} />
        <FileExtensionIcon ext={FileExtension.MP3} />
      </>
    ),
  },
  collapsible: {
    render: () => (
      <Collapsible defaultOpen className="w-full">
        <CollapsibleTrigger className="px-2">Recent activity</CollapsibleTrigger>
        <CollapsibleContent id="activity-panel">
          <p>Fixed a bug</p>
        </CollapsibleContent>
      </Collapsible>
    ),
  },
  pagination: {
    render: () => (
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ),
  },
  "comment-image-grid": {
    render: () => <CommentImageGrid images={["/a.png", "/b.png"]} />,
  },
  "image-upload-preview": {
    render: () => (
      <ImageUploadPreview
        images={[
          { localUrl: "blob:one", remoteUrl: "https://cdn.example/one.png", uploading: false },
          { localUrl: "blob:two", uploading: true },
        ]}
        onChange={noop}
      />
    ),
  },
  "bottom-sheet": {
    render: () => (
      <BottomSheet open onClose={noop} className="gap-3">
        <BottomSheetHeader title="Settings" showClose onClose={noop} />
      </BottomSheet>
    ),
  },
  "context-menu": {
    render: () => (
      <ContextMenu>
        <ContextMenuTrigger>Right click here</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem value="edit" index={0}>
            Edit
          </ContextMenuItem>
          <ContextMenuItem value="undo" index={1} disabled>
            Undo
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    ),
    interact: (container) => {
      const trigger = container.querySelector('[aria-haspopup="menu"]');
      trigger?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 12, clientY: 34 }));
    },
  },
  "scroll-area": {
    render: () => (
      <ScrollArea direction={ScrollDirection.Vertical} scrollType={ScrollType.Hidden} tabIndex={0}>
        <p>Item</p>
      </ScrollArea>
    ),
  },
  select: {
    render: () => (
      <Select<string> defaultValue="banana" placeholder="Select a fruit">
        <SelectTrigger aria-label="Fruit">
          <SelectValue />
        </SelectTrigger>
        <SelectList aria-label="Fruits">
          <SelectGroup>
            <SelectGroupLabel>Fruits</SelectGroupLabel>
            <SelectOption<string> value="apple" index={0}>
              Apple
              <SelectItemIndicator />
            </SelectOption>
            <SelectOption<string> value="banana" index={1}>
              Banana
              <SelectItemIndicator />
            </SelectOption>
          </SelectGroup>
        </SelectList>
      </Select>
    ),
    interact: (container) => {
      container.querySelector<HTMLButtonElement>('[aria-haspopup="listbox"]')?.click();
    },
  },
  tabs: {
    render: () => (
      <Tabs defaultValue="overview" horizontal>
        <TabList>
          <TabTrigger value="overview" index={0}>
            Overview
          </TabTrigger>
          <TabTrigger value="settings" index={1}>
            Settings
          </TabTrigger>
        </TabList>
        <TabContent value="overview" index={0}>
          Overview body
        </TabContent>
        <TabContent value="settings" index={1}>
          Settings body
        </TabContent>
      </Tabs>
    ),
  },
  sheet: {
    render: () => (
      <Sheet open>
        <SheetContent side={SheetSide.Left}>
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
            <SheetDescription>Pick one</SheetDescription>
          </SheetHeader>
          <SheetFooter>Footer</SheetFooter>
        </SheetContent>
      </Sheet>
    ),
  },
};

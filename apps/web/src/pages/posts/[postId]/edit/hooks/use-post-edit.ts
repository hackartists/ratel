import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ConnectionResponse, FeedPartition, Post, SocialPlatform, TeamItem, Visibility } from "@ratel/ts-bridges";
import { useCreateSpace, useDeletePost, useGetPost, useGetUserTeams, useUpdatePost } from "@ratel/ts-bridges/hooks";
import { useAuth } from "@/lib/auth";
import { htmlContent, stripHtml, toHtml } from "@/lib/content-body";
import { useToast } from "@/lib/toast";
import { useCrossPosting, type UseCrossPosting } from "@/components/cross-posting/use-cross-posting";

// app/ratel/src/features/posts/views/post_edit/component.rs (`PostEdit`).
// Bundles the loader, every signal, and every mutation the page needs — the
// page component (`page.tsx`) is render-only, mirroring the Rust controller
// convention (conventions/hooks-and-actions.md) even though there is no
// shared `UseFeatureName` struct here since nothing else consumes this state.

const DEFAULT_AVATAR = "https://metadata.ratel.foundation/ratel/default-profile.png";
const TITLE_MAX_LENGTH = 80;
const CONTENT_MIN_LENGTH = 10;
const AUTOSAVE_DEBOUNCE_MS = 3000;

export type EditorStatus = "idle" | "saving" | "saved" | "unsaved" | "publishing";
export type PostKind = "post" | "repost" | "artwork";

function defaultPost(): Post {
  return {
    pk: "",
    sk: "",
    id: "",
    created_at: 0,
    updated_at: 0,
    title: "",
    body: { content_type: "html_content", data: "" },
    post_type: 0,
    status: "DRAFT",
    visibility: "PUBLIC",
    shares: 0,
    likes: 0,
    comments: 0,
    reports: 0,
    user_pk: "",
    author_display_name: "",
    author_profile_url: "",
    author_username: "",
    author_type: 1,
    space_pk: null,
    space_type: null,
    space_visibility: null,
    booster: null,
    rewards: null,
    urls: [],
    attachments: [],
    categories: [],
    announcement_id: null,
    announcement_parent_team_id: null,
    pinned_as_announcement: false,
  };
}

function stripHtmlTags(html: string): string {
  return stripHtml(html);
}

/** Rust `resolve_enabled_platforms` — `None` means "Ratel-only" (kill switch for syndication). */
function resolveEnabledPlatforms(
  vis: string,
  connections: ConnectionResponse[],
  overrides: Partial<Record<SocialPlatform, boolean>>,
): SocialPlatform[] | null {
  if (vis !== "PUBLIC") return null;
  const enabled = (["bluesky", "linkedin", "threads"] as SocialPlatform[]).filter((p) => {
    const c = connections.find((c) => c.platform === p);
    if (!c || c.status !== "connected") return false;
    return overrides[p] ?? c.auto_post_enabled;
  });
  return enabled.length === 0 ? null : enabled;
}

export interface UsePostEdit {
  ready: boolean;
  postId: FeedPartition;

  title: string;
  setTitle: (v: string) => void;
  content: string;
  setContent: (html: string) => void;
  categories: string[];
  tagInput: string;
  setTagInput: (v: string) => void;
  addTag: (raw: string) => void;
  removeTag: (tag: string) => void;

  postKind: PostKind;
  setPostKind: (k: PostKind) => void;
  visibility: string;
  setVisibility: (v: "PUBLIC" | "PRIVATE") => void;
  spaceEnabled: boolean;
  setSpaceEnabled: (v: boolean) => void;
  hasExistingSpace: boolean;
  alreadyPublishedPublic: boolean;

  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  asDropdownOpen: boolean;
  setAsDropdownOpen: (v: boolean) => void;

  userAvatar: string;
  userLabel: string;
  teams: TeamItem[];
  selectedTeamPk: string | null;
  switchAuthor: (teamPk: string | null) => Promise<void>;

  status: EditorStatus;
  contentTextChars: number;
  contentWordCount: number;
  canSubmit: boolean;

  crossPosting: UseCrossPosting;

  commitPublish: () => void;
  commitSaveDraft: () => void;
  discardDraft: () => Promise<void>;
}

export function usePostEdit(postId: FeedPartition): UsePostEdit {
  const toast = useToast();
  const nav = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();

  const postQuery = useGetPost(postId);
  const teamsQuery = useGetUserTeams({ enabled: auth.loggedIn });
  const updateMutation = useUpdatePost();
  const deleteMutation = useDeletePost();
  const createSpaceMutation = useCreateSpace();
  const crossPosting = useCrossPosting();

  const ready = postQuery.isSuccess;
  const post = postQuery.data?.post ?? defaultPost();

  const existingSpaceId = post.space_pk?.startsWith("SPACE#") ? post.space_pk.slice("SPACE#".length) : null;
  const hasExistingSpace = existingSpaceId !== null;
  const alreadyPublishedPublic = post.status === "PUBLISHED" && post.visibility === "PUBLIC";
  const initialSelectedTeamPk = post.author_type === 2 && post.user_pk.startsWith("TEAM#") ? post.user_pk : null;

  const [title, setTitle] = useState("");
  const [content, setContentState] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [postKind, setPostKind] = useState<PostKind>("post");
  const [visibility, setVisibilityState] = useState<Visibility>("PUBLIC");
  const [spaceEnabled, setSpaceEnabled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [asDropdownOpen, setAsDropdownOpen] = useState(false);
  const [selectedTeamPk, setSelectedTeamPk] = useState<string | null>(null);
  const [status, setStatus] = useState<EditorStatus>("idle");

  // Seed local state once the loader resolves (Rust's `use_signal(move || …)`
  // seeds from the loaded value exactly once at mount) — done synchronously
  // during render, not in a `useEffect`: the page returns `null` while
  // `!ready`, so the FIRST render that reaches the `<Editor>` element must
  // already carry the loaded body. `Editor` pins its initial HTML in a
  // `useState` initializer at mount and ignores later `content` prop
  // changes (conventions/dioxus-app.md's RichEditor contract), so seeding
  // one render late — via an effect that fires after commit — would mount
  // the editor with an empty body it can then never be corrected to show.
  const seeded = useRef(false);
  const lastSaved = useRef({ title: "", content: "", categories: [] as string[] });
  const saveVersion = useRef(0);
  if (ready && !seeded.current) {
    seeded.current = true;
    const initialContent = toHtml(post.body);
    setTitle(post.title);
    setContentState(initialContent);
    setCategories(post.categories);
    setVisibilityState(post.visibility ?? "PUBLIC");
    setSpaceEnabled(hasExistingSpace);
    setSelectedTeamPk(initialSelectedTeamPk);
    lastSaved.current = { title: post.title, content: initialContent, categories: post.categories };
  }

  function markUnsaved(nextTitle: string, nextContent: string, nextCategories: string[]) {
    const saved = lastSaved.current;
    if (nextTitle === saved.title && nextContent === saved.content && arraysEqual(nextCategories, saved.categories)) {
      setStatus("saved");
    } else {
      setStatus("unsaved");
      saveVersion.current += 1;
      scheduleAutosave(saveVersion.current, nextTitle, nextContent, nextCategories);
    }
  }

  function scheduleAutosave(version: number, snapTitle: string, snapContent: string, snapCategories: string[]) {
    window.setTimeout(() => {
      if (saveVersion.current !== version) return;
      const saved = lastSaved.current;
      if (snapTitle === saved.title && snapContent === saved.content && arraysEqual(snapCategories, saved.categories)) {
        return;
      }
      setStatus("saving");
      updateMutation.mutate(
        { postId, req: { title: snapTitle, content: htmlContent(snapContent), categories: snapCategories } },
        {
          onSuccess: (updated) => {
            lastSaved.current = { title: updated.title, content: toHtml(updated.body), categories: snapCategories };
            setStatus("saved");
          },
          onError: () => setStatus("unsaved"),
        },
      );
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  const setTitleAndMark = (val: string) => {
    if (val.length > TITLE_MAX_LENGTH) return;
    setTitle(val);
    markUnsaved(val, content, categories);
  };

  const setContent = (html: string) => {
    // The legacy editor script's `init()` unconditionally echoes the
    // (seeded) initial HTML back through `onContentChange` once, right
    // after mount — real Dioxus loses this race against its own WASM
    // hydration and never sees it, so the page stays "Idle" until a
    // genuine edit. React's layout-effect listener attaches in time to
    // receive it (see `editor.tsx`'s header comment); skipping a report
    // that doesn't actually change anything reproduces the same observed
    // "Idle until a real edit" behavior instead of a one-render-late
    // "Saved" flash no Dioxus user has ever seen.
    if (html === content) return;
    setContentState(html);
    markUnsaved(title, html, categories);
  };

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag === "") return;
    const lower = tag.toLowerCase();
    if (categories.some((c) => c.toLowerCase() === lower)) return;
    const next = [...categories, tag];
    setCategories(next);
    markUnsaved(title, content, next);
  };

  const removeTag = (tag: string) => {
    const next = categories.filter((c) => c !== tag);
    setCategories(next);
    markUnsaved(title, content, next);
  };

  const contentTextChars = useMemo(() => [...stripHtmlTags(content)].length, [content]);
  const contentWordCount = useMemo(() => {
    const plain = stripHtmlTags(content).trim();
    return plain === "" ? 0 : plain.split(/\s+/).length;
  }, [content]);

  const canSubmit = title !== "" && contentTextChars >= CONTENT_MIN_LENGTH && status !== "saving" && status !== "publishing";

  const [userAvatar, userLabel] = deriveUser(auth);

  const switchAuthor = async (teamPk: string | null) => {
    try {
      await updateMutation.mutateAsync({ postId, req: { team_id: teamPk } });
      setSelectedTeamPk(teamPk);
      setAsDropdownOpen(false);
    } catch (e) {
      toast.error(e);
    }
  };

  const commitSaveDraft = () => {
    if (status === "saving" || status === "publishing") return;
    setStatus("saving");
    updateMutation.mutate(
      { postId, req: { title, content: htmlContent(content), categories } },
      {
        onSuccess: (updated) => {
          lastSaved.current = { title: updated.title, content: toHtml(updated.body), categories };
          setStatus("saved");
        },
        onError: (e) => {
          toast.error(e);
          setStatus("unsaved");
        },
      },
    );
  };

  const commitPublish = () => {
    if (!canSubmit) return;
    if (hasExistingSpace && existingSpaceId) {
      nav(`/spaces/${existingSpaceId}`);
      return;
    }
    const enabledPlatforms = resolveEnabledPlatforms(visibility, crossPosting.connections, crossPosting.perPostEnabled);
    if (spaceEnabled) {
      setStatus("publishing");
      updateMutation.mutate(
        {
          postId,
          req: {
            title,
            content: htmlContent(content),
            image_urls: null,
            publish: true,
            visibility,
            categories,
            enabled_platforms: enabledPlatforms,
            platform_overrides: null,
          },
        },
        {
          onSuccess: () => {
            createSpaceMutation.mutate(
              { post_id: postId },
              {
                onSuccess: (resp) => nav(`/spaces/${resp.space_id}`),
                onError: (e) => {
                  toast.error(e);
                  setStatus("unsaved");
                },
              },
            );
          },
          onError: (e) => {
            toast.error(e);
            setStatus("unsaved");
          },
        },
      );
      return;
    }
    setStatus("publishing");
    updateMutation.mutate(
      {
        postId,
        req: {
          title,
          content: htmlContent(content),
          image_urls: null,
          publish: true,
          visibility,
          categories,
          enabled_platforms: enabledPlatforms,
          platform_overrides: null,
        },
      },
      {
        onSuccess: () => nav(`/posts/${postId}`, { replace: true }),
        onError: () => setStatus("unsaved"),
      },
    );
  };

  const discardDraft = async () => {
    await deleteMutation.mutateAsync({ postId, force: false });
    await queryClient.invalidateQueries({ queryKey: ["getPost", postId] });
    nav("/");
  };

  return {
    ready,
    postId,
    title,
    setTitle: setTitleAndMark,
    content,
    setContent,
    categories,
    tagInput,
    setTagInput,
    addTag,
    removeTag,
    postKind,
    setPostKind,
    visibility,
    setVisibility: (v) => {
      setVisibilityState(v);
    },
    spaceEnabled,
    setSpaceEnabled,
    hasExistingSpace,
    alreadyPublishedPublic,
    drawerOpen,
    setDrawerOpen,
    asDropdownOpen,
    setAsDropdownOpen,
    userAvatar,
    userLabel,
    teams: teamsQuery.data?.items ?? [],
    selectedTeamPk,
    switchAuthor,
    status,
    contentTextChars,
    contentWordCount,
    canSubmit,
    crossPosting,
    commitPublish,
    commitSaveDraft,
    discardDraft,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function deriveUser(auth: ReturnType<typeof useAuth>): [string, string] {
  const u = auth.userContext.user;
  if (!u) return ["You", DEFAULT_AVATAR];
  const display = u.display_name === "" ? u.username : u.display_name;
  const avatar = u.profile_url === "" ? DEFAULT_AVATAR : u.profile_url;
  const label = u.username === "" ? display : `${display} · @${u.username}`;
  return [avatar, label];
}

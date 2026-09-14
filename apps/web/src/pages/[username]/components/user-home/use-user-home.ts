import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { checkFollowStatusHandler, listUserPostsHandler } from "@ratel/ts-bridges";
import type { PostResponse } from "@ratel/ts-bridges";
import {
  useCreatePost,
  useFindUser,
  useFollowUserPostApiMyFollowerFollow,
  useSuspenseInfiniteList,
  useUnfollowUserDeleteApiMyFollowerFollow,
  type SuspenseInfiniteList,
} from "@ratel/ts-bridges/hooks";
import { partitionId } from "@/components/posts/post-helpers";

// Controller for app/ratel/src/features/social/user_views/home/mod.rs (`Home`).

export interface UserProfile {
  displayName: string;
  profileUrl: string;
  description: string;
}

/**
 * mod.rs:46-66 — `use_resource(find_user_handler(Username, name).ok())`. Does
 * not suspend: until it resolves (or when it fails) the header shows the
 * username with no avatar and no description.
 */
export function useUserProfile(username: string): UserProfile {
  const query = useFindUser("username", username, { retry: false });
  const u = query.data;
  if (!u) return { displayName: username, profileUrl: "", description: "" };
  return {
    displayName: u.nickname === "" ? u.username : u.nickname,
    profileUrl: u.profile_url,
    description: u.description,
  };
}

export interface FollowControls {
  isFollowing: boolean;
  processing: boolean;
  follow(): void;
  unfollow(): void;
}

/**
 * mod.rs:69-121 — `check_follow_status_handler` loader (suspends), an
 * `is_following` signal seeded once from it, and follow/unfollow on the
 * status' `target_pk`. Failures are only logged, as in Rust.
 */
export function useFollowControls(username: string): FollowControls {
  const status = useSuspenseQuery({
    queryKey: ["checkFollowStatus", username],
    queryFn: () => checkFollowStatusHandler(username),
  });
  const [isFollowing, setIsFollowing] = useState(status.data.is_following);
  const [processing, setProcessing] = useState(false);
  const followUser = useFollowUserPostApiMyFollowerFollow();
  const unfollowUser = useUnfollowUserDeleteApiMyFollowerFollow();
  const targetPk = status.data.target_pk;

  return {
    isFollowing,
    processing,
    follow: () => {
      setProcessing(true);
      void followUser
        .mutateAsync(targetPk)
        .then(
          () => setIsFollowing(true),
          (e) => console.error("Follow failed:", e),
        )
        .finally(() => setProcessing(false));
    },
    unfollow: () => {
      setProcessing(true);
      void unfollowUser
        .mutateAsync(targetPk)
        .then(
          () => setIsFollowing(false),
          (e) => console.error("Unfollow failed:", e),
        )
        .finally(() => setProcessing(false));
    },
  };
}

/**
 * The owner-only "Create" button (mod.rs:143-156): `create_post_handler(None)`
 * then `nav.push("/posts/{post_pk}/edit")`; a failure is only logged.
 */
export function useCreateUserPost(): () => Promise<void> {
  const createPost = useCreatePost();
  const navigate = useNavigate();
  return async () => {
    try {
      const resp = await createPost.mutateAsync(null);
      navigate(`/posts/${partitionId(resp.post_pk)}/edit`);
    } catch (e) {
      console.debug("Failed to create post:", e);
    }
  };
}

/** user_posts_panel.rs:10-13 — `use_infinite_query(list_user_posts_handler(username, bookmark))?`. */
export function useUserPostsList(username: string): SuspenseInfiniteList<PostResponse> {
  return useSuspenseInfiniteList(["listUserPosts", "infinite", username], (bookmark) =>
    listUserPostsHandler(username, bookmark),
  );
}

import { useState } from "react";
import type { PostResponse } from "@ratel/ts-bridges";
import { useLikePost } from "@ratel/ts-bridges/hooks";

// FeedCard's optimistic like (feed_card/mod.rs:31-94): flip the like and the
// count immediately, call `like_post_handler`, roll back on failure, and call
// `on_like` on success. Clicks while a request is in flight are ignored.

export interface FeedCardLike {
  liked: boolean;
  likes: number;
  processing: boolean;
  toggle(value: boolean): void;
}

export function useFeedCardLike(post: PostResponse, onLike?: (liked: boolean) => void): FeedCardLike {
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [processing, setProcessing] = useState(false);
  const likePost = useLikePost();

  const toggle = (value: boolean) => {
    if (processing) return;
    const previousLiked = liked;
    const previousLikes = likes;
    const delta = value ? 1 : -1;

    setLiked(value);
    setLikes(Math.max(previousLikes + delta, 0));
    setProcessing(true);

    void likePost
      .mutateAsync({ postId: post.pk, like: value })
      .then(
        () => onLike?.(value),
        () => {
          setLiked(previousLiked);
          setLikes(previousLikes);
        },
      )
      .finally(() => setProcessing(false));
  };

  return { liked, likes, processing, toggle };
}

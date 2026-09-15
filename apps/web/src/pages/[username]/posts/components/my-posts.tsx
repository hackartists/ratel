import { FeedCard } from "@/components/posts/feed-card";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { useMyPostsList } from "../hooks/use-my-posts";

// app/ratel/src/features/posts/components/my_posts.rs (`MyPosts`): the
// `list_user_posts_handler` feed as `FeedCard`s.
export function MyPosts({ username }: { username: string }) {
  const v = useMyPostsList(username);
  const items = v.items;

  if (items.length === 0) {
    return (
      <div className="flex flex-row justify-start items-center w-full text-base font-medium text-gray-500 border border-gray-500 h-fit px-[16px] py-[20px] rounded-[8px]">
        {/* Rust hardcodes the empty text (my_posts.rs:21). */}
        No posts available
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 max-mobile:px-[10px]">
      <div className="flex flex-col flex-1 gap-4">
        {items.map((post) => (
          <FeedCard key={post.pk} post={post} />
        ))}

        {v.hasMore ? (
          <InfiniteMore hasMore={v.hasMore} loading={v.loading} onMore={v.next} />
        ) : (
          <div className="my-6 text-center text-gray-400" aria-label="End of feed message">
            {/* Rust hardcodes the end text (my_posts.rs:39). */}
            You have reached the end of your feed.
          </div>
        )}
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { SquareChat } from "@/components/icons/chat";
import { Edit1 } from "@/components/icons/edit";
import { ThumbsUp } from "@/components/icons/emoji";
import { contentToHtml, formatPostDate, postUrl } from "@/components/posts/post-helpers";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { useUserPostsList } from "./use-user-home";

// app/ratel/src/features/social/user_views/home/user_posts_panel.rs (`UserPostsPanel`).

export type HomeViewMode = "list" | "card";

export function UserPostsPanel({ username, viewMode }: { username: string; viewMode: HomeViewMode }) {
  const v = useUserPostsList(username);
  const items = v.items;

  if (items.length === 0) {
    // Rust hardcodes the empty text (user_posts_panel.rs:28).
    return <div className="flex justify-center items-center py-20 w-full text-base text-foreground-muted">No posts yet</div>;
  }

  return (
    <div className="flex flex-col gap-0">
      {viewMode === "card" ? (
        <div className="grid grid-cols-2 gap-10">
          {items.map((post) => (
            <UserPostCard key={`card-${post.pk}`} post={post} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {items.map((post) => (
            <UserPostListItem key={`list-${post.pk}`} post={post} />
          ))}
        </div>
      )}
      <InfiniteMore hasMore={v.hasMore} loading={v.loading} onMore={v.next} />
    </div>
  );
}

function PostStats({ post }: { post: PostResponse }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[15px] text-foreground-muted leading-[22px]">{formatPostDate(post.created_at)}</span>
      <div className="flex gap-2.5 items-center">
        <div className="flex gap-1 items-center">
          <ThumbsUp className="w-5 h-5 [&>path]:stroke-icon-primary [&>path]:fill-transparent" />
          <span className="font-medium text-[15px] text-text-primary">{post.likes}</span>
        </div>
        <div className="flex gap-1 items-center">
          <SquareChat className="w-5 h-5 [&>path]:stroke-icon-primary [&>path]:fill-transparent" />
          <span className="font-medium text-[15px] text-text-primary">{post.comments}</span>
        </div>
      </div>
    </div>
  );
}

function UserPostCard({ post }: { post: PostResponse }) {
  const thumbnail = post.urls[0];
  const category = post.categories[0] ?? "";

  return (
    <Link to={postUrl(post)} className="block">
      <div className="flex flex-col gap-5 py-6 border-b border-separator">
        {category !== "" ? (
          <div className="flex justify-between items-center">
            <div className="flex items-center py-0.5 px-2 border border-tag-stroke rounded-[8px]">
              <span className="font-bold text-[12px] text-text-primary leading-[14px] tracking-[-0.12px]">{category}</span>
            </div>
            <div className="flex gap-2 items-center">
              <Edit1 className="w-5 h-5 cursor-pointer [&>path]:stroke-icon-primary" />
            </div>
          </div>
        ) : null}

        <h2 className="font-bold text-[20px] text-text-primary tracking-[0.5px] leading-[25px] line-clamp-2">{post.title}</h2>

        <PostStats post={post} />

        {thumbnail !== undefined ? (
          <img src={thumbnail} className="object-cover w-full h-[280px] rounded-[24px]" />
        ) : (
          <div className="w-full h-[280px] rounded-[24px] bg-thumbnail-placeholder-bg" />
        )}

        <div
          className="text-[15px] text-foreground leading-[22px]"
          style={{ overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}
          dangerouslySetInnerHTML={{ __html: contentToHtml(post.body) }}
        />
      </div>
    </Link>
  );
}

function UserPostListItem({ post }: { post: PostResponse }) {
  const category = post.categories[0] ?? "";
  const titleClass =
    category === ""
      ? "text-[20px] font-bold text-text-primary tracking-[0.5px] leading-[25px] line-clamp-2"
      : "text-[20px] font-bold text-text-primary tracking-[0.5px] leading-[25px] line-clamp-2 mt-2";

  return (
    <Link to={postUrl(post)} className="block">
      <div className="flex flex-col gap-4 py-5 border-b border-separator">
        {category !== "" ? (
          <div className="flex items-center py-0.5 px-2 border border-tag-stroke rounded-[8px] w-fit">
            <span className="font-bold text-[12px] text-text-primary leading-[14px] tracking-[-0.12px]">{category}</span>
          </div>
        ) : null}

        <h2 className={titleClass}>{post.title}</h2>

        <PostStats post={post} />
      </div>
    </Link>
  );
}

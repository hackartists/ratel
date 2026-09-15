import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PostResponse } from "@ratel/ts-bridges";
import { SquareChat } from "@/components/icons/chat";
import { Edit1 } from "@/components/icons/edit";
import { ThumbsUp } from "@/components/icons/emoji";
import { Palace } from "@/components/icons/home";
import { Share1 } from "@/components/icons/links-share";
import { RewardCoin } from "@/components/icons/money-payment";
import { contentToPlainText, convertNumberToString, postUrl, timeAgo } from "./post-helpers";
import { useFeedCardLike } from "./use-feed-card-like";

// app/ratel/src/features/posts/components/feed_card/mod.rs (`FeedCard`,
// `FeedContents`, `UserBadge` and their private pieces).

/** `BoosterType::NoBoost` (features/posts/types/booster_type.rs:14). */
const BOOSTER_NO_BOOST = 1;
/** `UserType::Team` (common/types/auth/user_type.rs:23). */
const USER_TYPE_TEAM = 2;

export interface FeedCardProps {
  post: PostResponse;
  /** Called with the new like state after the like request succeeds. */
  onLike?: (liked: boolean) => void;
  /** When set, an edit button is shown in the card header. */
  onEdit?: (event: React.MouseEvent) => void;
  /** Rust passes it to `FeedFooter`, which ignores it. */
  href?: string;
}

export function FeedCard({ post, onLike, onEdit }: FeedCardProps) {
  const navigate = useNavigate();
  const like = useFeedCardLike(post, onLike);
  const url = postUrl(post);

  return (
    <div className="flex relative flex-col border rounded-[10px] bg-card-bg-secondary border-card-enable-border">
      <Link className="block" to={url}>
        <FeedBody post={post} onEdit={onEdit} />
      </Link>
      <FeedFooter
        boosterType={post.booster}
        likes={like.likes}
        comments={post.comments}
        rewards={post.rewards ?? 0}
        shares={post.shares}
        isLiked={like.liked}
        isProcessing={like.processing}
        onCommentClick={() => navigate(url)}
        onLikeClick={like.toggle}
      />
    </div>
  );
}

function FeedBody({ post, onEdit }: { post: PostResponse; onEdit?: (event: React.MouseEvent) => void }) {
  const preview = contentToPlainText(post.body);
  return (
    <div className="flex flex-col pt-5 pb-5">
      <div className="flex flex-row justify-between px-5 min-h-8">
        <div className="flex flex-row items-center h-8">{post.space_pk !== null ? <SpaceTag /> : <div className="h-8" />}</div>
        {onEdit ? <EditButton onClick={onEdit} /> : null}
      </div>
      <h2 className="px-5 mt-2 w-full font-bold align-middle truncate text-xl/[25px] tracking-[0.5px] text-text-primary">
        {post.title}
      </h2>
      <FeedContents contents={preview} urls={post.urls} />
      <div className="flex flex-row justify-between items-center px-5 mt-4">
        <UserBadge profileUrl={post.author_profile_url} name={post.author_display_name} authorType={post.author_type} />
        <p className="text-sm font-light align-middle text-text-primary">{timeAgo(post.created_at)}</p>
      </div>
    </div>
  );
}

export function FeedContents({ contents }: { contents: string; urls: string[] }) {
  return (
    <div className="px-5 mt-2 break-all text-desc-text">
      <div className="whitespace-nowrap border-none truncate" style={{ minHeight: "22px", maxHeight: "22px", overflow: "hidden" }}>
        {contents}
      </div>
    </div>
  );
}

interface FeedFooterProps {
  boosterType: number;
  likes: number;
  comments: number;
  rewards: number;
  shares: number;
  isLiked: boolean;
  isProcessing: boolean;
  onCommentClick: () => void;
  onLikeClick: (value: boolean) => void;
}

function FeedFooter({
  boosterType,
  likes,
  comments,
  rewards,
  shares,
  isLiked,
  isProcessing,
  onCommentClick,
  onLikeClick,
}: FeedFooterProps) {
  const likeClass = isProcessing ? "cursor-not-allowed opacity-50" : "cursor-pointer";
  return (
    <div className="flex flex-row justify-between items-center px-5 w-full border-t border-divider">
      <div className="flex flex-row justify-between items-center w-full">
        <IconText
          className={likeClass}
          onClick={() => {
            if (!isProcessing) onLikeClick(!isLiked);
          }}
        >
          {isLiked ? (
            <ThumbsUp className="[&>path]:fill-primary [&>path]:stroke-primary" />
          ) : (
            <ThumbsUp className="[&>path]:stroke-icon-primary [&>path]:fill-transparent" />
          )}
          {convertNumberToString(likes)}
        </IconText>
        <IconText className="cursor-pointer" onClick={onCommentClick}>
          <SquareChat className="[&>path]:stroke-icon-primary [&>path]:fill-transparent" />
          {convertNumberToString(comments)}
        </IconText>
        {boosterType !== BOOSTER_NO_BOOST ? (
          <IconText>
            <RewardCoin className="[&>path]:stroke-icon-primary [&>path]:fill-transparent" />
            {convertNumberToString(rewards)}
          </IconText>
        ) : null}
        <IconText>
          <Share1 className="[&>path]:stroke-icon-primary [&>path]:fill-transparent" />
          {convertNumberToString(shares)}
        </IconText>
      </div>
    </div>
  );
}

export function UserBadge({ profileUrl, name, authorType }: { profileUrl: string; name: string; authorType: number }) {
  const imgClass = authorType === USER_TYPE_TEAM ? "w-6 h-6 rounded-sm object-cover" : "w-6 h-6 rounded-full object-cover";
  return (
    <div className="flex flex-row gap-2.5 items-center w-fit med-16 text-text-primary">
      {/* Rust hardcodes the alt text (feed_card/mod.rs:243). */}
      {profileUrl !== "" ? <img src={profileUrl} alt="User Profile" className={imgClass} /> : null}
      <span>{name}</span>
    </div>
  );
}

function SpaceTag() {
  return (
    <span className="flex flex-row gap-1 justify-start items-center px-2 rounded-sm border border-label-color-border bg-label-color-bg">
      <Palace className="w-3.5 h-3.5 [&>path]:stroke-label-color-text [&>path]:fill-transparent [&_g>path:nth-child(n+2)]:stroke-label-color-text [&_g>path]:fill-transparent" />
      {/* Rust hardcodes the label (feed_card/mod.rs:255). */}
      <div className="font-semibold text-xs/[25px] text-label-color-text">SPACE</div>
    </span>
  );
}

function EditButton({ onClick }: { onClick: (event: React.MouseEvent) => void }) {
  return (
    <button
      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
    >
      <Edit1 className="w-4 h-4 [&>path]:stroke-icon-primary" />
    </button>
  );
}

function IconText({
  className = "",
  onClick,
  children,
}: {
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex flex-row gap-1.5 items-center py-3 px-3 leading-none whitespace-nowrap text-text-primary text-[15px] ${className}`}
      onClick={(e) => onClick?.(e)}
    >
      {children}
    </div>
  );
}

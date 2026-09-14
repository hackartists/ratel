import { useNavigate } from "react-router-dom";
import type { MySpaceResponse } from "@ratel/ts-bridges";
import { partitionId } from "@/components/posts/post-helpers";
import { InfiniteMore } from "@/components/ui/infinite-more";
import { useMySpacesList } from "./hooks/use-my-spaces";

// app/ratel/src/features/social/pages/space/views/mod.rs (`Home`, route
// `UserSpaces` at `/:username/spaces`): the signed-in user's spaces
// (`list_my_spaces_handler`) regardless of the wall; signed out, the loader
// fails and the error boundary renders.
export function Component() {
  const v = useMySpacesList();
  const items = v.items;

  if (items.length === 0) {
    return (
      <div className="flex flex-row justify-start items-center w-full text-base font-medium text-gray-500 border border-gray-500 h-fit px-[16px] py-[20px] rounded-[8px]">
        {/* Rust hardcodes the empty text (space/views/mod.rs:14). */}
        No spaces available
      </div>
    );
  }

  return (
    <div className="flex relative flex-1">
      <div className="flex flex-1 max-mobile:px-2.5">
        <div className="flex flex-col flex-1 gap-4">
          {items.map((space) => (
            <SpaceCard key={space.space_pk} space={space} />
          ))}
          {v.hasMore ? (
            <InfiniteMore hasMore={v.hasMore} loading={v.loading} onMore={v.next} />
          ) : (
            <div className="flex flex-row justify-center items-center w-full text-base font-medium text-gray-500 h-fit px-[16px] py-[20px]">
              {/* Rust hardcodes the end text (space/views/mod.rs:30). */}
              You have reached the end of your spaces.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpaceCard({ space }: { space: MySpaceResponse }) {
  const navigate = useNavigate();
  const href = `/spaces/${partitionId(space.space_pk)}`;

  return (
    <div
      className="flex flex-col w-full justify-start items-start px-4 py-5 rounded-[10px] bg-card-bg-secondary border border-card-border transition-colors cursor-pointer hover:bg-card-bg"
      onClick={() => navigate(href)}
    >
      <div className="flex flex-col gap-2 w-full">
        <div className="flex gap-3 items-center">
          <div className="flex flex-col gap-2">
            <div className="text-base font-semibold text-text-primary">{space.title}</div>
            {space.description !== "" ? <p className="text-sm text-text-secondary line-clamp-2 break-words">{space.description}</p> : null}
            <div className="flex flex-row items-center gap-2">
              {space.author_profile_url !== "" ? <img className="w-5 rounded-full" src={space.author_profile_url} /> : null}
              <p className="text-sm text-text-secondary">{space.author_display_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

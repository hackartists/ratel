import { useParams } from "react-router-dom";
import { MyPosts } from "./components/my-posts";

// app/ratel/src/features/social/pages/post/views/mod.rs (`Home`, route
// `UserPosts` at `/:username/posts`): renders `MyPosts { username }` on user
// and team walls alike.
export function Component() {
  const { username = "" } = useParams();
  return <MyPosts username={username} />;
}

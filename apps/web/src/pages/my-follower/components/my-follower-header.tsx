import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "@/components/icons/arrows";
import { useMyFollowerHeaderI18n } from "@/i18n/generated/features/my_follower/components/my-follower-header.i18n";

// app/ratel/src/features/my_follower/components/header.rs (`MyFollowerHeader`).
export function MyFollowerHeader() {
  const navigate = useNavigate();
  const tr = useMyFollowerHeaderI18n();

  return (
    <div className="flex flex-row w-full justify-start items-center gap-2.5">
      <div className="cursor-pointer w-fit h-fit" onClick={() => navigate(-1)}>
        <ArrowLeft className="[&>path]:stroke-text-primary" />
      </div>

      <div className="font-semibold text-text-primary text-[20px]">{tr.title}</div>
    </div>
  );
}

// Ported from: app/ratel/src/features/spaces/pages/actions/components/action_dependency_selector/component.rs (`ActionDependencySelectorTranslate`). Namespace "actionDependencySelector".
import { useTranslation } from "react-i18next";

const en = {
  depends_on_hint: "Participants must complete the selected actions before this one unlocks.",
  add_dependency: "+ Add dependency",
  no_actions_available: "No other actions exist in this space yet.",
};

const ko: Record<keyof typeof en, string> = {
  depends_on_hint: "선택한 액션을 모두 완료해야 이 액션을 참여할 수 있습니다.",
  add_dependency: "+ 선행 액션 추가",
  no_actions_available: "이 스페이스에 추가할 수 있는 다른 액션이 없습니다.",
};

export const i18n = { en, ko };

export interface ActionDependencySelectorI18n {
  dependsOnHint: string;
  addDependency: string;
  noActionsAvailable: string;
}

export function useActionDependencySelectorI18n(): ActionDependencySelectorI18n {
  const { t } = useTranslation("actionDependencySelector");
  return {
    dependsOnHint: t("depends_on_hint"),
    addDependency: t("add_dependency"),
    noActionsAvailable: t("no_actions_available"),
  };
}

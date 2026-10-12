// Required Attributes gate — participant must have answered a Poll's
// single-choice question with one of the allowed option values before this
// action unlocks. Independent of ActionDependencySelector. Namespace
// "actionRequiredAttributeSelector".
import { useTranslation } from "react-i18next";

const en = {
  required_attributes_hint:
    "Participants must have answered the selected poll question with one of the allowed values before this action unlocks. All rules must be satisfied.",
  add_required_attribute: "+ Add required attribute",
  no_questions_available: "No single-choice poll questions exist in this space yet.",
  select_allowed_values_hint: "Select one or more allowed answer values:",
  cancel: "Cancel",
  confirm: "Add",
  operator_and: "Match all (AND)",
  operator_or: "Match any (OR)",
};

const ko: Record<keyof typeof en, string> = {
  required_attributes_hint:
    "선택한 투표 문항에 허용된 값 중 하나로 응답해야 이 액션을 참여할 수 있습니다. 모든 조건을 만족해야 합니다.",
  add_required_attribute: "+ 필수 속성 추가",
  no_questions_available: "이 스페이스에 단일 선택 투표 문항이 아직 없습니다.",
  select_allowed_values_hint: "허용할 응답 값을 하나 이상 선택하세요:",
  cancel: "취소",
  confirm: "추가",
  operator_and: "모두 만족 (AND)",
  operator_or: "하나 이상 만족 (OR)",
};

export const i18n = { en, ko };

export interface ActionRequiredAttributeSelectorI18n {
  requiredAttributesHint: string;
  addRequiredAttribute: string;
  noQuestionsAvailable: string;
  selectAllowedValuesHint: string;
  cancel: string;
  confirm: string;
  operatorAnd: string;
  operatorOr: string;
}

export function useActionRequiredAttributeSelectorI18n(): ActionRequiredAttributeSelectorI18n {
  const { t } = useTranslation("actionRequiredAttributeSelector");
  return {
    requiredAttributesHint: t("required_attributes_hint"),
    addRequiredAttribute: t("add_required_attribute"),
    noQuestionsAvailable: t("no_questions_available"),
    selectAllowedValuesHint: t("select_allowed_values_hint"),
    cancel: t("cancel"),
    confirm: t("confirm"),
    operatorAnd: t("operator_and"),
    operatorOr: t("operator_or"),
  };
}

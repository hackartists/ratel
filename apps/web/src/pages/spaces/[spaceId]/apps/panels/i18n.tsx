// Ported from: app/ratel/src/features/spaces/pages/apps/apps/panels/i18n.rs (`PanelsTranslate`). Namespace "panels".
import { useTranslation } from "react-i18next";

const en = {
  breadcrumb_apps: "Apps",
  breadcrumb_panels: "Panels",
  type_badge: "Panels",
  topbar_title: "Panel Settings",
  back_aria: "Back",
  footer_saving: "Saving...",
  footer_saved: "Changes saved",
  total_quotas: "Total quotas",
  total_quotas_hint: "Setting the quota to 0 allows anyone to participate without a limit.",
  total_label: "Total",
  allocated_label: "allocated",
  unassigned_label: "unassigned",
  attribute_groups: "Attribute groups",
  attribute_groups_hint: "Select which attributes to use for this space",
  attr_university: "University",
  attr_age: "Age",
  attr_gender: "Gender",
  attr_university_desc: "Participation limited to users with a verified university affiliation.",
  attr_age_desc: "Split participation by age brackets (adult / minor / generation).",
  attr_gender_desc: "Enforce a gender balance across the participant pool.",
  collective_title: "Collective Panel Attributes",
  collective_hint: "Users must have these attributes to participate.",
  collective_empty: "No attributes selected. Toggle attributes above to add.",
  move_to_conditional_aria: "Move to conditional",
  move_age_to_conditional: "Move Age to Conditional",
  move_gender_to_conditional: "Move Gender to Conditional",
  conditional_title: "Conditional Panel Attributes",
  conditional_hint: "Participation is based on quotas, and participants are distributed by attribute.",
  conditional_over_allocated: "Over-allocated:",
  conditional_over_allocated_detail: " The sum of max quotas exceeds total quotas. Some attributes may not reach their max quota.",
  conditional_empty: "No conditional attributes configured. Move Collective attributes above into Conditional to set quotas.",
  th_attribute_group: "Attribute group",
  th_attributes: "Attributes",
  th_ratio: "Ratio",
  th_max_quotas: "Max quotas",
  val_male: "Male",
  val_female: "Female",
  val_adult: "Adult",
  val_minor: "Minor",
  val_verified: "Verified",
  val_generation: "Generation",
  viewer_no_access: "You do not have access to view this panel.",
  viewer_back: "Back",
};

const ko: Record<keyof typeof en, string> = {
  breadcrumb_apps: "앱",
  breadcrumb_panels: "패널",
  type_badge: "패널",
  topbar_title: "패널 설정",
  back_aria: "뒤로",
  footer_saving: "저장 중...",
  footer_saved: "변경사항 저장됨",
  total_quotas: "총 쿼터",
  total_quotas_hint: "쿼터를 0으로 설정하면, 인원 제한 없이 누구나 참여하도록 설정할 수 있습니다.",
  total_label: "총계",
  allocated_label: "할당됨",
  unassigned_label: "미할당",
  attribute_groups: "속성 그룹",
  attribute_groups_hint: "이 스페이스에서 사용할 속성을 선택하세요",
  attr_university: "대학교",
  attr_age: "나이",
  attr_gender: "성별",
  attr_university_desc: "대학 소속이 인증된 사용자만 참여 가능합니다.",
  attr_age_desc: "연령대(성인/미성년자/세대)별로 참여를 나눕니다.",
  attr_gender_desc: "참가자 풀에서 성별 균형을 유지합니다.",
  collective_title: "Collective 패널 속성",
  collective_hint: "참여하기 위해서는 해당 속성을 가지고 있어야 합니다.",
  collective_empty: "선택된 속성이 없습니다. 위에서 속성을 토글하세요.",
  move_to_conditional_aria: "Conditional로 이동",
  move_age_to_conditional: "Age를 Conditional로 이동",
  move_gender_to_conditional: "Gender를 Conditional로 이동",
  conditional_title: "Conditional 패널 속성",
  conditional_hint: "인원 수 기반으로 참여가 이루어지며 속성별로 참여자를 분배합니다.",
  conditional_over_allocated: "초과 할당:",
  conditional_over_allocated_detail: " 최대 쿼터의 합이 총 쿼터를 초과합니다. 일부 속성의 최대 쿼터가 충족되지 않을 수 있습니다.",
  conditional_empty: "설정된 conditional 속성이 없습니다. 위의 Collective 속성을 Conditional로 이동하여 쿼터를 설정하세요.",
  th_attribute_group: "속성 그룹",
  th_attributes: "속성",
  th_ratio: "비율",
  th_max_quotas: "최대 쿼터",
  val_male: "남성",
  val_female: "여성",
  val_adult: "성인",
  val_minor: "미성년자",
  val_verified: "인증됨",
  val_generation: "세대",
  viewer_no_access: "이 패널을 조회할 수 없습니다.",
  viewer_back: "뒤로",
};

export const i18n = { en, ko };

export interface PanelsI18n {
  breadcrumbApps: string;
  breadcrumbPanels: string;
  typeBadge: string;
  topbarTitle: string;
  backAria: string;
  footerSaving: string;
  footerSaved: string;
  totalQuotas: string;
  totalQuotasHint: string;
  totalLabel: string;
  allocatedLabel: string;
  unassignedLabel: string;
  attributeGroups: string;
  attributeGroupsHint: string;
  attrUniversity: string;
  attrAge: string;
  attrGender: string;
  attrUniversityDesc: string;
  attrAgeDesc: string;
  attrGenderDesc: string;
  collectiveTitle: string;
  collectiveHint: string;
  collectiveEmpty: string;
  moveToConditionalAria: string;
  moveAgeToConditional: string;
  moveGenderToConditional: string;
  conditionalTitle: string;
  conditionalHint: string;
  conditionalOverAllocated: string;
  conditionalOverAllocatedDetail: string;
  conditionalEmpty: string;
  thAttributeGroup: string;
  thAttributes: string;
  thRatio: string;
  thMaxQuotas: string;
  valMale: string;
  valFemale: string;
  valAdult: string;
  valMinor: string;
  valVerified: string;
  valGeneration: string;
  viewerNoAccess: string;
  viewerBack: string;
}

export function usePanelsI18n(): PanelsI18n {
  const { t } = useTranslation("panels");
  return {
    breadcrumbApps: t("breadcrumb_apps"),
    breadcrumbPanels: t("breadcrumb_panels"),
    typeBadge: t("type_badge"),
    topbarTitle: t("topbar_title"),
    backAria: t("back_aria"),
    footerSaving: t("footer_saving"),
    footerSaved: t("footer_saved"),
    totalQuotas: t("total_quotas"),
    totalQuotasHint: t("total_quotas_hint"),
    totalLabel: t("total_label"),
    allocatedLabel: t("allocated_label"),
    unassignedLabel: t("unassigned_label"),
    attributeGroups: t("attribute_groups"),
    attributeGroupsHint: t("attribute_groups_hint"),
    attrUniversity: t("attr_university"),
    attrAge: t("attr_age"),
    attrGender: t("attr_gender"),
    attrUniversityDesc: t("attr_university_desc"),
    attrAgeDesc: t("attr_age_desc"),
    attrGenderDesc: t("attr_gender_desc"),
    collectiveTitle: t("collective_title"),
    collectiveHint: t("collective_hint"),
    collectiveEmpty: t("collective_empty"),
    moveToConditionalAria: t("move_to_conditional_aria"),
    moveAgeToConditional: t("move_age_to_conditional"),
    moveGenderToConditional: t("move_gender_to_conditional"),
    conditionalTitle: t("conditional_title"),
    conditionalHint: t("conditional_hint"),
    conditionalOverAllocated: t("conditional_over_allocated"),
    conditionalOverAllocatedDetail: t("conditional_over_allocated_detail"),
    conditionalEmpty: t("conditional_empty"),
    thAttributeGroup: t("th_attribute_group"),
    thAttributes: t("th_attributes"),
    thRatio: t("th_ratio"),
    thMaxQuotas: t("th_max_quotas"),
    valMale: t("val_male"),
    valFemale: t("val_female"),
    valAdult: t("val_adult"),
    valMinor: t("val_minor"),
    valVerified: t("val_verified"),
    valGeneration: t("val_generation"),
    viewerNoAccess: t("viewer_no_access"),
    viewerBack: t("viewer_back"),
  };
}

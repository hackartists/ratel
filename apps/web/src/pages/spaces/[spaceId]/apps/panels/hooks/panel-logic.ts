import type {
  CreatePanelQuotaGroupRequest,
  DeletePanelKey,
  Gender,
  PanelAttribute,
  SpacePanelQuotaResponse,
  VerifiableAttribute,
} from "@ratel/ts-bridges";

// Pure panel helpers from app/ratel/src/features/spaces/pages/apps/apps/panels/hooks/use_space_panels.rs.
//
// Wire shapes (ts-rs): `PanelAttribute` is `{ type, value }` —
// collective `{ type: "collective_attribute", value: "university" | "age" | "gender" }`,
// verifiable `{ type: "verifiable_attribute", value: { type: "age" | "gender" | ..., value } }`.

export type PanelOption = "University" | "Age" | "Gender";

/** Rust `u8::MAX`: the open upper bound of the 70+ bracket. */
export const AGE_MAX = 255;

const AGE_RANGES: Array<[number, number]> = [
  [0, 17],
  [18, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, AGE_MAX],
];

const collective = (value: "university" | "age" | "gender"): PanelAttribute => ({ type: "collective_attribute", value });
const verifiable = (value: VerifiableAttribute): PanelAttribute => ({ type: "verifiable_attribute", value });
const ageRange = (min: number, max: number): PanelAttribute =>
  verifiable({ type: "age", value: { age_type: "range", value: { inclusive_min: min, inclusive_max: max } } });
const gender = (g: Gender): PanelAttribute => verifiable({ type: "gender", value: g });

/** `panel_attributes`. */
export function panelAttributes(panel: SpacePanelQuotaResponse): PanelAttribute[] {
  if (panel.attributes_vec.length === 0 && panel.attributes.type !== "none") return [panel.attributes];
  return panel.attributes_vec;
}

const isCollective = (a: PanelAttribute, v: "university" | "age" | "gender") =>
  a.type === "collective_attribute" && a.value === v;
const isVerifiable = (a: PanelAttribute, t: VerifiableAttribute["type"]) =>
  a.type === "verifiable_attribute" && a.value.type === t;

function matchesOption(option: PanelOption, a: PanelAttribute): boolean {
  switch (option) {
    case "University":
      return isCollective(a, "university");
    case "Age":
      return isCollective(a, "age") || isVerifiable(a, "age");
    case "Gender":
      return isCollective(a, "gender") || isVerifiable(a, "gender");
  }
}

/** `is_selected_option`. */
export function isSelectedOption(option: PanelOption, panels: SpacePanelQuotaResponse[]): boolean {
  return panels.some((p) => panelAttributes(p).some((a) => matchesOption(option, a)));
}

/** `is_collective_option`. */
export function isCollectiveOption(option: PanelOption, panels: SpacePanelQuotaResponse[]): boolean {
  const v = option === "University" ? "university" : option === "Age" ? "age" : "gender";
  return panels.some((p) => panelAttributes(p).some((a) => isCollective(a, v)));
}

/** `is_conditional_option` (University is never conditional). */
export function isConditionalOption(option: PanelOption, panels: SpacePanelQuotaResponse[]): boolean {
  if (option === "University") return false;
  const t = option === "Age" ? "age" : "gender";
  return panels.some((p) => panelAttributes(p).some((a) => isVerifiable(a, t)));
}

/** `option_keys`. */
export function optionKeys(option: PanelOption, panels: SpacePanelQuotaResponse[]): DeletePanelKey[] {
  return panels
    .filter((p) => panelAttributes(p).some((a) => matchesOption(option, a)))
    .map((p) => ({ panel_id: p.panel_id }));
}

/** Keeps the first key per `panel_id` (Rust `HashSet` retain). */
export function dedupKeys(keys: DeletePanelKey[]): DeletePanelKey[] {
  const seen = new Set<string>();
  return keys.filter((k) => {
    if (seen.has(k.panel_id)) return false;
    seen.add(k.panel_id);
    return true;
  });
}

/** `split_quotas`: an even split, the remainder going to the first rows. */
function splitQuotas(totalQuota: number, count: number): number[] {
  const total = Math.max(totalQuota, 0);
  const base = Math.trunc(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, idx) => (idx < remainder ? base + 1 : base));
}

/** `build_collective_groups`. */
export function buildCollectiveGroups(
  includeUniversity: boolean,
  includeAge: boolean,
  includeGender: boolean,
): CreatePanelQuotaGroupRequest[] {
  const groups: CreatePanelQuotaGroupRequest[] = [];
  if (includeUniversity) groups.push({ attributes_vec: [collective("university")], quota: 0 });
  if (includeAge) groups.push({ attributes_vec: [collective("age")], quota: 0 });
  if (includeGender) groups.push({ attributes_vec: [collective("gender")], quota: 0 });
  return groups;
}

/** `build_conditional_groups`. */
export function buildConditionalGroups(
  option: PanelOption,
  totalQuota: number,
  includeGenderCross: boolean,
): CreatePanelQuotaGroupRequest[] {
  const groups: CreatePanelQuotaGroupRequest[] = [];
  if (option === "Age") {
    if (includeGenderCross) {
      const quotas = splitQuotas(totalQuota, AGE_RANGES.length * 2);
      AGE_RANGES.forEach(([min, max], ageIdx) => {
        (["male", "female"] as const).forEach((g, genderIdx) => {
          groups.push({ attributes_vec: [ageRange(min, max), gender(g)], quota: quotas[ageIdx * 2 + genderIdx] });
        });
      });
    } else {
      const quotas = splitQuotas(totalQuota, AGE_RANGES.length);
      AGE_RANGES.forEach(([min, max], idx) => groups.push({ attributes_vec: [ageRange(min, max)], quota: quotas[idx] }));
    }
  } else if (option === "Gender") {
    const quotas = splitQuotas(totalQuota, 2);
    groups.push({ attributes_vec: [gender("male")], quota: quotas[0] });
    groups.push({ attributes_vec: [gender("female")], quota: quotas[1] });
  }
  return groups;
}

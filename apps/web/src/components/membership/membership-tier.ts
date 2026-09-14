// `MembershipTier` of app/ratel/src/features/membership/components/membership_plan/i18n.rs
// (the UI tier), and conversions to/from the API `MembershipTier`, whose wire
// form is the DynamoEnum UPPER_SNAKE string (`"PRO"`, `"ENTERPRISE#<name>"`).

export type UiMembershipTier = "Free" | "Pro" | "Max" | "Vip" | "Enterprise";

/** API tier string for a purchase request. */
export function apiTierString(tier: UiMembershipTier): string {
  switch (tier) {
    case "Pro":
      return "PRO";
    case "Max":
      return "MAX";
    case "Vip":
      return "VIP";
    case "Enterprise":
      return "ENTERPRISE#Enterprise";
    case "Free":
      return "FREE";
  }
}

/** `api_tier_to_ui`. */
export function apiTierToUi(tier: string): UiMembershipTier {
  const upper = tier.toUpperCase();
  if (upper === "PRO") return "Pro";
  if (upper === "MAX") return "Max";
  if (upper === "VIP") return "Vip";
  if (upper === "FREE") return "Free";
  return "Enterprise";
}

/** `partition_tier_to_ui` (a `MembershipPartition` value). */
export function partitionTierToUi(raw: string): UiMembershipTier {
  const tier = raw.startsWith("MEMBERSHIP#") ? raw.slice("MEMBERSHIP#".length) : raw;
  const lower = tier.toLowerCase();
  if (tier.startsWith("ENTERPRISE#") || lower === "enterprise") return "Enterprise";
  if (lower === "pro") return "Pro";
  if (lower === "max") return "Max";
  if (lower === "vip") return "Vip";
  return "Free";
}

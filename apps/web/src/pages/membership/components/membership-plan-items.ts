// app/ratel/src/features/membership/components/membership_plan/i18n.rs —
// `MembershipTier`, `MembershipPlanItem` and `membership_plan_items`. The plan
// copy is plain Rust data picked by language (not a `translate!` block), so it
// is ported verbatim, including the English Pro description and the trailing
// spaces in the Max/VIP descriptions.

export const MembershipTier = {
  Free: "Free",
  Pro: "Pro",
  Max: "Max",
  Vip: "Vip",
  Enterprise: "Enterprise",
} as const;
export type MembershipTier = (typeof MembershipTier)[keyof typeof MembershipTier];

export interface MembershipPlanItem {
  tier: MembershipTier;
  name: string;
  description: string;
  features: string[];
  price: string | null;
  btn: string | null;
  credits: number | null;
}

export function membershipPlanItems(isKo: boolean): MembershipPlanItem[] {
  if (isKo) {
    return [
      {
        tier: MembershipTier.Free,
        name: "무료",
        description: "누구나 참여 가능한 기본 멤버십",
        features: ["포스트 게재", "스페이스 생성", "인맥 관리", "보상 스페이스 참여"],
        price: null,
        btn: null,
        credits: null,
      },
      {
        tier: MembershipTier.Pro,
        name: "Pro",
        description: "Reward Space setup for small communities",
        features: [
          "모든 무료 플랜 포함",
          "월별 40 크레딧 제공",
          "보상 스페이스 또는 보상 기능별 최대 2 크레딧 사용 가능",
          "참여자 전체 보상의 10% 생성 보상 획득",
        ],
        price: "월 30,000원",
        btn: "Pro 신청",
        credits: 40,
      },
      {
        tier: MembershipTier.Max,
        name: "Max",
        description: "대규모 커뮤니티를 위한 보상 스페이스 기능 제공",
        features: [
          "모든 무료 플랜 포함",
          "월별 190 크레딧 제공",
          "보상 스페이스 또는 보상 기능별 최대 10 크레딧 사용 가능",
          "참여자 전체 보상의 10% 생성 보상 획득",
          "신뢰 크리에이터 배지 획득",
        ],
        price: "월 75,000원",
        btn: "Max 신청",
        credits: 190,
      },
      {
        tier: MembershipTier.Vip,
        name: "VIP",
        description: "인플루언서 및 마케팅 전문 기업을 위한 보상 스페이스 기능 제공",
        features: [
          "모든 무료 플랜 포함",
          "월별 1,360 크레딧 제공",
          "보상 스페이스 또는 보상 기능별 최대 100 크레딧 사용 가능",
          "참여자 전체 보상의 10% 생성 보상 획득",
          "신뢰 크리에이터 배지 획득",
          "참여자 원본 데이터 열람",
        ],
        price: "월 150,000원",
        btn: "VIP 신청",
        credits: 1360,
      },
      {
        tier: MembershipTier.Enterprise,
        name: "엔터프라이즈",
        description: "기업 및 기관 맞춤형 파트너 멤버십",
        features: ["모든 무료 플랜 포함", "완전 맞춤형 서비스 제공"],
        price: "월 1,000,000원 이상",
        btn: "Contact Us",
        credits: null,
      },
    ];
  }
  return [
    {
      tier: MembershipTier.Free,
      name: "Free",
      description: "Basic membership open to everyone",
      features: ["Publish posts", "Publish spaces", "Network relationship", "Participate in reward spaces"],
      price: null,
      btn: null,
      credits: null,
    },
    {
      tier: MembershipTier.Pro,
      name: "Pro",
      description: "Reward Space setup for small communities",
      features: [
        "Includes all Free",
        "40 monthly credits",
        "Up to 2 credits per a reward space",
        "Earn 10% of the total rewards distributed to participants.",
      ],
      price: "₩30,000 / month",
      btn: "Get Pro",
      credits: 40,
    },
    {
      tier: MembershipTier.Max,
      name: "Max",
      description: "Advanced Reward Spaces for large communities ",
      features: [
        "Includes all Free",
        "190 monthly credits",
        "Up to 10 credits per a reward space",
        "Earn 10% of the total rewards distributed to participants.",
        "Get a trusted creator badge",
      ],
      price: "₩75,000 / month",
      btn: "Get Max",
      credits: 190,
    },
    {
      tier: MembershipTier.Vip,
      name: "VIP",
      description: "Reward Spaces for influencers and promotion ",
      features: [
        "Includes all Free",
        "1,360 monthly credits",
        "Up to 100 credits per a reward space",
        "Earn 10% of the total rewards distributed to participants.",
        "Get a trusted creator badge",
        "Access raw participant data",
      ],
      price: "₩150,000 / month",
      btn: "Get VIP",
      credits: 1360,
    },
    {
      tier: MembershipTier.Enterprise,
      name: "Enterprise",
      description: "Customized partner plan for enterprises & organizations",
      features: ["Includes all Free", "Fully customizable"],
      price: "Starting at $1,000 / month",
      btn: "Contact Us",
      credits: null,
    },
  ];
}

import { COMPANY, type LegalPageData } from "@/components/legal/legal-document";
import { useLanguage } from "@/lib/language";

// app/ratel/src/views/child_safety/mod.rs — `child_safety_page_data(is_korean)`.
// Per-language const tables in Rust (no `translate!` block); the text is verbatim.

const en: LegalPageData = {
  title: "Child Safety Standards",
  lastUpdated: "Effective Date",
  effectiveDate: "June 12, 2026",
  sections: [
    {
      title: "1. Our Commitment",
      content:
        "Ratel has zero tolerance for child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). We are committed to maintaining a safe environment for all users and to preventing, detecting, and removing any content or conduct that endangers minors. These Child Safety Standards apply to everyone who uses the Ratel platform.",
    },
    {
      title: "2. Prohibited Conduct and Content",
      content:
        "The following are strictly prohibited on Ratel and will result in immediate removal and account termination:",
      items: [
        "Child sexual abuse material (CSAM) in any form, including images, videos, and text",
        "Grooming, solicitation, or sexualization of minors",
        "Sextortion or any attempt to obtain sexual content from a minor",
        "Sharing, linking to, or advertising CSAE/CSAM content",
        "Any other content or behavior that sexually exploits, abuses, or endangers children",
      ],
    },
    {
      title: "3. Reporting Mechanism",
      content:
        "Ratel provides in-app and out-of-app mechanisms for users to report content or behavior that may violate these standards. Users can report concerns through the report function available on posts, comments, and profiles, or by contacting our child safety point of contact directly at the email listed below. All reports are reviewed promptly.",
    },
    {
      title: "4. How We Respond",
      content: "When CSAE is identified or reported, we take the following actions:",
      items: [
        "Promptly review the reported content and account",
        "Remove violating content and disable or terminate the responsible account",
        "Preserve relevant evidence in accordance with applicable law",
        "Report confirmed CSAM to the relevant authorities and recognized child-safety organizations",
        "Cooperate with law enforcement investigations",
      ],
    },
    {
      title: "5. Compliance with Child Safety Laws",
      content:
        "Ratel complies with all applicable child safety laws and regulations in the jurisdictions where it operates, and reports CSAM to the appropriate local and national authorities as required by law. We align our practices with recognized industry standards for combating online child sexual abuse and exploitation.",
    },
    {
      title: "6. Designated Point of Contact",
      content:
        "We maintain a designated point of contact who is responsible for addressing CSAE prevention and compliance matters, and who is prepared to explain our child safety practices to regulators and platform partners. Concerns regarding child safety can be directed to the contact below.",
    },
    {
      title: "7. Updates to These Standards",
      content:
        'We may update these Child Safety Standards from time to time to reflect changes in our practices, legal requirements, or industry standards. The current version is always available at this page, and the "Last Updated" date reflects the most recent revision.',
    },
  ],
  contact: {
    title: "8. Contact Us",
    content:
      "If you have questions or concerns about these Child Safety Standards or our child safety practices, please contact us at:",
    emailLabel: "Email",
    addressLabel: "Address",
  },
  ...COMPANY.en,
};

const ko: LegalPageData = {
  title: "아동 안전 기준",
  lastUpdated: "시행일",
  effectiveDate: "2026년 6월 12일",
  sections: [
    {
      title: "1. 우리의 약속",
      content:
        "Ratel은 아동 성착취 및 학대(CSAE)와 아동 성학대 자료(CSAM)에 대해 무관용 원칙을 적용합니다. 당사는 모든 사용자를 위한 안전한 환경을 유지하고, 미성년자를 위험에 빠뜨리는 모든 콘텐츠나 행위를 예방·탐지·제거하기 위해 최선을 다합니다. 본 아동 안전 기준은 Ratel 플랫폼을 이용하는 모든 사람에게 적용됩니다.",
    },
    {
      title: "2. 금지되는 행위 및 콘텐츠",
      content: "다음 행위는 Ratel에서 엄격히 금지되며, 즉시 삭제 및 계정 정지 조치됩니다:",
      items: [
        "이미지, 동영상, 텍스트 등 형태를 불문한 모든 아동 성학대 자료(CSAM)",
        "미성년자에 대한 그루밍, 유인, 또는 성적 대상화",
        "성착취(sextortion) 또는 미성년자로부터 성적 콘텐츠를 얻으려는 모든 시도",
        "CSAE/CSAM 콘텐츠의 공유, 링크 게시, 또는 광고",
        "그 밖에 아동을 성적으로 착취·학대하거나 위험에 빠뜨리는 모든 콘텐츠 또는 행위",
      ],
    },
    {
      title: "3. 신고 절차",
      content:
        "Ratel은 본 기준을 위반할 수 있는 콘텐츠나 행위를 사용자가 신고할 수 있도록 앱 내·외부 신고 수단을 제공합니다. 사용자는 게시물, 댓글, 프로필에서 제공되는 신고 기능을 통해, 또는 아래 기재된 이메일로 당사의 아동 안전 담당자에게 직접 연락하여 우려 사항을 신고할 수 있습니다. 모든 신고는 신속하게 검토됩니다.",
    },
    {
      title: "4. 당사의 대응 방식",
      content: "CSAE가 확인되거나 신고되면, 당사는 다음과 같은 조치를 취합니다:",
      items: [
        "신고된 콘텐츠 및 계정을 신속히 검토",
        "위반 콘텐츠를 삭제하고 책임 있는 계정을 비활성화 또는 정지",
        "관련 법률에 따라 관련 증거를 보존",
        "확인된 CSAM을 관련 당국 및 공인된 아동 안전 기관에 신고",
        "법 집행 기관의 수사에 협조",
      ],
    },
    {
      title: "5. 아동 안전 관련 법규 준수",
      content:
        "Ratel은 운영하는 모든 관할권의 적용 가능한 아동 안전 법률 및 규정을 준수하며, 법률이 요구하는 바에 따라 CSAM을 적절한 지역 및 국가 당국에 신고합니다. 당사는 온라인 아동 성착취 및 학대에 대응하기 위한 공인된 업계 표준에 부합하도록 당사의 관행을 정렬합니다.",
    },
    {
      title: "6. 지정 담당자",
      content:
        "당사는 CSAE 예방 및 준수 사안을 처리할 책임이 있는 지정 담당자를 두고 있으며, 이 담당자는 규제 기관 및 플랫폼 파트너에게 당사의 아동 안전 관행을 설명할 준비가 되어 있습니다. 아동 안전에 관한 우려 사항은 아래 연락처로 전달할 수 있습니다.",
    },
    {
      title: "7. 본 기준의 변경",
      content:
        '당사는 관행, 법적 요건, 또는 업계 표준의 변화를 반영하기 위해 본 아동 안전 기준을 수시로 업데이트할 수 있습니다. 최신 버전은 항상 본 페이지에서 확인할 수 있으며, "최종 업데이트" 날짜는 가장 최근의 개정 시점을 나타냅니다.',
    },
  ],
  contact: {
    title: "8. 문의하기",
    content:
      "본 아동 안전 기준 또는 당사의 아동 안전 관행에 대해 질문이나 우려 사항이 있으시면 다음으로 연락해 주십시오:",
    emailLabel: "이메일",
    addressLabel: "주소",
  },
  ...COMPANY.ko,
};

export const i18n = { en, ko };

export function useChildSafetyI18n(): LegalPageData {
  return i18n[useLanguage()];
}

import { COMPANY, type LegalPageData } from "@/components/legal/legal-document";
import { useLanguage } from "@/lib/language";

// app/ratel/src/views/terms/mod.rs — `terms_page_data(is_korean)`. Per-language
// const tables in Rust (no `translate!` block); the text is verbatim.

const en: LegalPageData = {
  title: "Terms of Service",
  lastUpdated: "Last Updated",
  effectiveDate: "January 1, 2024",
  sections: [
    {
      title: "1. Acceptance of Terms",
      content:
        "By accessing and using Ratel's services, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, please do not use our services.",
    },
    {
      title: "2. Description of Service",
      content:
        "Ratel provides a platform for surveys and deliberation, enabling collaborative decision-making and opinion gathering. Our services include social networking features, space management, polling systems, deliberation tools, and related functionalities.",
    },
    {
      title: "3. User Accounts",
      content:
        "You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.",
    },
    {
      title: "4. User Conduct",
      content:
        "You agree not to use the service to: (a) upload, post, or transmit any content that is unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, or otherwise objectionable; (b) impersonate any person or entity; (c) violate any applicable laws or regulations; (d) interfere with or disrupt the service or servers.",
    },
    {
      title: "5. Intellectual Property Rights",
      content:
        "All content, trademarks, and data on this platform, including software, databases, text, graphics, icons, and hyperlinks, are the property of Ratel or its licensors and are protected by applicable intellectual property laws.",
    },
    {
      title: "6. User-Generated Content & Content Moderation",
      content:
        "You retain ownership of content you post on the platform. By posting content, you grant Ratel a worldwide, non-exclusive, royalty-free license to use, reproduce, modify, and distribute your content in connection with the service.\n\nRatel has zero tolerance for objectionable content and for abusive users. You agree not to post content that is offensive, harassing, threatening, defamatory, obscene, hateful, or otherwise objectionable. Any user may report any comment, and you may block any user so that their content is hidden from you. When a comment reaches our report threshold it is automatically hidden pending review. We review reported content and, upon a valid report, remove the objectionable content and eject the responsible user within 24 hours. By using the service you agree to these safeguards.",
    },
    {
      title: "7. Privacy Policy",
      content:
        "Your use of Ratel's services is also governed by our Privacy Policy. Please review our Privacy Policy to understand our practices regarding the collection and use of your personal information.",
    },
    {
      title: "8. Termination",
      content:
        "We reserve the right to suspend or terminate your account and access to the service at our sole discretion, without notice, for conduct that we believe violates these Terms of Service or is harmful to other users, us, or third parties, or for any other reason.",
    },
    {
      title: "9. Disclaimers",
      content:
        'The service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, timely, secure, or error-free.',
    },
    {
      title: "10. Limitation of Liability",
      content:
        "To the maximum extent permitted by law, Ratel shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.",
    },
    {
      title: "11. Modifications to Terms",
      content:
        "We reserve the right to modify these terms at any time. We will notify users of any material changes by posting the new terms on this page. Your continued use of the service after changes constitutes acceptance of the modified terms.",
    },
    {
      title: "12. Governing Law",
      content:
        "These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of Korea, without regard to its conflict of law provisions.",
    },
  ],
  contact: {
    title: "13. Contact Information",
    content: "If you have any questions about these Terms of Service, please contact us at:",
    emailLabel: "Email",
    addressLabel: "Address",
  },
  ...COMPANY.en,
};

const ko: LegalPageData = {
  title: "서비스 이용약관",
  lastUpdated: "최종 업데이트",
  effectiveDate: "2024년 1월 1일",
  sections: [
    {
      title: "1. 약관의 동의",
      content:
        "Ratel의 서비스를 이용함으로써 귀하는 본 약관의 모든 조항에 동의하고 이에 구속되는 것에 동의합니다. 본 약관에 동의하지 않는 경우 서비스를 이용하지 마십시오.",
    },
    {
      title: "2. 서비스 설명",
      content:
        "Ratel은 설문조사와 숙의를 위한 플랫폼을 제공하여 협력적 의사결정과 의견 수렴을 가능하게 합니다. 우리의 서비스에는 소셜 네트워킹 기능, 공간 관리, 투표 시스템, 숙의 도구 및 관련 기능이 포함됩니다.",
    },
    {
      title: "3. 사용자 계정",
      content:
        "귀하는 계정 자격 증명의 기밀을 유지할 책임이 있습니다. 귀하는 귀하의 계정에서 발생하는 모든 활동에 대한 책임을 수락하는 데 동의합니다. 귀하의 계정이 무단으로 사용된 경우 즉시 당사에 통지해야 합니다.",
    },
    {
      title: "4. 사용자 행위",
      content:
        "귀하는 다음과 같은 목적으로 서비스를 사용하지 않는 데 동의합니다: (a) 불법적이거나 유해하거나 위협적이거나 학대적이거나 괴롭히거나 명예를 훼손하거나 저속하거나 외설적이거나 기타 불쾌한 콘텐츠를 업로드, 게시 또는 전송하는 행위; (b) 개인이나 단체를 사칭하는 행위; (c) 적용 가능한 법률이나 규정을 위반하는 행위; (d) 서비스나 서버를 방해하거나 중단시키는 행위.",
    },
    {
      title: "5. 지적 재산권",
      content:
        "소프트웨어, 데이터베이스, 텍스트, 그래픽, 아이콘 및 하이퍼링크를 포함한 이 플랫폼의 모든 콘텐츠, 상표 및 데이터는 Ratel 또는 그 라이선스 제공자의 재산이며 관련 지적 재산권법에 의해 보호됩니다.",
    },
    {
      title: "6. 사용자 생성 콘텐츠 및 콘텐츠 관리",
      content:
        "귀하는 플랫폼에 게시한 콘텐츠의 소유권을 보유합니다. 콘텐츠를 게시함으로써 귀하는 Ratel에 서비스와 관련하여 귀하의 콘텐츠를 사용, 복제, 수정 및 배포할 수 있는 전 세계적이고 비독점적이며 로열티가 없는 라이선스를 부여합니다.\n\nRatel은 부적절한 콘텐츠와 악의적인 사용자에 대해 무관용 원칙을 적용합니다. 귀하는 모욕적이거나 괴롭히거나 위협적이거나 명예를 훼손하거나 외설적이거나 혐오적이거나 기타 부적절한 콘텐츠를 게시하지 않는 데 동의합니다. 모든 사용자는 어떤 댓글이든 신고할 수 있으며, 귀하는 어떤 사용자든 차단하여 해당 사용자의 콘텐츠가 귀하에게 보이지 않도록 할 수 있습니다. 댓글이 신고 기준치에 도달하면 검토 시까지 자동으로 숨겨집니다. 당사는 신고된 콘텐츠를 검토하며, 유효한 신고가 접수되면 24시간 이내에 해당 부적절한 콘텐츠를 삭제하고 책임 있는 사용자를 추방합니다. 서비스를 이용함으로써 귀하는 이러한 보호 조치에 동의합니다.",
    },
    {
      title: "7. 개인정보처리방침",
      content:
        "Ratel 서비스의 사용은 당사의 개인정보처리방침의 적용을 받습니다. 귀하의 개인정보 수집 및 사용에 관한 당사의 관행을 이해하려면 개인정보처리방침을 검토하십시오.",
    },
    {
      title: "8. 서비스 종료",
      content:
        "당사는 본 이용약관을 위반하거나 다른 사용자, 당사 또는 제3자에게 해로운 행위를 하거나 기타 이유로 통지 없이 당사의 단독 재량으로 귀하의 계정 및 서비스 접근을 중단하거나 종료할 권리를 보유합니다.",
    },
    {
      title: "9. 면책 조항",
      content:
        '서비스는 명시적이든 묵시적이든 어떠한 종류의 보증도 없이 "있는 그대로" 및 "사용 가능한 그대로" 제공됩니다. 당사는 서비스가 중단되지 않고 적시에 안전하며 오류가 없을 것이라고 보증하지 않습니다.',
    },
    {
      title: "10. 책임의 제한",
      content:
        "법률이 허용하는 최대 한도 내에서 Ratel은 서비스 사용 또는 사용 불가능으로 인해 발생하는 간접적, 부수적, 특별, 결과적 또는 징벌적 손해에 대해 책임을 지지 않습니다.",
    },
    {
      title: "11. 약관의 수정",
      content:
        "당사는 언제든지 본 약관을 수정할 권리를 보유합니다. 새로운 약관을 이 페이지에 게시하여 중요한 변경 사항을 사용자에게 알릴 것입니다. 변경 후 서비스를 계속 사용하는 것은 수정된 약관에 대한 수락을 구성합니다.",
    },
    {
      title: "12. 준거법",
      content: "본 이용약관은 법률 충돌 조항에 관계없이 대한민국 법률에 따라 관리되고 해석됩니다.",
    },
  ],
  contact: {
    title: "13. 연락처 정보",
    content: "본 이용약관에 대해 질문이 있으시면 다음으로 연락해 주십시오:",
    emailLabel: "이메일",
    addressLabel: "주소",
  },
  ...COMPANY.ko,
};

export const i18n = { en, ko };

export function useTermsI18n(): LegalPageData {
  return i18n[useLanguage()];
}

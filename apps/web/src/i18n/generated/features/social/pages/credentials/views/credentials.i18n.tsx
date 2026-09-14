// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/social/pages/credentials/views/i18n.rs (`CredentialsTranslate`). Namespace "credentials".
import { useTranslation } from "react-i18next";

const en = {
  page_title: "Credentials",
  back: "Back",
  status_verified: "Verified",
  status_pending: "Pending",
  export_vc: "Export VC",
  hero_eyebrow: "Verifiable Credential",
  hero_methods: "KYC + Offline Code",
  hero_crest_title: "Personal Identity",
  hero_crest_sub: "Issued by Ratel Foundation · bound to your account (no wallet required)",
  hero_did_label: "Decentralized Identifier",
  hero_issued: "Issued",
  hero_expires: "Expires",
  hero_verified_count: "attributes verified",
  hero_copy_did: "Copy DID",
  hero_qr_hint: "Scan to verify credential online",
  stat_attributes: "Attributes",
  stat_attributes_sub: "verified",
  stat_methods: "Methods",
  stat_methods_sub: "KYC & Code",
  stat_last_verified: "Last verified",
  stat_never: "never",
  methods_title: "Verification Methods",
  methods_hint: "Two paths · pick whichever fits the attribute",
  kyc_title: "KYC · PortOne",
  kyc_sub_prefix: "Identity ·",
  kyc_sub_highlight: "Age & Gender",
  kyc_desc: "Real-name identity check via PortOne (KCB). Ratel receives only age & gender — your birthdate, ID number, and full name never leave the KYC provider.",
  kyc_rerun: "Re-run KYC",
  kyc_run: "Start KYC",
  code_title: "Code Verification",
  code_sub_prefix: "Offline-distributed ·",
  code_sub_highlight: "University, Membership…",
  code_desc: "Institutions — universities, employers, conferences, DAOs — hand out one-time codes offline. Paste the code and Ratel attests the attribute without ever contacting the institution.",
  code_hint: "Got a code that looks like RTL-SNU-7F3A-9CB2? Enter it to verify.",
  code_cta: "Enter verification code",
  attrs_title: "My Attributes",
  attrs_hint: "Selectively disclosed · zero-knowledge",
  attr_age: "Age",
  attr_age_sub: "years",
  attr_gender: "Gender",
  attr_male: "Male",
  attr_female: "Female",
  attr_university: "University",
  attr_employer: "Employer",
  attr_membership: "Membership",
  method_kyc: "KYC",
  method_code: "Code",
  not_verified: "Not verified",
  no_codes_redeemed: "No community codes redeemed",
  add_code_generic: "Enter a code",
  add_code_employer: "Enter code from HR",
  add_code_membership: "Redeem a code",
  meta_portone: "PortOne",
  meta_code_label: "Code",
  proof_title: "Cryptographic Proof",
  proof_hint: "Signature valid · issuer key active",
  proof_meta: "Proof Metadata",
  proof_format: "VC format",
  proof_format_value: "W3C VC 2.0",
  proof_suite: "Proof suite",
  proof_suite_value: "Ed25519Signature2020",
  proof_subject: "Subject",
  proof_issued: "Issued",
  proof_sig_title: "Signature Status",
  proof_issuer_key: "Issuer key",
  proof_issuer_key_value: "Active",
  proof_integrity: "Integrity",
  proof_integrity_value: "JSON-LD hash matches",
  proof_revocation: "Revocation",
  proof_revocation_value: "Not revoked",
  proof_signed_by: "Signed by",
  proof_signed_by_suffix: "· Ratel Foundation · valid for 1 year.",
  privacy_title: "Your data, your disclosure",
  privacy_desc_prefix: "Your DID is",
  privacy_desc_suffix: "— no wallet required. Attributes are bound to your account; when a Space or verifier requests a credential, Ratel asks for your explicit consent and shares only the minimum — e.g. 'age ≥ 19' — never your birthdate or ID number.",
  empty_title: "No credentials yet",
  empty_desc: "Your DID exists, but no verifiable credentials are bound to it. Run KYC or redeem a code to unlock age-gated spaces and reward boosts.",
  empty_cta: "Verify your first attribute",
  verification_error: "Verification failed",
  verification_success: "Identity verified",
  modal_code_title: "Enter Code",
  modal_code_placeholder: "Enter verification code",
  modal_cancel: "Cancel",
  modal_submit: "Submit",
};

const ko: Record<keyof typeof en, string> = {
  page_title: "크리덴셜",
  back: "뒤로",
  status_verified: "인증됨",
  status_pending: "미인증",
  export_vc: "VC 내보내기",
  hero_eyebrow: "검증 가능한 자격",
  hero_methods: "KYC + 오프라인 코드",
  hero_crest_title: "개인 신원",
  hero_crest_sub: "Ratel Foundation 발급 · 계정에 귀속 (지갑 불필요)",
  hero_did_label: "탈중앙 식별자",
  hero_issued: "발급",
  hero_expires: "만료",
  hero_verified_count: "속성 인증됨",
  hero_copy_did: "DID 복사",
  hero_qr_hint: "스캔해서 온라인 인증",
  stat_attributes: "속성",
  stat_attributes_sub: "인증됨",
  stat_methods: "인증 수단",
  stat_methods_sub: "KYC & 코드",
  stat_last_verified: "마지막 인증",
  stat_never: "없음",
  methods_title: "인증 수단",
  methods_hint: "두 가지 방식 · 속성에 맞게 선택",
  kyc_title: "KYC · PortOne",
  kyc_sub_prefix: "신원 ·",
  kyc_sub_highlight: "나이 & 성별",
  kyc_desc: "PortOne(KCB) 실명 인증. 생년월일/주민번호/이름은 인증기관 밖으로 나가지 않고, 나이·성별만 Ratel로 전달됩니다.",
  kyc_rerun: "KYC 재실행",
  kyc_run: "KYC 시작",
  code_title: "코드 인증",
  code_sub_prefix: "오프라인 배포 ·",
  code_sub_highlight: "대학·멤버십…",
  code_desc: "대학·직장·컨퍼런스·DAO 등이 오프라인으로 배포하는 1회용 코드를 입력하면 Ratel이 속성을 증명합니다.",
  code_hint: "RTL-SNU-7F3A-9CB2 형식의 코드가 있다면 입력해 주세요.",
  code_cta: "인증 코드 입력",
  attrs_title: "내 속성",
  attrs_hint: "선택적 공개 · 영지식",
  attr_age: "나이",
  attr_age_sub: "세",
  attr_gender: "성별",
  attr_male: "남성",
  attr_female: "여성",
  attr_university: "대학교",
  attr_employer: "직장",
  attr_membership: "멤버십",
  method_kyc: "KYC",
  method_code: "코드",
  not_verified: "미인증",
  no_codes_redeemed: "사용한 커뮤니티 코드 없음",
  add_code_generic: "코드 입력",
  add_code_employer: "HR 코드 입력",
  add_code_membership: "코드 입력",
  meta_portone: "PortOne",
  meta_code_label: "코드",
  proof_title: "암호학적 증명",
  proof_hint: "서명 유효 · 발급자 키 활성",
  proof_meta: "증명 메타데이터",
  proof_format: "VC 형식",
  proof_format_value: "W3C VC 2.0",
  proof_suite: "서명 방식",
  proof_suite_value: "Ed25519Signature2020",
  proof_subject: "대상",
  proof_issued: "발급",
  proof_sig_title: "서명 상태",
  proof_issuer_key: "발급자 키",
  proof_issuer_key_value: "활성",
  proof_integrity: "무결성",
  proof_integrity_value: "JSON-LD 해시 일치",
  proof_revocation: "취소",
  proof_revocation_value: "취소되지 않음",
  proof_signed_by: "서명자",
  proof_signed_by_suffix: "· Ratel Foundation · 1년간 유효.",
  privacy_title: "내 데이터, 내 공개 결정",
  privacy_desc_prefix: "당신의 DID는",
  privacy_desc_suffix: "— 지갑이 필요하지 않습니다. 속성은 계정에 귀속되며, 스페이스나 검증자가 요청하면 Ratel이 명시적 동의를 받아 최소 정보(예: '만 19세 이상')만 공유합니다.",
  empty_title: "아직 크리덴셜이 없습니다",
  empty_desc: "DID는 있지만 아직 어떤 크리덴셜도 연결되지 않았습니다. KYC 또는 코드 인증으로 연령 제한 스페이스·리워드 가산을 해제하세요.",
  empty_cta: "첫 속성 인증하기",
  verification_error: "인증에 실패했습니다",
  verification_success: "본인인증이 완료되었습니다",
  modal_code_title: "코드 입력",
  modal_code_placeholder: "인증 코드를 입력하세요",
  modal_cancel: "취소",
  modal_submit: "제출",
};

export const i18n = { en, ko };

export interface CredentialsI18n {
  pageTitle: string;
  back: string;
  statusVerified: string;
  statusPending: string;
  exportVc: string;
  heroEyebrow: string;
  heroMethods: string;
  heroCrestTitle: string;
  heroCrestSub: string;
  heroDidLabel: string;
  heroIssued: string;
  heroExpires: string;
  heroVerifiedCount: string;
  heroCopyDid: string;
  heroQrHint: string;
  statAttributes: string;
  statAttributesSub: string;
  statMethods: string;
  statMethodsSub: string;
  statLastVerified: string;
  statNever: string;
  methodsTitle: string;
  methodsHint: string;
  kycTitle: string;
  kycSubPrefix: string;
  kycSubHighlight: string;
  kycDesc: string;
  kycRerun: string;
  kycRun: string;
  codeTitle: string;
  codeSubPrefix: string;
  codeSubHighlight: string;
  codeDesc: string;
  codeHint: string;
  codeCta: string;
  attrsTitle: string;
  attrsHint: string;
  attrAge: string;
  attrAgeSub: string;
  attrGender: string;
  attrMale: string;
  attrFemale: string;
  attrUniversity: string;
  attrEmployer: string;
  attrMembership: string;
  methodKyc: string;
  methodCode: string;
  notVerified: string;
  noCodesRedeemed: string;
  addCodeGeneric: string;
  addCodeEmployer: string;
  addCodeMembership: string;
  metaPortone: string;
  metaCodeLabel: string;
  proofTitle: string;
  proofHint: string;
  proofMeta: string;
  proofFormat: string;
  proofFormatValue: string;
  proofSuite: string;
  proofSuiteValue: string;
  proofSubject: string;
  proofIssued: string;
  proofSigTitle: string;
  proofIssuerKey: string;
  proofIssuerKeyValue: string;
  proofIntegrity: string;
  proofIntegrityValue: string;
  proofRevocation: string;
  proofRevocationValue: string;
  proofSignedBy: string;
  proofSignedBySuffix: string;
  privacyTitle: string;
  privacyDescPrefix: string;
  privacyDescSuffix: string;
  emptyTitle: string;
  emptyDesc: string;
  emptyCta: string;
  verificationError: string;
  verificationSuccess: string;
  modalCodeTitle: string;
  modalCodePlaceholder: string;
  modalCancel: string;
  modalSubmit: string;
}

export function useCredentialsI18n(): CredentialsI18n {
  const { t } = useTranslation("credentials");
  return {
    pageTitle: t("page_title"),
    back: t("back"),
    statusVerified: t("status_verified"),
    statusPending: t("status_pending"),
    exportVc: t("export_vc"),
    heroEyebrow: t("hero_eyebrow"),
    heroMethods: t("hero_methods"),
    heroCrestTitle: t("hero_crest_title"),
    heroCrestSub: t("hero_crest_sub"),
    heroDidLabel: t("hero_did_label"),
    heroIssued: t("hero_issued"),
    heroExpires: t("hero_expires"),
    heroVerifiedCount: t("hero_verified_count"),
    heroCopyDid: t("hero_copy_did"),
    heroQrHint: t("hero_qr_hint"),
    statAttributes: t("stat_attributes"),
    statAttributesSub: t("stat_attributes_sub"),
    statMethods: t("stat_methods"),
    statMethodsSub: t("stat_methods_sub"),
    statLastVerified: t("stat_last_verified"),
    statNever: t("stat_never"),
    methodsTitle: t("methods_title"),
    methodsHint: t("methods_hint"),
    kycTitle: t("kyc_title"),
    kycSubPrefix: t("kyc_sub_prefix"),
    kycSubHighlight: t("kyc_sub_highlight"),
    kycDesc: t("kyc_desc"),
    kycRerun: t("kyc_rerun"),
    kycRun: t("kyc_run"),
    codeTitle: t("code_title"),
    codeSubPrefix: t("code_sub_prefix"),
    codeSubHighlight: t("code_sub_highlight"),
    codeDesc: t("code_desc"),
    codeHint: t("code_hint"),
    codeCta: t("code_cta"),
    attrsTitle: t("attrs_title"),
    attrsHint: t("attrs_hint"),
    attrAge: t("attr_age"),
    attrAgeSub: t("attr_age_sub"),
    attrGender: t("attr_gender"),
    attrMale: t("attr_male"),
    attrFemale: t("attr_female"),
    attrUniversity: t("attr_university"),
    attrEmployer: t("attr_employer"),
    attrMembership: t("attr_membership"),
    methodKyc: t("method_kyc"),
    methodCode: t("method_code"),
    notVerified: t("not_verified"),
    noCodesRedeemed: t("no_codes_redeemed"),
    addCodeGeneric: t("add_code_generic"),
    addCodeEmployer: t("add_code_employer"),
    addCodeMembership: t("add_code_membership"),
    metaPortone: t("meta_portone"),
    metaCodeLabel: t("meta_code_label"),
    proofTitle: t("proof_title"),
    proofHint: t("proof_hint"),
    proofMeta: t("proof_meta"),
    proofFormat: t("proof_format"),
    proofFormatValue: t("proof_format_value"),
    proofSuite: t("proof_suite"),
    proofSuiteValue: t("proof_suite_value"),
    proofSubject: t("proof_subject"),
    proofIssued: t("proof_issued"),
    proofSigTitle: t("proof_sig_title"),
    proofIssuerKey: t("proof_issuer_key"),
    proofIssuerKeyValue: t("proof_issuer_key_value"),
    proofIntegrity: t("proof_integrity"),
    proofIntegrityValue: t("proof_integrity_value"),
    proofRevocation: t("proof_revocation"),
    proofRevocationValue: t("proof_revocation_value"),
    proofSignedBy: t("proof_signed_by"),
    proofSignedBySuffix: t("proof_signed_by_suffix"),
    privacyTitle: t("privacy_title"),
    privacyDescPrefix: t("privacy_desc_prefix"),
    privacyDescSuffix: t("privacy_desc_suffix"),
    emptyTitle: t("empty_title"),
    emptyDesc: t("empty_desc"),
    emptyCta: t("empty_cta"),
    verificationError: t("verification_error"),
    verificationSuccess: t("verification_success"),
    modalCodeTitle: t("modal_code_title"),
    modalCodePlaceholder: t("modal_code_placeholder"),
    modalCancel: t("modal_cancel"),
    modalSubmit: t("modal_submit"),
  };
}

// Translations for the React app. Originally extracted from the retired Dioxus
// `translate!` blocks (packages/i18n-extract); now the source of truth — edit here.
// Ported from: app/ratel/src/features/spaces/pages/report/views/i18n.rs (`ReportTranslate`). Namespace "report".
import { useTranslation } from "react-i18next";

const en = {
  title_editor: "Report Editor",
  btn_toggle_edit: "Toggle Edit",
  btn_generate_report: "Generate AI Report",
  btn_edit: "Edit",
  btn_save: "Save",
  status_readonly: "Read-only",
  status_editable: "Editable",
  placeholder: "AI report will appear here...",
  generating: "Generating...",
  generate_failed: "Failed to generate",
};

const ko: Record<keyof typeof en, string> = {
  title_editor: "보고서 편집기",
  btn_toggle_edit: "편집 전환",
  btn_generate_report: "AI 레포트 생성하기",
  btn_edit: "편집",
  btn_save: "저장",
  status_readonly: "읽기 모드",
  status_editable: "편집 모드",
  placeholder: "AI 보고서가 여기에 표시됨...",
  generating: "생성 중...",
  generate_failed: "생성 실패",
};

export const i18n = { en, ko };

export interface ReportI18n {
  titleEditor: string;
  btnToggleEdit: string;
  btnGenerateReport: string;
  btnEdit: string;
  btnSave: string;
  statusReadonly: string;
  statusEditable: string;
  placeholder: string;
  generating: string;
  generateFailed: string;
}

export function useReportI18n(): ReportI18n {
  const { t } = useTranslation("report");
  return {
    titleEditor: t("title_editor"),
    btnToggleEdit: t("btn_toggle_edit"),
    btnGenerateReport: t("btn_generate_report"),
    btnEdit: t("btn_edit"),
    btnSave: t("btn_save"),
    statusReadonly: t("status_readonly"),
    statusEditable: t("status_editable"),
    placeholder: t("placeholder"),
    generating: t("generating"),
    generateFailed: t("generate_failed"),
  };
}

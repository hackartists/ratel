// Ported from: app/ratel/src/common/components/editor/component.rs (`EditorTranslate`). Namespace "editor".
import { useTranslation } from "react-i18next";

const en = {
  format: "Format",
  done: "Done",
  history: "History",
  undo: "Undo",
  redo: "Redo",
  text_style: "Text style",
  body: "Body",
  heading1: "Heading 1",
  heading2: "Heading 2",
  heading3: "Heading 3",
  quote: "Quote",
  code_block: "Code block",
  emphasis: "Emphasis",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strikethrough: "Strikethrough",
  inline_code: "Code",
  lists: "Lists",
  bullet_list: "Bulleted",
  numbered_list: "Numbered",
  outdent: "Outdent",
  indent: "Indent",
  alignment: "Alignment",
  align_left: "Left",
  align_center: "Center",
  align_right: "Right",
  align_justify: "Justify",
  insert: "Insert",
  link: "Link",
  unlink: "Unlink",
  image: "Image",
  video: "Video",
  table: "Table",
  divider: "Divider",
  clear: "Clear",
  clear_format: "Clear formatting",
};

const ko: Record<keyof typeof en, string> = {
  format: "서식",
  done: "완료",
  history: "되돌리기",
  undo: "실행 취소",
  redo: "다시 실행",
  text_style: "텍스트 스타일",
  body: "본문",
  heading1: "큰 제목",
  heading2: "중간 제목",
  heading3: "작은 제목",
  quote: "인용",
  code_block: "코드 블록",
  emphasis: "강조",
  bold: "굵게",
  italic: "기울임",
  underline: "밑줄",
  strikethrough: "취소선",
  inline_code: "인라인 코드",
  lists: "목록",
  bullet_list: "글머리 기호",
  numbered_list: "번호 매기기",
  outdent: "내어쓰기",
  indent: "들여쓰기",
  alignment: "정렬",
  align_left: "왼쪽",
  align_center: "가운데",
  align_right: "오른쪽",
  align_justify: "양쪽",
  insert: "삽입",
  link: "링크",
  unlink: "링크 해제",
  image: "이미지",
  video: "동영상",
  table: "표",
  divider: "구분선",
  clear: "지우기",
  clear_format: "서식 지우기",
};

export const i18n = { en, ko };

export interface EditorI18n {
  format: string;
  done: string;
  history: string;
  undo: string;
  redo: string;
  textStyle: string;
  body: string;
  heading1: string;
  heading2: string;
  heading3: string;
  quote: string;
  codeBlock: string;
  emphasis: string;
  bold: string;
  italic: string;
  underline: string;
  strikethrough: string;
  inlineCode: string;
  lists: string;
  bulletList: string;
  numberedList: string;
  outdent: string;
  indent: string;
  alignment: string;
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  alignJustify: string;
  insert: string;
  link: string;
  unlink: string;
  image: string;
  video: string;
  table: string;
  divider: string;
  clear: string;
  clearFormat: string;
}

export function useEditorI18n(): EditorI18n {
  const { t } = useTranslation("editor");
  return {
    format: t("format"),
    done: t("done"),
    history: t("history"),
    undo: t("undo"),
    redo: t("redo"),
    textStyle: t("text_style"),
    body: t("body"),
    heading1: t("heading1"),
    heading2: t("heading2"),
    heading3: t("heading3"),
    quote: t("quote"),
    codeBlock: t("code_block"),
    emphasis: t("emphasis"),
    bold: t("bold"),
    italic: t("italic"),
    underline: t("underline"),
    strikethrough: t("strikethrough"),
    inlineCode: t("inline_code"),
    lists: t("lists"),
    bulletList: t("bullet_list"),
    numberedList: t("numbered_list"),
    outdent: t("outdent"),
    indent: t("indent"),
    alignment: t("alignment"),
    alignLeft: t("align_left"),
    alignCenter: t("align_center"),
    alignRight: t("align_right"),
    alignJustify: t("align_justify"),
    insert: t("insert"),
    link: t("link"),
    unlink: t("unlink"),
    image: t("image"),
    video: t("video"),
    table: t("table"),
    divider: t("divider"),
    clear: t("clear"),
    clearFormat: t("clear_format"),
  };
}

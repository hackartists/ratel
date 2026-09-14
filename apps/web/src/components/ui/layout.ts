// Layout enums shared by Row, Col and Card — the `strum(serialize)` strings of
// app/ratel/src/common/components/card/mod.rs, verbatim.

export const MainAxisAlign = {
  Start: "justify-start",
  Center: "justify-center",
  End: "justify-end",
  Between: "justify-between",
  Around: "justify-around",
  Evenly: "justify-evenly",
} as const;
export type MainAxisAlign = (typeof MainAxisAlign)[keyof typeof MainAxisAlign];

export const CrossAxisAlign = {
  Start: "items-start",
  Center: "items-center",
  End: "items-end",
  Stretch: "items-stretch",
  Baseline: "items-baseline",
} as const;
export type CrossAxisAlign = (typeof CrossAxisAlign)[keyof typeof CrossAxisAlign];

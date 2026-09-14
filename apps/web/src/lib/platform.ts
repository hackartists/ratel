// app/ratel/src/common/hooks/use_platform.rs — client-side user-agent checks.
// Both are `false` outside a browser, like the Rust server build.

/**
 * Rust `is_ios()`: iPhone/iPad/iPod, plus iPadOS 13+ which masquerades as a
 * desktop Mac (Apple desktop UA or platform, but with a touchscreen).
 */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iphone = ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iPod");
  const touch = navigator.maxTouchPoints > 1;
  const platform = navigator.platform || "";
  const appleDesktop = ua.includes("Macintosh") || platform.includes("Mac") || platform.includes("iP");
  return iphone || (touch && appleDesktop);
}

/** Rust `is_android()`: the native Android WebView or a mobile browser. */
export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator.userAgent || "").includes("Android");
}

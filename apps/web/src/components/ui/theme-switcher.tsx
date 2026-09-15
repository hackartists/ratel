import * as React from "react";
import { Moon, Sun, SunMoon } from "@/components/icons/theme";
import { Theme, useTheme } from "@/lib/theme";

// app/ratel/src/common/components/theme_switcher/mod.rs + theme.rs. Labels are
// the untranslated `Theme::label()` strings the Rust switcher renders.

const ICON_CLASS = "[&>path]:stroke-icon-primary [&>circle]:stroke-icon-primary";
const LABEL: Record<Theme, string> = { light: "Light", dark: "Dark", system: "System" };
const OPTIONS: Theme[] = [Theme.Light, Theme.Dark, Theme.System];

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === Theme.Light) return <Sun className={ICON_CLASS} height="24" />;
  if (theme === Theme.Dark) return <Moon className={ICON_CLASS} height="24" />;
  return <SunMoon className={ICON_CLASS} height="24" />;
}

export function ThemeSwitcher() {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        className="flex flex-col items-center py-2 px-3 rounded-lg transition-colors cursor-pointer hover:bg-accent-hover"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm">
          <ThemeIcon theme={theme.current} />
        </span>
        <span className="text-sm font-medium">{LABEL[theme.current]}</span>
      </button>

      {open && (
        <div className="overflow-hidden absolute right-0 top-full z-50 mt-1 rounded-lg border shadow-lg min-w-[140px] bg-card border-border">
          {OPTIONS.map((option) => (
            <button
              key={option}
              className={`flex gap-2 items-center w-full px-3 py-2 text-sm hover:bg-accent-hover cursor-pointer transition-colors ${option === theme.current ? "bg-accent-hover" : ""}`}
              onClick={() => {
                theme.set(option);
                setOpen(false);
              }}
            >
              <span>
                <ThemeIcon theme={option} />
              </span>
              <span>{LABEL[option]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

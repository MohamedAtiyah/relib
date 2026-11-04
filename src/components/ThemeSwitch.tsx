import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

type Theme = (typeof OPTIONS)[number]["value"];

function saved(): Theme {
  try {
    const t = localStorage.getItem("relib:theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(saved);

  const pick = (next: Theme) => {
    setTheme(next);
    if (next === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("relib:theme", next);
    } catch {
      // the choice still applies until the tab closes
    }
  };

  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-full bg-sand p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => pick(value)}
          className={`rounded-full p-1.5 ${theme === value ? "bg-surface text-ink" : "text-muted hover:text-ink"}`}
        >
          <Icon size={13} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

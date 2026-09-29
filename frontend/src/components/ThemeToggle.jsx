import { useTheme } from "../lib/theme.js";
import { track } from "../lib/track.js";
import Icon from "./Icon.jsx";

/** Sun/moon: shows the theme you'd switch to. Follows the device until tapped; "Match device theme" is in the account menu. */
export default function ThemeToggle({ className = "icon-button" }) {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  const label = `Switch to ${next} mode`;
  return (
    <button className={`${className} theme-toggle`} onClick={() => { toggle(); track("theme_changed", { value: next }); }}
            aria-label={label} title={label}>
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

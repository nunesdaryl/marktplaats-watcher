import { UserButton } from "@clerk/clerk-react";
import { useTheme } from "../lib/theme.js";
import { track } from "../lib/track.js";
import Icon from "./Icon.jsx";

/** Clerk's account menu, plus "Match device theme" while the sun/moon toggle overrides the device setting. */
export default function AccountButton() {
  const { pref, reset } = useTheme();
  return (
    <UserButton>
      {pref !== "system" && (
        <UserButton.MenuItems>
          <UserButton.Action label="Match device theme" labelIcon={<Icon name="refresh" size={16} />}
                             onClick={() => { reset(); track("theme_changed", { value: "system" }); }} />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}

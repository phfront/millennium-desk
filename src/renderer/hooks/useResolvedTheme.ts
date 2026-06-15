import { useEffect, useState } from "react";
import type { ThemePreference } from "../../shared/contracts";

export function useResolvedTheme(preference: ThemePreference) {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return preference === "system"
    ? systemDark
      ? "dark"
      : "light"
    : preference;
}

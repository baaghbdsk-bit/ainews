import { useCallback, useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  if (typeof window === "undefined") return () => {};
  const observer = new MutationObserver(() => notify());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
};

const getSnapshot = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset.theme === "light";
};

const getServerSnapshot = () => false;

/**
 * Universal theme hook: syncs with documentElement dataset.theme,
 * persists to localStorage, and causes zero cascading renders.
 */
export function useTheme(): [boolean, () => void] {
  const isLight = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    if (root.dataset.theme === "light") {
      delete root.dataset.theme;
      try {
        localStorage.setItem("neubench-theme", "dark");
      } catch {}
    } else {
      root.dataset.theme = "light";
      try {
        localStorage.setItem("neubench-theme", "light");
      } catch {}
    }
  }, []);

  return [isLight, toggleTheme];
}


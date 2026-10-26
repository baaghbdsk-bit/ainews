"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_UNTIL_KEY = "neubench-install-dismissed-until";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  const mediaStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosInstall, setIosInstall] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    try {
      const dismissedUntil = Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY) || 0);
      if (dismissedUntil > Date.now()) return;
    } catch {
      // Storage may be unavailable in a private browsing context.
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      window.setTimeout(() => setVisible(true), 1200);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Safari does not expose beforeinstallprompt, so give iOS users the
    // platform-specific Add to Home Screen instruction instead.
    if (isIos()) window.setTimeout(() => { setIosInstall(true); setVisible(true); }, 1200);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + DISMISS_FOR_MS));
    } catch {
      // The prompt can still be dismissed for the current session.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") setVisible(false);
    setInstallEvent(null);
  };

  if (!visible) return null;

  return (
    <aside className="pwa-install-prompt" role="dialog" aria-label="Install NeuBench">
      <div className="pwa-install-icon" aria-hidden="true"><Download size={18} /></div>
      <div className="pwa-install-copy">
        <strong>Install NeuBench</strong>
        <span>{iosInstall ? "Tap Share, then Add to Home Screen." : "Keep the AI intelligence index one tap away."}</span>
      </div>
      {!iosInstall && installEvent ? (
        <button className="pwa-install-action" type="button" onClick={() => void install()}>Install</button>
      ) : null}
      <button className="pwa-install-dismiss" type="button" onClick={dismiss} aria-label="Dismiss install prompt" title="Not now"><X size={16} /></button>
    </aside>
  );
}

"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function RouteMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const pointerCards = [
      ".bh-mod",
      ".ex-panel-card",
      ".ex-row",
      ".story-row",
      ".bench-grid-card",
      ".about-stat-card",
      ".about-feature-card",
      ".about-pillar-card",
      ".connect-card",
      ".admin-stat",
      ".admin-feedback",
      ".connect-channels-card",
      ".score-card",
      ".related-card",
    ].join(",");
    const canTrackPointer =
      window.innerWidth >= 1081 &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!canTrackPointer) return;

    let activeCard: HTMLElement | null = null;
    let frame = 0;
    let tiltX = 0;
    let tiltY = 0;
    let shiftX = 0;
    let shiftY = 0;

    function clearCard() {
      activeCard?.style.removeProperty("--pointer-tilt-x");
      activeCard?.style.removeProperty("--pointer-tilt-y");
      activeCard?.style.removeProperty("--pointer-shift-x");
      activeCard?.style.removeProperty("--pointer-shift-y");
      activeCard?.style.removeProperty("--pointer-x");
      activeCard?.style.removeProperty("--pointer-y");
      activeCard = null;
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const target = event.target;
      const nextCard =
        target instanceof Element
          ? target.closest<HTMLElement>(pointerCards)
          : null;

      if (nextCard !== activeCard) {
        clearCard();
        activeCard = nextCard;
      }

      if (!activeCard) return;

      const bounds = activeCard.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
      tiltX = (0.5 - y) * 5;
      tiltY = (x - 0.5) * 7;
      shiftX = (x - 0.5) * 14;
      shiftY = (y - 0.5) * 10;

      if (!frame) {
        frame = window.requestAnimationFrame(() => {
          activeCard?.style.setProperty("--pointer-tilt-x", `${tiltX}deg`);
          activeCard?.style.setProperty("--pointer-tilt-y", `${tiltY}deg`);
          activeCard?.style.setProperty("--pointer-shift-x", `${shiftX}px`);
          activeCard?.style.setProperty("--pointer-shift-y", `${shiftY}px`);
          activeCard?.style.setProperty("--pointer-x", `${x * 100}%`);
          activeCard?.style.setProperty("--pointer-y", `${y * 100}%`);
          frame = 0;
        });
      }
    }

    function onPointerOut(event: PointerEvent) {
      if (!(event.target instanceof Element) || !activeCard) return;
      const leavingCard = event.target.closest<HTMLElement>(pointerCards);
      if (
        leavingCard === activeCard &&
        !(event.relatedTarget instanceof Node && activeCard.contains(event.relatedTarget))
      ) {
        clearCard();
      }
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      if (frame) window.cancelAnimationFrame(frame);
      clearCard();
    };
  }, []);

  return (
    <ViewTransition
      key={pathname}
      enter="page-arrive"
      exit="page-depart"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

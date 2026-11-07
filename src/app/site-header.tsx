"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { NeubenchLogo } from "@/components/neubench-logo";
import { AccountButton } from "@/components/auth/account-button";
import { ThemeToggle } from "@/components/theme-toggle";

function GlobalNavLinks() {
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view") || "";

  const isHomeActive = pathname === "/home" || pathname === "/";
  const isLatestActive =
    pathname === "/latest" || (pathname === "/explore" && (currentView === "latest" || !currentView));
  const isTrendingActive = pathname === "/explore" && currentView === "trending";
  const isSavedActive = pathname === "/explore" && currentView === "saved";
  const isBenchmarksActive =
    pathname === "/benchmarks" || (pathname === "/explore" && currentView === "benchmarks");
  const isAboutActive = pathname === "/about" || (pathname === "/explore" && currentView === "about");
  const isConnectActive =
    pathname === "/feedback" || (pathname === "/explore" && (currentView === "connect" || currentView === "feedback"));

  return (
    <nav className="global-nav" aria-label="Primary navigation">
      <Link
        className={`global-nav-link ${isHomeActive ? "active" : ""}`}
        aria-current={isHomeActive ? "page" : undefined}
        href="/home"
      >
        Home
      </Link>
      <Link
        className={`global-nav-link ${isLatestActive ? "active" : ""}`}
        aria-current={isLatestActive ? "page" : undefined}
        href="/explore?view=latest"
      >
        Latest
      </Link>
      <Link
        className={`global-nav-link ${isTrendingActive ? "active" : ""}`}
        aria-current={isTrendingActive ? "page" : undefined}
        href="/explore?view=trending"
      >
        Trending
      </Link>
      <Link
        className={`global-nav-link ${isSavedActive ? "active" : ""}`}
        aria-current={isSavedActive ? "page" : undefined}
        href="/explore?view=saved"
      >
        Saved
      </Link>
      <Link
        className={`global-nav-link ${isBenchmarksActive ? "active" : ""}`}
        aria-current={isBenchmarksActive ? "page" : undefined}
        href="/explore?view=benchmarks"
      >
        Benchmarks
      </Link>
      <Link
        className={`global-nav-link ${isAboutActive ? "active" : ""}`}
        aria-current={isAboutActive ? "page" : undefined}
        href="/explore?view=about"
      >
        About
      </Link>
      <Link
        className={`global-nav-link ${isConnectActive ? "active" : ""}`}
        aria-current={isConnectActive ? "page" : undefined}
        href="/explore?view=connect"
      >
        Feedback &amp; Connect
      </Link>
    </nav>
  );
}

/**
 * The site header shell, shared by benchmarks, article pages, loading
 * skeleton, and 404 page so navigation renders identically everywhere.
 */
export function SiteHeader({
  children,
  className,
  right,
}: {
  children?: React.ReactNode;
  className?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className={`topbar archive-topbar${className ? ` ${className}` : ""}`}>
      <Link className="wordmark" href="/home" aria-label="NEUBENCH, home" title="NEUBENCH home">
        <NeubenchLogo variant="icon" size={28} />
      </Link>
      <Suspense
        fallback={
          <nav className="global-nav" aria-label="Primary navigation">
            <Link className="global-nav-link" href="/home">Home</Link>
            <Link className="global-nav-link" href="/explore?view=latest">Latest</Link>
            <Link className="global-nav-link" href="/explore?view=trending">Trending</Link>
            <Link className="global-nav-link" href="/explore?view=saved">Saved</Link>
            <Link className="global-nav-link active" href="/explore?view=benchmarks">Benchmarks</Link>
            <Link className="global-nav-link" href="/explore?view=about">About</Link>
            <Link className="global-nav-link" href="/explore?view=connect">Feedback &amp; Connect</Link>
          </nav>
        }
      >
        <GlobalNavLinks />
      </Suspense>
      <div className="account-slot">
        {children}
        {right}
        <ThemeToggle />
        <AccountButton iconOnly />
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NeubenchLogo } from "@/components/neubench-logo";
import { AccountButton } from "@/components/auth/account-button";
import { ThemeToggle } from "@/components/theme-toggle";

function GlobalNavLinks() {
  const pathname = usePathname() || "";
  const isHomeActive = pathname === "/home" || pathname === "/";
  const isLatestActive = pathname === "/latest" || pathname === "/explore";
  const isTrendingActive = pathname === "/trending";
  const isSavedActive = pathname === "/saved";
  const isBenchmarksActive = pathname === "/benchmarks";
  const isAboutActive = pathname === "/about";
  const isConnectActive = pathname === "/connect" || pathname === "/feedback";

  return (
    <nav className="global-nav" aria-label="Primary navigation">
      <Link
        className={`global-nav-link ${isHomeActive ? "active" : ""}`}
        aria-current={isHomeActive ? "page" : undefined}
        href="/home"
        prefetch={false}
      >
        Home
      </Link>
      <Link
        className={`global-nav-link ${isLatestActive ? "active" : ""}`}
        aria-current={isLatestActive ? "page" : undefined}
        href="/latest"
        prefetch={false}
      >
        Latest
      </Link>
      <Link
        className={`global-nav-link ${isTrendingActive ? "active" : ""}`}
        aria-current={isTrendingActive ? "page" : undefined}
        href="/trending"
        prefetch={false}
      >
        Trending
      </Link>
      <Link
        className={`global-nav-link ${isSavedActive ? "active" : ""}`}
        aria-current={isSavedActive ? "page" : undefined}
        href="/saved"
        prefetch={false}
      >
        Saved
      </Link>
      <Link
        className={`global-nav-link ${isBenchmarksActive ? "active" : ""}`}
        aria-current={isBenchmarksActive ? "page" : undefined}
        href="/benchmarks"
        prefetch={false}
      >
        Benchmarks
      </Link>
      <Link
        className={`global-nav-link ${isAboutActive ? "active" : ""}`}
        aria-current={isAboutActive ? "page" : undefined}
        href="/about"
        prefetch={false}
      >
        About
      </Link>
      <Link
        className={`global-nav-link ${isConnectActive ? "active" : ""}`}
        aria-current={isConnectActive ? "page" : undefined}
        href="/connect"
        prefetch={false}
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
      <GlobalNavLinks />
      <div className="account-slot">
        {children}
        {right}
        <ThemeToggle />
        <AccountButton iconOnly />
      </div>
    </header>
  );
}

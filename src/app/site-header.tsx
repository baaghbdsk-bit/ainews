import Link from "next/link";
import { NeubenchLogo } from "@/components/neubench-logo";
import { AccountButton } from "@/components/auth/account-button";

/**
 * The site header shell, shared by the timeline, the article page, the loading
 * skeleton, the error boundary, and the 404 page so the wordmark (ring + pulse
 * emblem + "neubench.") renders identically everywhere and hydration never shifts
 * the layout. Extra content (topic tabs, back links) slots in around it.
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
      <Link className="wordmark" href="/" aria-label="NEUBENCH, home">
        <NeubenchLogo size={22} />
      </Link>
      <nav className="global-nav" aria-label="Primary navigation">
        <Link className="global-nav-link" href="/">Timeline</Link>
        <Link className="global-nav-link" href="/benchmarks">Benchmarks</Link>
        <Link className="global-nav-link" href="/about">About</Link>
      </nav>
      {children}
      <div className="account-slot">
        <AccountButton />
      </div>
      {right}
    </header>
  );
}

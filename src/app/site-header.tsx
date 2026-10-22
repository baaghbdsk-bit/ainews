import Link from "next/link";
import { NeuBenchLogo } from "@/components/neubench-logo";
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
      <Link className="wordmark" href="/" aria-label="NeuBench — The Pulse of AI, home">
        <span className="wordmark-symbol" aria-hidden="true">
          <NeuBenchLogo size={22} />
        </span>
        <span className="wordmark-text">
          <span className="wordmark-neu">Neu</span>
          <span className="wordmark-bench">Bench</span>
          <span className="wordmark-dot" aria-hidden="true" />
        </span>
      </Link>
      {children}
      <div className="account-slot">
        <AccountButton />
      </div>
      {right}
    </header>
  );
}

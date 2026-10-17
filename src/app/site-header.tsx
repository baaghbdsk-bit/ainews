import Link from "next/link";
import { Orbit } from "lucide-react";

/**
 * The site header shell, shared by the timeline, the article page, the loading
 * skeleton, the error boundary, and the 404 page so the wordmark (ring + orbit
 * mark + "signal.") renders identically everywhere and hydration never shifts
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
      <Link className="wordmark" href="/" aria-label="Signal, home">
        <span className="wordmark-symbol" aria-hidden="true">
          <Orbit size={19} strokeWidth={2.1} />
        </span>
        <span>
          signal<span className="wordmark-period">.</span>
        </span>
      </Link>
      {children}
      {right}
    </header>
  );
}

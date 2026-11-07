'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Ellipsis, House, Newspaper, TrendingUp } from 'lucide-react';

const primaryLinks = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/latest', label: 'Latest', icon: Newspaper },
  { href: '/trending', label: 'Trending', icon: TrendingUp },
  { href: '/saved', label: 'Saved', icon: Bookmark },
] as const;

const moreLinks = [
  { href: '/benchmarks', label: 'Benchmarks' },
  { href: '/about', label: 'About' },
  { href: '/connect', label: 'Connect' },
] as const;

export function MobilePrimaryNavigation() {
  const pathname = usePathname() || '/';
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isMoreActive = moreLinks.some(({ href }) => pathname === href);

  return (
    <nav className="mobile-primary-nav" aria-label="Primary navigation">
      {isMoreOpen && (
        <div className="mobile-more-menu" id="mobile-more-menu">
          {moreLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              aria-current={pathname === href ? 'page' : undefined}
              onClick={() => setIsMoreOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
      <div className="mobile-primary-nav-items">
        {primaryLinks.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href === '/home' && pathname === '/');
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={isActive ? 'is-active' : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setIsMoreOpen(false)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className={isMoreActive || isMoreOpen ? 'is-active' : undefined}
          aria-expanded={isMoreOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setIsMoreOpen((open) => !open)}
        >
          <Ellipsis size={19} aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

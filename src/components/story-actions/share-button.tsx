'use client';

import { useState, useRef, useEffect, useId } from 'react';
import { Share2, Check, Copy, ExternalLink, X } from 'lucide-react';

interface ShareButtonProps {
  title: string;
  slug: string;
  summary?: string;
  topic?: string;
  className?: string;
}

export function ShareButton({
  title,
  slug,
  summary,
  topic,
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const getUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/story/${slug}`;
    }
    return `/story/${slug}`;
  };

  const closeMenu = (returnFocus: boolean) => {
    setIsOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const url = getUrl();

    // Use native Web Share API on mobile / supported devices
    if (typeof navigator !== 'undefined' && navigator.share && window.innerWidth < 768) {
      try {
        const topicPrefix = topic ? `[${topic}] ` : '';
        await navigator.share({
          title,
          text: summary ? `${topicPrefix}${title} — ${summary.slice(0, 130)}...` : `${topicPrefix}${title}`,
          url,
        });
        return;
      } catch {
        // User dismissed or unsupported, fall through to menu
      }
    }

    setIsOpen((prev) => !prev);
  };

  const copyLink = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const url = getUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Move focus into the menu when it opens, and leave it on the trigger when
  // it closes so keyboard users are never dropped back onto <body>.
  useEffect(() => {
    if (!isOpen) return;
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
  }, [isOpen]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;

    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex = 0;

    if (event.key === 'End') {
      nextIndex = items.length - 1;
    } else if (event.key === 'ArrowUp') {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex < 0 || currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    }

    items[nextIndex]?.focus();
  };

  const url = typeof window !== 'undefined' ? getUrl() : '';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(`${title} | NeuBench`);

  const shareLinks = [
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'Reddit',
      href: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      name: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
    },
  ];

  return (
    <div
      className={`story-share-wrapper ${className}`}
      ref={wrapperRef}
      onKeyDown={handleMenuKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleShareClick}
        aria-label="Share story"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        className={`story-action-btn share-btn ${isOpen ? 'is-active' : ''}`}
        title="Share story"
      >
        {copied ? (
          <>
            <Check size={14} className="text-emerald-400" />
            <span className="action-btn-label">Copied!</span>
          </>
        ) : (
          <>
            <Share2 size={14} />
            <span className="action-btn-label">Share</span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          className="share-dropdown-menu"
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Share options"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="share-dropdown-header">
            <span>Share Story</span>
            <button
              type="button"
              onClick={() => closeMenu(true)}
              className="share-close-btn"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={copyLink}
            className="share-menu-item copy-link-item"
            role="menuitem"
            tabIndex={-1}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Link copied to clipboard!' : 'Copy direct link'}</span>
          </button>

          <div className="share-divider" />

          <div className="share-links-list">
            {shareLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="share-menu-item"
                role="menuitem"
                tabIndex={-1}
                onClick={() => setIsOpen(false)}
              >
                <span>{item.name}</span>
                <ExternalLink size={12} className="opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

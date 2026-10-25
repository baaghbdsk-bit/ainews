'use client';

import React, { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, User as UserIcon, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/auth/store';

/**
 * The header affordance for the account.
 *
 * A guest sees a plain "Sign in" button. It never opens a dialog by itself -
 * the reading experience is not interrupted, and the choice to sign in is
 * always the reader's.
 */
export function AccountButton() {
  const { user, status, openAuth, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  if (status === 'loading') {
    return <span className="account-btn account-btn-ghost" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <button type="button" className="account-btn" onClick={openAuth} data-tour-target="account">
        <LogIn size={14} />
        <span>Sign in</span>
      </button>
    );
  }

  const label = user.email ?? 'Account';
  const emailVerified = user.user_metadata?.neubench_email_verified === true;

  return (
    <div className="account-wrap" ref={wrapRef}>
      <button
        type="button"
        className="account-btn account-btn-user"
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        data-tour-target="account"
      >
        <UserIcon size={16} />
      </button>

      {menuOpen && (
        <div className="account-menu" role="menu">
          <div className="account-menu-head">
            <span className="account-menu-label">Signed in as</span>
            <span className="account-menu-email">{label}</span>
            <span
              className={`account-verify-status ${emailVerified ? 'is-verified' : 'is-unverified'}`}
            >
              {emailVerified ? 'Email verified' : 'Email not verified'}
            </span>
          </div>
          
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useTour, hidePrompt } from './tour-store';

/**
 * One-time prompt shown after a reader completes sign in / sign up. Never
 * blocks: refusing just dismisses it and the reader keeps browsing.
 */
export function TourPromptDialog({
  onAccept,
  onRefuse,
}: {
  onAccept: () => void;
  onRefuse: () => void;
}) {
  const { status } = useTour();

  const handleRefuse = () => {
    hidePrompt();
    onRefuse();
  };

  useEffect(() => {
    if (status !== 'not-started') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hidePrompt();
        onRefuse();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, onRefuse]);

  if (status !== 'not-started') return null;

  return (
    <div className="auth-overlay" role="dialog" aria-modal="true">
      <div className="auth-dialog" style={{ maxWidth: 420 }}>
        <div className="auth-head">
          <span className="auth-kicker">
            <Sparkles size={12} /> Welcome to NeuBench
          </span>
          <h2 className="auth-title">Want a 20-second tour?</h2>
          <p className="auth-subtitle">
            Three quick steps: your account, the timeline, and finding your
            topics. You can leave at any time.
          </p>
        </div>

        <div className="auth-switches">
          <button
            type="button"
            className="auth-submit"
            autoFocus
            onClick={() => {
              hidePrompt();
              onAccept();
            }}
          >
            <ArrowRight size={15} />
            <span>Start tour</span>
          </button>
          <button type="button" className="auth-link" onClick={handleRefuse}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

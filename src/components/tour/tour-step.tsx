'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';

type TourStepProps = {
  step: number;
  totalSteps: number;
  title: string;
  body: string;
  target: string;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  onSkip: () => void;
  isLast: boolean;
};

const HIGHLIGHT_CLASS = 'tour-highlight';

export function TourStep({
  step,
  totalSteps,
  title,
  body,
  target,
  onNext,
  onPrev,
  onComplete,
  onSkip,
  isLast,
}: TourStepProps) {
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  useEffect(() => {
    // Highlight the element this step is about, when it exists on this page.
    // The tour card is not modal, so the reader can keep browsing either way.
    const el = target ? document.querySelector<HTMLElement>(target) : null;
    if (el) {
      targetRef.current = el;
      el.classList.add(HIGHLIGHT_CLASS);
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    return () => {
      if (targetRef.current) {
        targetRef.current.classList.remove(HIGHLIGHT_CLASS);
        targetRef.current = null;
      }
    };
  }, [target, step]);

  return (
    <div className="tour-layer">
      <section
        className="tour-card"
        role="dialog"
        aria-label={`Tour step ${step} of ${totalSteps}`}
      >
        <button type="button" className="tour-close" onClick={onSkip} aria-label="Skip tour">
          <X size={15} />
        </button>

        <div className="tour-progress">
          <span className="tour-step-counter">{step} / {totalSteps}</span>
          <div className="tour-bar">
            <div
              className="tour-bar-fill"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="tour-head">
          <span className="tour-kicker">
            <Sparkles size={12} /> Quick tour
          </span>
          <h3 className="tour-title">{title}</h3>
          <p className="tour-body">{body}</p>
        </div>

        <div className="tour-controls">
          {step > 1 && (
            <button type="button" className="tour-btn tour-btn-ghost" onClick={onPrev}>
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <button type="button" className="tour-btn tour-btn-ghost" onClick={onSkip}>
            Skip
          </button>
          <span className="tour-spacer" />
          {!isLast ? (
            <button type="button" className="tour-btn tour-btn-next" onClick={onNext}>
              Next <ArrowRight size={14} />
            </button>
          ) : (
            <button type="button" className="tour-btn tour-btn-next" onClick={onComplete}>
              Done <CheckCircle2 size={14} />
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

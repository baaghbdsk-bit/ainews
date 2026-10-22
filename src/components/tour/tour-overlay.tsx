'use client';

import { useTour, TOTAL_STEPS } from './tour-store';
import { TourStep } from './tour-step';

const STEPS: Array<{
  id: string;
  title: string;
  body: string;
  target: string;
}> = [
  {
    id: 'account',
    title: 'Your account',
    body:
      'Browsing is open to everyone. Sign in when you want to vote, save '
      + 'stories, and keep them across devices.',
    target: '[data-tour-target="account"]',
  },
  {
    id: 'timeline',
    title: 'The AI timeline',
    body:
      'Every card is a story. Scroll the feed, then open any card to read the '
      + 'full article.',
    target: '[data-tour-target="timeline"]',
  },
  {
    id: 'filter',
    title: 'Find your topics',
    body:
      'Use the topic chips and search to focus on the AI areas you care about. '
      + 'That is the whole tour - enjoy the feed.',
    target: '[data-tour-target="filter"]',
  },
];

export function TourOverlay() {
  const { status, currentStep, nextStep, prevStep, completeTour, dismissTour } = useTour();

  if (status !== 'in-progress') return null;

  const current = STEPS[currentStep - 1];
  if (!current) return null;

  const isLast = currentStep === TOTAL_STEPS;

  return (
    <TourStep
      step={currentStep}
      totalSteps={TOTAL_STEPS}
      title={current.title}
      body={current.body}
      target={current.target}
      onNext={() => {
        if (isLast) completeTour();
        else nextStep();
      }}
      onPrev={prevStep}
      onComplete={completeTour}
      onSkip={dismissTour}
      isLast={isLast}
    />
  );
}

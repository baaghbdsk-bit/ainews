'use client';

import { useSyncExternalStore } from 'react';

const TOUR_KEY = 'neubench_tour_status';

export type TourStatus = 'not-started' | 'in-progress' | 'completed' | 'dismissed';

export const TOTAL_STEPS = 3;

export interface TourState {
  status: TourStatus;
  currentStep: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  completeTour: () => void;
  dismissTour: () => void;
  resetTour: () => void;
  showPrompt: () => void;
  hidePrompt: () => void;
  promptOpen: boolean;
}

// Only a finished tour is remembered. A tour left in progress is never
// resumed on the next page load: the overlay must not hijack the app.
function loadInitialStatus(): TourStatus {
  if (typeof window === 'undefined') return 'not-started';
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    if (raw === 'completed' || raw === 'dismissed') return raw;
    if (raw === 'in-progress') localStorage.removeItem(TOUR_KEY);
  } catch {
    // ignore quota / private browsing
  }
  return 'not-started';
}

let status: TourStatus = loadInitialStatus();
let currentStep = 1;
let promptOpen = false;

const listeners = new Set<() => void>();

function buildSnapshot(): TourState {
  return {
    status,
    currentStep,
    totalSteps: TOTAL_STEPS,
    promptOpen,
    startTour,
    nextStep,
    prevStep,
    completeTour,
    dismissTour,
    resetTour,
    showPrompt,
    hidePrompt,
  };
}

let snapshot: TourState = buildSnapshot();

// Hydration must always see the same state the server rendered, regardless of
// what this browser has in localStorage.
const SERVER_SNAPSHOT: TourState = {
  ...snapshot,
  status: 'not-started',
  currentStep: 1,
  promptOpen: false,
};

function emit() {
  snapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TourState {
  return snapshot;
}

function getServerSnapshot(): TourState {
  return SERVER_SNAPSHOT;
}

export function startTour(): void {
  if (status === 'completed' || status === 'dismissed') return;
  status = 'in-progress';
  currentStep = 1;
  promptOpen = false;
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // ignore
  }
  emit();
}

export function nextStep(): void {
  if (currentStep < TOTAL_STEPS) {
    currentStep += 1;
    emit();
  } else {
    completeTour();
  }
}

export function prevStep(): void {
  if (currentStep > 1) {
    currentStep -= 1;
    emit();
  }
}

export function completeTour(): void {
  status = 'completed';
  promptOpen = false;
  try {
    localStorage.setItem(TOUR_KEY, 'completed');
  } catch {
    // ignore
  }
  emit();
}

export function dismissTour(): void {
  status = 'dismissed';
  promptOpen = false;
  try {
    localStorage.setItem(TOUR_KEY, 'dismissed');
  } catch {
    // ignore
  }
  emit();
}

export function resetTour(): void {
  status = 'not-started';
  currentStep = 1;
  promptOpen = false;
  try {
    localStorage.removeItem(TOUR_KEY);
  } catch {
    // ignore
  }
  emit();
}

export function showPrompt(): void {
  if (status !== 'not-started') return;
  promptOpen = true;
  emit();
}

export function hidePrompt(): void {
  promptOpen = false;
  emit();
}

export function useTour(): TourState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

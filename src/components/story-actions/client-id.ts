'use client';

const CLIENT_ID_KEY = 'signal_client_token';

/**
 * Returns a persistent anonymous client token stored in localStorage.
 * Ensures zero-friction voting without forcing user account creation.
 */
export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = 'anon_' + Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36);
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      // Ignore private browsing quota issues
    }
  }
  return id;
}


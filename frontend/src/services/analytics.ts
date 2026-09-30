/**
 * CampusOS Analytics & Telemetry Client
 *
 * Lightweight, non-blocking telemetry client designed to fail gracefully.
 * Tracks meaningful high-level user actions without cluttering the database or
 * impacting user experience.
 */

import { StudentProfile } from '../types';
import { getApiBase, getAuthHeaders, fetchWithTimeout, parseSafeJson } from './api';

// Throttle threshold for identical page views (30 seconds)
const PAGE_VIEW_THROTTLE_MS = 30000;

interface ThrottleState {
  lastEvent: string;
  lastPage: string;
  lastTimestamp: number;
}

let lastPageViewThrottle: ThrottleState = {
  lastEvent: '',
  lastPage: '',
  lastTimestamp: 0,
};

export const CampusAnalytics = {
  /**
   * Tracks a meaningful event with optional page context and metadata.
   * Execution is completely non-blocking and errors are silently handled.
   */
  trackEvent: (
    eventName: string,
    page?: string,
    metadata?: Record<string, any>
  ): void => {
    // Fire and forget via async IIFE to guarantee zero blocking on UI threads
    (async () => {
      try {
        const cleanEvent = (eventName || '').trim();
        if (!cleanEvent) return;

        const resolvedPage = page || (typeof window !== 'undefined' ? window.location.pathname : '/');

        // Throttle rapid re-renders or identical page views
        if (cleanEvent.endsWith('_viewed')) {
          const now = Date.now();
          if (
            lastPageViewThrottle.lastEvent === cleanEvent &&
            lastPageViewThrottle.lastPage === resolvedPage &&
            now - lastPageViewThrottle.lastTimestamp < PAGE_VIEW_THROTTLE_MS
          ) {
            return; // Suppress duplicate re-render event
          }
          lastPageViewThrottle = {
            lastEvent: cleanEvent,
            lastPage: resolvedPage,
            lastTimestamp: now,
          };
        }

        const base = getApiBase();
        const regNo = typeof window !== 'undefined'
          ? (window.localStorage.getItem('campus_current_reg_no') || window.localStorage.getItem('campus_vtop_username'))
          : null;

        await fetchWithTimeout(`${base}/analytics/track`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            event: cleanEvent,
            page: resolvedPage,
            metadata: metadata || {},
            regNo: regNo || undefined,
          }),
        }, 8000);
      } catch (err) {
        // Telemetry must fail silently and never disrupt the user or main application logic
        console.debug('[CampusAnalytics] Telemetry event notice (ignored):', err);
      }
    })();
  },

  /**
   * Track high-level route / view navigation.
   */
  trackPageView: (viewName: string, metadata?: Record<string, any>): void => {
    const eventName = `${viewName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_viewed`;
    CampusAnalytics.trackEvent(eventName, `/${viewName}`, metadata);
  },

  /**
   * Sync active student profile to Supabase to register new user or touch last_active_at.
   */
  syncProfile: (profile: StudentProfile): void => {
    if (!profile || !profile.regNo || profile.regNo === 'Not available' || profile.regNo === 'Sync Required') {
      return;
    }

    (async () => {
      try {
        const base = getApiBase();
        await fetchWithTimeout(`${base}/analytics/profile`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            regNo: profile.regNo,
            name: profile.name,
            email: profile.email,
            program: profile.program,
            branch: profile.branch,
            school: (profile as any).school,
            semester: profile.semester ? String(profile.semester) : undefined,
            batch: profile.batch,
            cgpa: profile.cgpa,
            creditsEarned: profile.creditsEarned,
            rank: profile.rank,
          }),
        }, 10000);
      } catch (err) {
        console.debug('[CampusAnalytics] Profile sync notice (ignored):', err);
      }
    })();
  },

  /**
   * Fetch secure aggregated admin analytics.
   */
  getAdminSummary: async (adminKey?: string): Promise<any> => {
    const base = getApiBase();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    };
    if (adminKey && adminKey.trim()) {
      headers['X-Admin-Key'] = adminKey.trim();
    }

    const res = await fetchWithTimeout(`${base}/analytics/admin/summary`, {
      method: 'GET',
      headers,
    }, 15000);

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Unauthorized: Invalid or missing administrator key.');
      }
      throw new Error(`Admin analytics request failed with status ${res.status}`);
    }

    const payload = await parseSafeJson<{ success: boolean; data: any }>(res);
    return payload.data;
  },
};

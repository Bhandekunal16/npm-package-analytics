/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NPMFullPackageData } from './types';

const WATCH_STATE_KEY = 'npm_analytics_watch_state';
const ALERTS_ENABLED_KEY = 'npm_analytics_alerts_enabled';
const STALE_RELEASE_DAYS = 180;

export interface PackageWatchState {
  deprecated: boolean;
  advisoriesCount: number;
  lastPublish: string;
  riskLevel: string;
  maintenanceStatus: string;
  staleAlerted?: boolean;
}

export function areAlertsEnabled(): boolean {
  return localStorage.getItem(ALERTS_ENABLED_KEY) === 'true';
}

export function setAlertsEnabled(enabled: boolean) {
  localStorage.setItem(ALERTS_ENABLED_KEY, enabled ? 'true' : 'false');
}

export function readWatchState(): Record<string, PackageWatchState> {
  try {
    const raw = localStorage.getItem(WATCH_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeWatchState(state: Record<string, PackageWatchState>) {
  localStorage.setItem(WATCH_STATE_KEY, JSON.stringify(state));
}

export function snapshotPackage(pkg: NPMFullPackageData): PackageWatchState {
  return {
    deprecated: pkg.security.isDeprecated,
    advisoriesCount: pkg.security.advisoriesCount,
    lastPublish: pkg.lastUpdated,
    riskLevel: pkg.repositoryRisk?.level || 'Medium',
    maintenanceStatus: pkg.security.maintenanceStatus,
  };
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function notify(title: string, body: string) {
  if (!areAlertsEnabled() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon: '/icon.svg' });
  } catch {
    // non-fatal
  }
}

export async function checkWatchlistAlerts(
  favorites: string[],
  onSelectPackage?: (name: string) => void,
): Promise<string[]> {
  if (favorites.length === 0) return [];

  const previous = readWatchState();
  const next: Record<string, PackageWatchState> = { ...previous };
  const messages: string[] = [];

  await Promise.all(
    favorites.map(async (name) => {
      try {
        const res = await fetch(`/api/package/${encodeURIComponent(name)}`);
        if (!res.ok) return;
        const pkg: NPMFullPackageData = await res.json();
        const current = snapshotPackage(pkg);
        const prior = previous[name];
        let nextState = { ...current };

        if (prior) {
          if (!prior.deprecated && current.deprecated) {
            const msg = `${name} was deprecated`;
            messages.push(msg);
            notify('Package Deprecated', msg);
          }
          if (current.advisoriesCount > prior.advisoriesCount) {
            const msg = `${name} has new security advisories (${current.advisoriesCount})`;
            messages.push(msg);
            notify('Security Advisory', msg);
          }
          if (prior.lastPublish && current.lastPublish === prior.lastPublish) {
            const days = Math.round(
              (Date.now() - new Date(current.lastPublish).getTime()) / (1000 * 60 * 60 * 24),
            );
            if (days > STALE_RELEASE_DAYS && !prior.staleAlerted) {
              const msg = `${name} has had no release in ${days} days`;
              messages.push(msg);
              notify('Stale Package', msg);
              current.staleAlerted = true;
              nextState.staleAlerted = true;
            }
          }
          if (prior.staleAlerted) {
            nextState.staleAlerted = true;
          }
          if (prior.riskLevel !== 'High' && current.riskLevel === 'High') {
            const msg = `${name} repository risk is now High`;
            messages.push(msg);
            notify('Repository Risk', msg);
          }
        }

        next[name] = nextState;
      } catch {
        // non-fatal
      }
    }),
  );

  writeWatchState(next);
  return messages;
}

export function updateWatchSnapshot(pkg: NPMFullPackageData) {
  const state = readWatchState();
  state[pkg.name] = snapshotPackage(pkg);
  writeWatchState(state);
}

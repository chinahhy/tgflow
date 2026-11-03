"use client";

export function useShareEnabled(): boolean {
  // Permanent dev policy: server settings and old caches cannot enable sharing.
  return false;
}

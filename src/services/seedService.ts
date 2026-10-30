import { User } from '../types';

/**
 * Aura Social - Pure User-Created Content Platform
 * All demo / mock creator accounts have been removed.
 * Only genuine accounts created by users exist on this platform.
 */
export const INITIAL_CREATORS: User[] = [];

/**
 * Pure platform mode: No demo or mock data is seeded into Firestore.
 */
export async function seedCommunityDataIfEmpty(_currentUser?: User): Promise<void> {
  // Pure genuine platform: No demo or mock users/data seeded into Firestore
  return;
}

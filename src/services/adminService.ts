import { httpsCallable } from 'firebase/functions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, functions } from '../firebase/config';

export interface AdminPaymentRow {
  id: string; userId: string; username: string; provider: string; amount: number;
  currency: string; status: string; transactionRef: string; purpose?: string;
  planName?: string | null; createdAt: number; completedAt?: number | null; failureReason?: string | null;
}
export interface SuperAdminOverview {
  generatedAt: number; counts: Record<string, number | null>;
  health: { firestore: boolean; mlModel: boolean; modelVersion: number | null; modelTrainedAt: number | null; flutterwaveConfigured: boolean; mtnMomoConfigured: boolean };
  model: { version?: number; weights?: Record<string, number>; trainedAt?: number; metrics?: Record<string, number>; trainingData?: Record<string, unknown> } | null;
  marketplaceModel: { version?: number; weights?: Record<string, number>; trainedAt?: number; metrics?: Record<string, number>; trainingData?: Record<string, unknown> } | null;
  verificationPayments: AdminPaymentRow[]; subscriptionPayments: AdminPaymentRow[]; pendingCampaigns: Array<{ id: string; sellerId: string; title: string; description: string; budget: number; mediaUrl: string; createdAt: number }>; auditLogs: Array<Record<string, unknown>>;
}
const overviewCall = httpsCallable<void, SuperAdminOverview>(functions, 'getSuperAdminOverview');
const memberCall = httpsCallable<{ targetUserId: string; action: 'suspend' | 'restore' | 'grant_badge' | 'revoke_badge'; reason: string }, { success: boolean }>(functions, 'adminUpdateMember');
const trainCall = httpsCallable<{ epochs: number; reason: string }, Record<string, any>>(functions, 'trainPlatformModels');
const campaignCall = httpsCallable<{ campaignId: string; decision: 'approve' | 'reject'; reason: string }, { success: boolean; status: string }>(functions, 'adminReviewSponsoredCampaign');
const planCall = httpsCallable<{ planId?: string; name: string; amount: number; currency: 'RWF' | 'USD'; durationDays: number; active: boolean; features: string[]; reason: string }, { success: boolean; planId: string }>(functions, 'adminUpsertSubscriptionPlan');
export async function getSuperAdminOverview(): Promise<SuperAdminOverview> { return (await overviewCall()).data; }
export async function updateSuperAdminMember(targetUserId: string, action: 'suspend' | 'restore' | 'grant_badge' | 'revoke_badge', reason: string): Promise<void> { await memberCall({ targetUserId, action, reason }); }
export async function trainPlatformModels(epochs: number, reason: string): Promise<Record<string, any>> { return (await trainCall({ epochs, reason })).data; }
export async function reviewSponsoredCampaign(campaignId: string, decision: 'approve' | 'reject', reason: string): Promise<void> { await campaignCall({ campaignId, decision, reason }); }
export async function saveSubscriptionPlan(input: { planId?: string; name: string; amount: number; currency: 'RWF' | 'USD'; durationDays: number; active: boolean; features: string[]; reason: string }): Promise<{ success: boolean; planId: string }> { return (await planCall(input)).data; }
export interface SubscriptionPlan { id: string; name: string; amount: number; currency: 'RWF' | 'USD'; durationDays: number; active: boolean; features: string[]; billingMode: 'manual_renewal'; }
export async function getActiveSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  const q = query(collection(db, 'subscription_plans'), where('active', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((entry) => ({ id: entry.id, name: String(entry.data().name || 'Membership'), amount: Number(entry.data().amount || 0), currency: (entry.data().currency === 'USD' ? 'USD' : 'RWF') as 'RWF' | 'USD', durationDays: Number(entry.data().durationDays || 30), active: entry.data().active === true, features: Array.isArray(entry.data().features) ? entry.data().features : [], billingMode: 'manual_renewal' as const })).sort((a, b) => a.amount - b.amount);
}

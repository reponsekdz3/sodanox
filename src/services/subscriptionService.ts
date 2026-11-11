import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase/config';
import type { User } from '../types';
import { getActiveSubscriptionPlans } from './adminService';
import type { SubscriptionPlan } from './adminService';
export type { SubscriptionPlan };
export { getActiveSubscriptionPlans };
export interface SubscriptionPaymentRequest { planId: string; provider: 'flutterwave' | 'mtn_momo'; phoneNumber?: string; }
export interface SubscriptionPaymentResult { success: boolean; status: 'pending' | 'completed' | 'failed'; transactionRef: string; provider: 'flutterwave' | 'mtn_momo'; amount: number; currency: string; message: string; timestamp: number; checkoutUrl?: string; }
const createCall = httpsCallable<SubscriptionPaymentRequest, SubscriptionPaymentResult>(functions, 'createSubscriptionPayment');
const verifyCall = httpsCallable<{ transactionRef: string; providerTransactionId?: string }, SubscriptionPaymentResult>(functions, 'verifySubscriptionPayment');
export async function startSubscriptionPayment(user: User, input: SubscriptionPaymentRequest): Promise<SubscriptionPaymentResult> {
  if (!auth.currentUser || auth.currentUser.uid !== user.id) throw new Error('Your Firebase sign-in session is not valid. Sign in again before paying.');
  const response = await createCall(input);
  return response.data;
}
export async function checkSubscriptionPayment(transactionRef: string, providerTransactionId?: string): Promise<SubscriptionPaymentResult> {
  if (!transactionRef) throw new Error('A subscription payment reference is required.');
  const response = await verifyCall({ transactionRef, providerTransactionId });
  return response.data;
}

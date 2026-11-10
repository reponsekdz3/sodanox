import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../firebase/config';
import { User, VerificationPayment } from '../types';

const VERIFICATION_PAYMENTS_COLLECTION = 'verification_payments';
export const VERIFICATION_FEE_RWF = 10000;
export const VERIFICATION_FEE_USD = 10;

export type VerificationPaymentProvider = 'flutterwave' | 'mtn_momo';

export interface PaymentInitiateRequest {
  provider: VerificationPaymentProvider;
  phoneNumber?: string;
  currency?: 'RWF' | 'USD';
}

export interface PaymentResult {
  success: boolean;
  status: 'pending' | 'completed' | 'failed';
  transactionRef: string;
  provider: VerificationPaymentProvider;
  amount: number;
  currency: string;
  message: string;
  timestamp: number;
  checkoutUrl?: string;
}

/**
 * Starts a gateway payment through an authenticated server function.
 * Card details are never collected or stored by the browser.
 */
export async function processVerifiedBadgePayment(
  user: User,
  paymentDetails: PaymentInitiateRequest
): Promise<PaymentResult> {
  if (!auth.currentUser || auth.currentUser.uid !== user.id) {
    throw new Error('Your sign-in session is not valid. Please sign in again.');
  }
  if (paymentDetails.provider === 'mtn_momo' && paymentDetails.currency === 'USD') {
    throw new Error('MTN Mobile Money verification payments are charged in RWF.');
  }
  const initiate = httpsCallable<PaymentInitiateRequest, PaymentResult>(functions, 'createVerifiedBadgePayment');
  const response = await initiate(paymentDetails);
  return response.data;
}

/**
 * Requests a server-side status check. The server verifies directly with MTN or Flutterwave
 * and is the only component permitted to activate the verified badge.
 */
export async function verifyVerifiedBadgePayment(
  transactionRef: string,
  providerTransactionId?: string
): Promise<PaymentResult> {
  if (!transactionRef) throw new Error('A payment reference is required.');
  const verify = httpsCallable<{ transactionRef: string; providerTransactionId?: string }, PaymentResult>(
    functions, 'verifyVerifiedBadgePayment'
  );
  const response = await verify({ transactionRef, providerTransactionId });
  return response.data;
}

/** Super Administrator: fetch the server-written payment audit ledger. */
export async function getAllVerificationPayments(): Promise<VerificationPayment[]> {
  const paymentsQuery = query(collection(db, VERIFICATION_PAYMENTS_COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(paymentsQuery);
  return snapshot.docs.map((payment) => ({ id: payment.id, ...payment.data() } as VerificationPayment));
}

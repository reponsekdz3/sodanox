import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const FLW_SECRET_KEY = defineSecret('FLW_SECRET_KEY');
const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_API_KEY_SID = defineSecret('TWILIO_API_KEY_SID');
const TWILIO_API_KEY_SECRET = defineSecret('TWILIO_API_KEY_SECRET');
const FLW_WEBHOOK_SECRET = defineSecret('FLW_WEBHOOK_SECRET');
const MTN_MOMO_API_USER = defineSecret('MTN_MOMO_API_USER');
const MTN_MOMO_API_KEY = defineSecret('MTN_MOMO_API_KEY');
const MTN_COLLECTION_SUBSCRIPTION_KEY = defineSecret('MTN_COLLECTION_SUBSCRIPTION_KEY');
const FIRESTORE_DATABASE_ID = defineString('FIRESTORE_DATABASE_ID', {
  default: 'ai-studio-sodanox-8033aa10-6107-409a-81d3-5e9adf7a7df5',
});
const MTN_API_BASE_URL = defineString('MTN_API_BASE_URL', { default: 'https://sandbox.momodeveloper.mtn.com' });
const MTN_TARGET_ENVIRONMENT = defineString('MTN_TARGET_ENVIRONMENT', { default: 'sandbox' });
const APP_BASE_URL = defineString('APP_BASE_URL', { default: 'https://ducate.ai.studio' });

type Provider = 'flutterwave' | 'mtn_momo';
type PaymentStatus = 'pending' | 'completed' | 'failed';
interface PaymentRecord {
  userId: string;
  username: string;
  userEmail: string;
  provider: Provider;
  amount: number;
  currency: 'RWF' | 'USD';
  status: PaymentStatus;
  transactionRef: string;
  providerReference?: string;
  checkoutUrl?: string;
  createdAt: number;
  completedAt?: number;
  failureReason?: string;
  providerTransactionId?: string;
  purpose?: 'verified_badge' | 'subscription';
  planId?: string;
  planName?: string;
  durationDays?: number;
}

const adminApp = getApps().length ? getApp() : initializeApp();
function database() {
  const id = FIRESTORE_DATABASE_ID.value().trim();
  return id && id !== '(default)' ? getFirestore(adminApp, id) : getFirestore(adminApp);
}

function requireAuth(uid?: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to start a verification payment.');
  return uid;
}

function toResult(record: PaymentRecord, message?: string) {
  return {
    success: record.status === 'completed',
    status: record.status,
    transactionRef: record.transactionRef,
    provider: record.provider,
    amount: record.amount,
    currency: record.currency,
    timestamp: record.createdAt,
    checkoutUrl: record.checkoutUrl,
    message: message || (record.status === 'completed'
      ? 'The payment provider confirmed your payment. Your paid profile badge is active.'
      : record.status === 'failed'
        ? 'The payment provider could not confirm this payment.'
        : record.provider === 'mtn_momo'
          ? 'A payment request was sent. Approve it in your MTN MoMo prompt; never share your PIN.'
          : 'Complete the secure Flutterwave checkout. Your badge will activate after server verification.'),
  };
}

async function responseJson(response: Response): Promise<any> {
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof payload?.message === 'string' ? payload.message : 'The payment provider returned an error.';
    throw new Error(detail);
  }
  return payload;
}

function normalizeRwandaMtnNumber(value: unknown): string {
  const digits = String(value || '').replace(/\D/g, '');
  const msisdn = digits.startsWith('250') ? digits : digits.startsWith('0') ? '250' + digits.slice(1) : '250' + digits;
  if (!/^250(78|79)\d{7}$/.test(msisdn)) {
    throw new HttpsError('invalid-argument', 'Enter a valid MTN Rwanda number, for example 0781234567.');
  }
  return msisdn;
}

async function getMtnAccessToken(): Promise<string> {
  const apiUser = MTN_MOMO_API_USER.value();
  const apiKey = MTN_MOMO_API_KEY.value();
  const subscriptionKey = MTN_COLLECTION_SUBSCRIPTION_KEY.value();
  if (!apiUser || !apiKey || !subscriptionKey) {
    throw new HttpsError('failed-precondition', 'MTN MoMo is not configured on the server yet.');
  }
  const base = MTN_API_BASE_URL.value().replace(/\/+$/, '');
  const response = await fetch(base + '/collection/token/', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(apiUser + ':' + apiKey).toString('base64'),
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    signal: AbortSignal.timeout(20000),
  });
  const payload = await responseJson(response);
  if (!payload.access_token) throw new Error('MTN MoMo did not return an access token.');
  return String(payload.access_token);
}

async function startMtnPayment(record: PaymentRecord, phoneNumber: unknown): Promise<string> {
  const msisdn = normalizeRwandaMtnNumber(phoneNumber);
  const token = await getMtnAccessToken();
  const referenceId = randomUUID();
  const base = MTN_API_BASE_URL.value().replace(/\/+$/, '');
  const response = await fetch(base + '/collection/v1_0/requesttopay', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Reference-Id': referenceId,
      'X-Target-Environment': MTN_TARGET_ENVIRONMENT.value(),
      'Ocp-Apim-Subscription-Key': MTN_COLLECTION_SUBSCRIPTION_KEY.value(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(record.amount),
      currency: record.currency,
      externalId: record.transactionRef,
      payer: { partyIdType: 'MSISDN', partyId: msisdn },
      payerMessage: 'Sodanox verified badge',
      payeeNote: 'Sodanox verified badge',
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (response.status !== 202 && !response.ok) await responseJson(response);
  return referenceId;
}

async function startFlutterwavePayment(record: PaymentRecord, email: string, name: string, origin: string, purpose: 'verified_badge' | 'subscription' = 'verified_badge'): Promise<string> {
  const secret = FLW_SECRET_KEY.value();
  if (!secret) throw new HttpsError('failed-precondition', 'Flutterwave is not configured on the server yet.');
  let appOrigin: URL;
  try { appOrigin = new URL(origin); } catch { throw new HttpsError('failed-precondition', 'A valid application origin is required for secure checkout.'); }
  if (appOrigin.protocol !== 'https:' && appOrigin.hostname !== 'localhost' && appOrigin.hostname !== '127.0.0.1') {
    throw new HttpsError('failed-precondition', 'The checkout return URL must use HTTPS.');
  }
  const redirect = new URL(appOrigin.origin + '/');
  redirect.searchParams.set(purpose === 'subscription' ? 'subscription_ref' : 'verification_ref', record.transactionRef);
  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      tx_ref: record.transactionRef,
      amount: record.amount,
      currency: record.currency,
      redirect_url: redirect.toString(),
      customer: { email, name },
      payment_options: record.currency === 'RWF' ? 'card,mobilemoneyrwanda' : 'card',
      customizations: {
        title: purpose === 'subscription' ? 'Sodanox Membership' : 'Sodanox Verified Badge',
        description: purpose === 'subscription' ? (record.planName || 'Sodanox membership plan') : 'One-time paid profile badge',
      },
      meta: { userId: record.userId, purpose, planId: record.planId || null },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const payload = await responseJson(response);
  const link = payload?.data?.link;
  if (payload?.status !== 'success' || typeof link !== 'string' || !link.startsWith('https://')) {
    throw new Error('Flutterwave did not return a valid hosted checkout link.');
  }
  return link;
}

export const createVerifiedBadgePayment = onCall(
  {
    secrets: [FLW_SECRET_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY],
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const provider = request.data?.provider as Provider;
    if (provider !== 'flutterwave' && provider !== 'mtn_momo') {
      throw new HttpsError('invalid-argument', 'Choose Flutterwave or MTN MoMo.');
    }
    const currency = provider === 'mtn_momo' ? 'RWF' : (request.data?.currency === 'USD' ? 'USD' : 'RWF');
    const amount = currency === 'USD' ? 10 : 10000;
    const db = database();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Your profile must be created before you can request a badge.');
    const profile = userSnap.data() || {};
    const claims = (request.auth?.token || {}) as Record<string, unknown>;
    const email = String(profile.email || claims.email || '');
    const displayName = String(profile.name || claims.name || profile.username || 'Sodanox member');
    const username = String(profile.username || '');
    if (provider === 'flutterwave' && !email) {
      throw new HttpsError('failed-precondition', 'Add a valid email address to your account before using Flutterwave checkout.');
    }
    const transactionRef = 'SODANOX_VER_' + Date.now() + '_' + randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    const record: PaymentRecord = {
      userId: uid, username, userEmail: email, provider, amount, currency,
      status: 'pending', transactionRef, createdAt: Date.now(),
    };
    const paymentRef = db.collection('verification_payments').doc(transactionRef);
    await paymentRef.create(record);
    try {
      if (provider === 'mtn_momo') {
        const providerReference = await startMtnPayment(record, request.data?.phoneNumber);
        await paymentRef.update({ providerReference });
        return toResult({ ...record, providerReference });
      }
      const checkoutUrl = await startFlutterwavePayment(record, email, displayName, APP_BASE_URL.value());
      await paymentRef.update({ checkoutUrl });
      return toResult({ ...record, checkoutUrl }, 'Continue on the secure Flutterwave checkout page. The badge will activate only after the server verifies the transaction.');
    } catch (error) {
      await paymentRef.update({ status: 'failed', failureReason: error instanceof Error ? error.message.slice(0, 300) : 'Provider request failed' });
      logger.error('Could not initiate verified badge payment', { uid, provider, transactionRef, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', error instanceof Error ? error.message : 'The payment provider could not start the transaction.');
    }
  }
);

export const verifyVerifiedBadgePayment = onCall(
  {
    secrets: [FLW_SECRET_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY],
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const transactionRef = String(request.data?.transactionRef || '');
    const requestedProviderTransactionId = String(request.data?.providerTransactionId || '');
    if (!/^SODANOX_VER_[A-Z0-9_]+$/.test(transactionRef)) {
      throw new HttpsError('invalid-argument', 'The payment reference is invalid.');
    }
    const db = database();
    const paymentRef = db.collection('verification_payments').doc(transactionRef);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) throw new HttpsError('not-found', 'The payment could not be found.');
    const record = paymentSnap.data() as PaymentRecord;
    if (record.userId !== uid) throw new HttpsError('permission-denied', 'You cannot verify another member’s payment.');
    if (record.status === 'completed' || record.status === 'failed') return toResult(record);
    const providerTransactionId = requestedProviderTransactionId || String(record.providerTransactionId || '');

    let isPaid = false;
    let isFailed = false;
    let providerNote = 'The payment is still pending with the provider.';
    try {
      if (record.provider === 'flutterwave') {
        if (!providerTransactionId || !/^\d+$/.test(providerTransactionId)) {
          return toResult(record, 'Complete Flutterwave checkout. Your payment will be confirmed when the gateway returns its transaction ID.');
        }
        const secret = FLW_SECRET_KEY.value();
        if (!secret) throw new HttpsError('failed-precondition', 'Flutterwave is not configured on the server yet.');
        const response = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(providerTransactionId) + '/verify', {
          headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
          signal: AbortSignal.timeout(20000),
        });
        const payload = await responseJson(response);
        const data = payload?.data || {};
        const validReference = data.tx_ref === transactionRef;
        const validAmount = Number(data.amount) >= record.amount;
        const validCurrency = String(data.currency || '').toUpperCase() === record.currency;
        isPaid = payload?.status === 'success' && data.status === 'successful' && validReference && validAmount && validCurrency;
        isFailed = data.status === 'failed' || data.status === 'cancelled';
        providerNote = isPaid ? 'Flutterwave confirmed the transaction.' : isFailed ? 'Flutterwave marked the transaction as failed.' : 'Flutterwave has not confirmed the transaction yet.';
        if (data.tx_ref && !validReference) throw new HttpsError('permission-denied', 'The provider transaction reference does not match this payment.');
        if (data.status === 'successful' && (!validAmount || !validCurrency)) throw new HttpsError('failed-precondition', 'The provider amount or currency does not match the verification fee.');
      } else if (record.provider === 'mtn_momo') {
        if (!record.providerReference) throw new HttpsError('failed-precondition', 'The MTN provider reference is missing.');
        const token = await getMtnAccessToken();
        const base = MTN_API_BASE_URL.value().replace(/\/+$/, '');
        const response = await fetch(base + '/collection/v1_0/requesttopay/' + encodeURIComponent(record.providerReference), {
          headers: {
            Authorization: 'Bearer ' + token,
            'X-Target-Environment': MTN_TARGET_ENVIRONMENT.value(),
            'Ocp-Apim-Subscription-Key': MTN_COLLECTION_SUBSCRIPTION_KEY.value(),
          },
          signal: AbortSignal.timeout(20000),
        });
        const data = await responseJson(response);
        const validReference = data.externalId === transactionRef;
        const validAmount = Number(data.amount) >= record.amount;
        const validCurrency = String(data.currency || '').toUpperCase() === record.currency;
        isPaid = data.status === 'SUCCESSFUL' && validReference && validAmount && validCurrency;
        isFailed = ['FAILED', 'REJECTED', 'EXPIRED'].includes(String(data.status || '').toUpperCase());
        providerNote = isPaid ? 'MTN MoMo confirmed the request-to-pay transaction.' : isFailed ? 'MTN MoMo declined or failed the request.' : 'Waiting for the MTN MoMo approval and settlement status.';
        if (data.status === 'SUCCESSFUL' && (!validReference || !validAmount || !validCurrency)) {
          throw new HttpsError('failed-precondition', 'The MTN transaction reference, amount or currency does not match this payment.');
        }
        if (data.status === 'SUCCESSFUL' && (!validAmount || !validCurrency)) throw new HttpsError('failed-precondition', 'The MTN amount or currency does not match this payment.');
      }
    } catch (error) {
      logger.error('Payment provider verification request failed', { uid, transactionRef, provider: record.provider, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'Could not reach the payment provider to verify the transaction. Try again.');
    }

    if (isFailed) {
      await paymentRef.update({ status: 'failed', failureReason: providerNote });
      return toResult({ ...record, status: 'failed' }, providerNote);
    }
    if (!isPaid) return toResult(record, providerNote);

    const userRef = db.collection('users').doc(uid);
    await db.runTransaction(async (transaction) => {
      const latestPayment = await transaction.get(paymentRef);
      if (!latestPayment.exists || latestPayment.data()?.userId !== uid) {
        throw new HttpsError('permission-denied', 'The payment record is no longer valid.');
      }
      if (latestPayment.data()?.status === 'completed') return;
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Your profile could not be found.');
      transaction.update(userRef, {
        verified: true,
        verifiedBadgeType: 'blue',
        verifiedSince: userSnap.data()?.verifiedSince || Date.now(),
      });
      transaction.update(paymentRef, { status: 'completed', completedAt: Date.now(), failureReason: null });
    });
    const refreshed = await paymentRef.get();
    return toResult(refreshed.data() as PaymentRecord, 'The payment provider confirmed your payment. Your paid profile badge is active.');
  }
);

function safeSecretMatch(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  const supplied = Buffer.from(received, 'utf8');
  const configured = Buffer.from(expected, 'utf8');
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

/**
 * Story interactions are written through trusted server code. This keeps the
 * Firestore story document from accepting arbitrary client edits to another
 * member's items while preserving likes, polls and question stickers.
 */
export const updateStoryInteraction = onCall(
  { timeoutSeconds: 30 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const storyId = String(request.data?.storyId || '');
    const itemIndex = Number(request.data?.itemIndex);
    const action = String(request.data?.action || '');
    if (!storyId || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex > 99) {
      throw new HttpsError('invalid-argument', 'A valid story and item are required.');
    }
    if (!['like', 'vote_poll', 'answer_question'].includes(action)) {
      throw new HttpsError('invalid-argument', 'This story interaction is not supported.');
    }

    const db = database();
    const storyRef = db.collection('stories').doc(storyId);
    const userRef = db.collection('users').doc(uid);
    let result: Record<string, unknown> = {};

    await db.runTransaction(async (transaction) => {
      const storySnapshot = await transaction.get(storyRef);
      if (!storySnapshot.exists) throw new HttpsError('not-found', 'This story no longer exists.');
      const story = storySnapshot.data() || {};
      const items: any[] = Array.isArray(story.items) ? [...story.items] : [];
      if (!items[itemIndex]) throw new HttpsError('not-found', 'This story item could not be found.');
      const item = { ...items[itemIndex] };

      if (action === 'like') {
        const likedBy: string[] = Array.isArray(item.likedBy) ? [...item.likedBy] : [];
        const alreadyLiked = likedBy.includes(uid);
        const nextLikedBy = alreadyLiked ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];
        item.likedBy = nextLikedBy;
        item.likesCount = nextLikedBy.length;
        result = { liked: !alreadyLiked, authorId: String(story.userId || '') };
      } else {
        const stickers: any[] = Array.isArray(item.stickers) ? [...item.stickers] : [];
        const stickerType = action === 'vote_poll' ? 'poll' : 'question';
        const stickerIndex = stickers.findIndex((sticker) => sticker?.type === stickerType);
        if (stickerIndex < 0) throw new HttpsError('failed-precondition', 'This story does not contain that sticker.');
        const sticker = { ...stickers[stickerIndex] };
        const stickerData = { ...(sticker.data || {}) };

        if (action === 'vote_poll') {
          const optionId = String(request.data?.optionId || '');
          const options: any[] = Array.isArray(stickerData.options) ? [...stickerData.options] : [];
          if (!options.some((option) => option?.id === optionId)) {
            throw new HttpsError('invalid-argument', 'Choose one of the available poll options.');
          }
          const userVotes: Record<string, string> = { ...(stickerData.userVotes || {}) };
          if (userVotes[uid] === optionId) {
            result = { voted: false };
            return;
          }
          userVotes[uid] = optionId;
          stickerData.userVotes = userVotes;
          stickerData.options = options.map((option) => ({
            ...option,
            votes: Object.values(userVotes).filter((vote) => vote === option.id).length,
          }));
          result = { voted: true };
        } else {
          const answer = String(request.data?.answer || '').trim();
          if (!answer || answer.length > 500) {
            throw new HttpsError('invalid-argument', 'Your answer must contain between 1 and 500 characters.');
          }
          const userSnapshot = await transaction.get(userRef);
          const profile = userSnapshot.data() || {};
          const answers: any[] = Array.isArray(stickerData.answers) ? [...stickerData.answers] : [];
          if (answers.length >= 500) throw new HttpsError('resource-exhausted', 'This question has reached its answer limit.');
          answers.push({
            userId: uid,
            userName: String(profile.name || profile.username || 'Sodanox member'),
            userAvatar: String(profile.avatar || ''),
            answer,
            timestamp: Date.now(),
          });
          stickerData.answers = answers;
          result = { answered: true };
        }

        sticker.data = stickerData;
        stickers[stickerIndex] = sticker;
        item.stickers = stickers;
      }

      items[itemIndex] = item;
      transaction.update(storyRef, { items, updatedAt: Date.now() });
    });

    return result;
  }
);

/**
 * Flutterwave v3 webhook. The shared webhook hash authenticates the sender;
 * the transaction is then re-queried with the private API key before any
 * payment status or verified profile field is updated.
 */
export const flutterwaveVerificationWebhook = onRequest(
  {
    secrets: [FLW_SECRET_KEY, FLW_WEBHOOK_SECRET],
    timeoutSeconds: 60,
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('method not allowed');
      return;
    }

    const signature = String(request.get('verif-hash') || '');
    if (!safeSecretMatch(signature, FLW_WEBHOOK_SECRET.value())) {
      response.status(401).send('unauthorized');
      return;
    }

    const webhookData = request.body?.data;
    const transactionRef = String(webhookData?.tx_ref || '');
    const providerTransactionId = String(webhookData?.id || '');
    if (!/^\d+$/.test(providerTransactionId)) {
      response.status(200).send('ignored');
      return;
    }

    // A single Flutterwave webhook endpoint handles both verified-badge and
    // membership references; provider callbacks are re-verified server-side.
    if (/^SODANOX_SUB_[A-Z0-9_]+$/.test(transactionRef)) {
      const db = database();
      const paymentRef = db.collection('subscription_payments').doc(transactionRef);
      try {
        const snapshot = await paymentRef.get();
        if (!snapshot.exists) { response.status(200).send('unknown membership payment'); return; }
        const record = snapshot.data() as PaymentRecord;
        if (record.provider !== 'flutterwave' || record.status === 'completed' || record.status === 'failed') {
          response.status(200).send('already handled');
          return;
        }
        const outcome = await verifySubscriptionWithProvider(record, providerTransactionId);
        if (outcome.failed) {
          await paymentRef.update({ status: 'failed', failureReason: outcome.note, providerTransactionId });
          response.status(200).send('membership payment failed');
          return;
        }
        if (!outcome.paid) { response.status(200).send('membership payment not confirmed'); return; }
        await activateSubscription(db, paymentRef, record, providerTransactionId);
        response.status(200).send('membership activated');
      } catch (error) {
        logger.error('Flutterwave membership webhook failed', { transactionRef, providerTransactionId, error });
        response.status(500).send('temporary processing error');
      }
      return;
    }

    if (!/^SODANOX_VER_[A-Z0-9_]+$/.test(transactionRef)) {
      response.status(200).send('ignored');
      return;
    }

    const db = database();
    const paymentRef = db.collection('verification_payments').doc(transactionRef);
    try {
      const paymentSnapshot = await paymentRef.get();
      if (!paymentSnapshot.exists) {
        response.status(200).send('unknown payment');
        return;
      }
      const record = paymentSnapshot.data() as PaymentRecord;
      if (record.provider !== 'flutterwave' || record.status === 'completed' || record.status === 'failed') {
        response.status(200).send('already handled');
        return;
      }

      const verifyResponse = await fetch(
        'https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(providerTransactionId) + '/verify',
        {
          headers: { Authorization: 'Bearer ' + FLW_SECRET_KEY.value(), Accept: 'application/json' },
          signal: AbortSignal.timeout(20000),
        }
      );
      const payload = await responseJson(verifyResponse);
      const transactionData = payload?.data || {};
      const paid = payload?.status === 'success'
        && transactionData.status === 'successful'
        && transactionData.tx_ref === record.transactionRef
        && Number(transactionData.amount) >= record.amount
        && String(transactionData.currency || '').toUpperCase() === record.currency;

      if (transactionData.status === 'failed' || transactionData.status === 'cancelled') {
        await paymentRef.update({
          status: 'failed',
          failureReason: 'Flutterwave reported a failed or cancelled transaction.',
          providerTransactionId,
        });
        response.status(200).send('payment failed');
        return;
      }
      if (!paid) {
        logger.warn('Flutterwave webhook did not match expected payment data', { transactionRef, providerTransactionId });
        response.status(200).send('not confirmed');
        return;
      }

      const userRef = db.collection('users').doc(record.userId);
      await db.runTransaction(async (transaction) => {
        const latestPayment = await transaction.get(paymentRef);
        if (!latestPayment.exists || latestPayment.data()?.userId !== record.userId) {
          throw new Error('The payment record is no longer valid.');
        }
        if (latestPayment.data()?.status === 'completed') return;
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new Error('The profile for this payment could not be found.');
        transaction.update(userRef, {
          verified: true,
          verifiedBadgeType: 'blue',
          verifiedSince: userSnapshot.data()?.verifiedSince || Date.now(),
        });
        transaction.update(paymentRef, {
          status: 'completed',
          providerTransactionId,
          completedAt: Date.now(),
          failureReason: null,
        });
      });
      response.status(200).send('payment confirmed');
    } catch (error) {
      logger.error('Flutterwave verification webhook failed', { transactionRef, providerTransactionId, error });
      response.status(500).send('temporary processing error');
    }
  }
);
/**
 * Authenticated short-lived ICE credentials for real WebRTC calls.
 * Twilio's Network Traversal Service returns ephemeral STUN/TURN credentials;
 * the Twilio account key/secret never reach the browser.
 */
export const getCallIceConfig = onCall(
  {
    secrets: [TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET],
    timeoutSeconds: 30,
  },
  async (request) => {
    requireAuth(request.auth?.uid);
    const stunOnly = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      relayAvailable: false,
      expiresInSeconds: 0,
      note: 'TURN relay credentials are not configured. Direct peer connections may work, but restrictive carrier and corporate networks may require TURN.',
    };

    const accountSid = TWILIO_ACCOUNT_SID.value();
    const apiKeySid = TWILIO_API_KEY_SID.value();
    const apiKeySecret = TWILIO_API_KEY_SECRET.value();
    if (!accountSid || !apiKeySid || !apiKeySecret) return stunOnly;

    try {
      const tokenUrl = 'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(accountSid) + '/Tokens.json';
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + Buffer.from(apiKeySid + ':' + apiKeySecret).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ Ttl: '3600' }).toString(),
        signal: AbortSignal.timeout(20000),
      });
      const payload: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        logger.error('Twilio Network Traversal token request failed', {
          status: response.status,
          detail: String(payload?.message || '').slice(0, 200),
        });
        return {
          ...stunOnly,
          note: 'The TURN credential provider is temporarily unavailable. Direct STUN connectivity is being attempted.',
        };
      }
      const iceServers = Array.isArray(payload.ice_servers)
        ? payload.ice_servers.filter((server: any) =>
            server && server.urls && (
              typeof server.urls === 'string' ||
              (Array.isArray(server.urls) && server.urls.length > 0)
            )
          )
        : [];
      const relayAvailable = iceServers.some((server: any) => {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        return urls.some((url: string) => url.startsWith('turn:') || url.startsWith('turns:'));
      });
      if (!iceServers.length || !relayAvailable) {
        logger.warn('Twilio returned no TURN relay entries for the call ICE configuration.');
        return stunOnly;
      }
      return {
        iceServers,
        relayAvailable: true,
        expiresInSeconds: Number(payload.ttl || 3600),
      };
    } catch (error) {
      logger.error('Unable to create ephemeral TURN credentials', error);
      return {
        ...stunOnly,
        note: 'The TURN credential provider could not be reached. Direct STUN connectivity is being attempted.',
      };
    }
  }
);
/** Authenticated, idempotent server-side sponsored placement accounting. */
export const recordSponsoredAdEvent = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const adId = String(request.data?.adId || '');
  const eventType = request.data?.eventType;
  const eventId = String(request.data?.eventId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(adId)) {
    throw new HttpsError('invalid-argument', 'A valid campaign ID is required.');
  }
  if (eventType !== 'impression' && eventType !== 'click') {
    throw new HttpsError('invalid-argument', 'Unsupported sponsored campaign event.');
  }
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(eventId)) {
    throw new HttpsError('invalid-argument', 'A unique event ID is required.');
  }
  const db = database();
  const adRef = db.collection('sponsored_ads').doc(adId);
  const eventRef = adRef.collection('events').doc(eventType + '_' + eventId);
  return db.runTransaction(async (transaction) => {
    const [adSnapshot, eventSnapshot] = await Promise.all([
      transaction.get(adRef),
      transaction.get(eventRef),
    ]);
    if (!adSnapshot.exists) throw new HttpsError('not-found', 'The sponsored campaign could not be found.');
    if (eventSnapshot.exists) return { recorded: false, duplicate: true };
    const campaign = adSnapshot.data() || {};
    if (campaign.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Only an approved active campaign can receive delivery events.');
    }
    if (campaign.sellerId === uid && eventType === 'impression') {
      // Self-impressions are ignored for billing/accounting integrity.
      return { recorded: false, duplicate: false, ignored: true };
    }
    const metric = eventType === 'impression' ? 'impressions' : 'clicks';
    transaction.update(adRef, { [metric]: FieldValue.increment(1), updatedAt: Date.now() });
    transaction.create(eventRef, {
      eventType,
      eventId,
      actorId: uid,
      recordedAt: FieldValue.serverTimestamp(),
    });
    return { recorded: true, duplicate: false };
  });
});
/** Vote once in a post poll; all counts and voter state are committed atomically. */
export const voteInPostPoll = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const postId = String(request.data?.postId || '');
  const optionId = String(request.data?.optionId || '');
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(postId) || !optionId || optionId.length > 120) {
    throw new HttpsError('invalid-argument', 'A valid post and poll option are required.');
  }
  const db = database();
  const postRef = db.collection('posts').doc(postId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(postRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'This post no longer exists.');
    const post = snapshot.data() || {};
    const poll = post.poll;
    if (!poll || !Array.isArray(poll.options)) throw new HttpsError('failed-precondition', 'This post does not contain an active poll.');
    const voters = poll.voters || {};
    if (voters[uid]) throw new HttpsError('already-exists', 'You have already voted in this poll.');
    let optionFound = false;
    const options = poll.options.map((option: any) => {
      if (option.id !== optionId) return option;
      optionFound = true;
      return { ...option, votes: Number(option.votes || 0) + 1 };
    });
    if (!optionFound) throw new HttpsError('not-found', 'This poll option is no longer available.');
    const nextPoll = {
      ...poll,
      options,
      totalVotes: Number(poll.totalVotes || 0) + 1,
      voters: { ...voters, [uid]: optionId },
    };
    transaction.update(postRef, { poll: nextPoll });
    return { success: true, totalVotes: nextPoll.totalVotes, optionId };
  });
});

/** Server-authoritative comment operations for posts and reels. */
export const updateContentComment = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const collectionName = request.data?.collectionName;
  const action = request.data?.action;
  const contentId = String(request.data?.contentId || '');
  const commentId = String(request.data?.commentId || '');
  const replyId = request.data?.replyId ? String(request.data.replyId) : undefined;
  const content = String(request.data?.content || '').trim();
  if (collectionName !== 'posts' && collectionName !== 'reels') {
    throw new HttpsError('invalid-argument', 'Unsupported content type.');
  }
  if (!['add', 'reply', 'toggle_like', 'delete'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Unsupported comment operation.');
  }
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(contentId)) throw new HttpsError('invalid-argument', 'A valid content ID is required.');
  if ((action === 'add' || action === 'reply') && (!content || content.length > 2000)) {
    throw new HttpsError('invalid-argument', 'Comments must be between 1 and 2,000 characters.');
  }
  if ((action === 'reply' || action === 'toggle_like' || action === 'delete') && !commentId) {
    throw new HttpsError('invalid-argument', 'A valid comment ID is required.');
  }
  const db = database();
  const contentRef = db.collection(collectionName).doc(contentId);
  const userRef = db.collection('users').doc(uid);
  return db.runTransaction(async (transaction) => {
    const [contentSnapshot, userSnapshot] = await Promise.all([
      transaction.get(contentRef),
      transaction.get(userRef),
    ]);
    if (!contentSnapshot.exists) throw new HttpsError('not-found', 'This content no longer exists.');
    if (!userSnapshot.exists) throw new HttpsError('failed-precondition', 'Your member profile is not ready.');
    const record = contentSnapshot.data() || {};
    const user = userSnapshot.data() || {};
    if (collectionName === 'posts' && record.commentsDisabled && (action === 'add' || action === 'reply')) {
      throw new HttpsError('permission-denied', 'Comments are disabled for this post.');
    }
    const comments: any[] = Array.isArray(record.comments) ? [...record.comments] : [];
    const actor = {
      id: uid, name: String(user.name || 'Member'), username: String(user.username || ''),
      avatar: String(user.avatar || ''), verified: Boolean(user.verified),
    };
    let resultId = commentId;
    if (action === 'add') {
      resultId = randomUUID();
      comments.push({
        id: resultId, author: actor, content, timestamp: new Date().toISOString(),
        likesCount: 0, likedBy: [], replies: [],
      });
      transaction.update(contentRef, { comments, commentsCount: Number(record.commentsCount || 0) + 1 });
      return { success: true, commentId: resultId };
    }
    if (action === 'reply') {
      const parentIndex = comments.findIndex((comment) => comment.id === commentId);
      if (parentIndex < 0) throw new HttpsError('not-found', 'The comment you are replying to no longer exists.');
      const reply = {
        id: randomUUID(), author: actor, content, timestamp: new Date().toISOString(),
        likesCount: 0, likedBy: [], replies: [],
      };
      comments[parentIndex] = { ...comments[parentIndex], replies: [...(comments[parentIndex].replies || []), reply] };
      transaction.update(contentRef, { comments });
      return { success: true, commentId: reply.id };
    }
    let found = false;
    if (action === 'toggle_like') {
      const toggle = (item: any) => {
        found = true;
        const likedBy: string[] = Array.isArray(item.likedBy) ? item.likedBy : [];
        const next = likedBy.includes(uid) ? likedBy.filter((id) => id !== uid) : [...likedBy, uid];
        return { ...item, likedBy: next, likesCount: next.length };
      };
      const updated = comments.map((comment) => {
        if (comment.id === commentId) return toggle(comment);
        if (Array.isArray(comment.replies)) {
          return { ...comment, replies: comment.replies.map((reply: any) => reply.id === commentId ? toggle(reply) : reply) };
        }
        return comment;
      });
      if (!found) throw new HttpsError('not-found', 'This comment no longer exists.');
      transaction.update(contentRef, { comments: updated });
      return { success: true, commentId };
    }
    const postAuthorId = record.authorId || record.author?.id;
    let removed = false;
    const updated = replyId
      ? comments.map((comment) => {
          if (comment.id !== commentId || !Array.isArray(comment.replies)) return comment;
          const replies = comment.replies.filter((reply: any) => {
            if (reply.id !== replyId) return true;
            if (reply.author?.id !== uid && postAuthorId !== uid) {
              throw new HttpsError('permission-denied', 'You can only delete your own comment or reply.');
            }
            removed = true;
            return false;
          });
          return { ...comment, replies };
        })
      : comments.filter((comment) => {
          if (comment.id !== commentId) return true;
          if (comment.author?.id !== uid && postAuthorId !== uid) {
            throw new HttpsError('permission-denied', 'You can only delete your own comment or reply.');
          }
          removed = true;
          return false;
        });
    if (!removed) throw new HttpsError('not-found', 'This comment no longer exists.');
    transaction.update(contentRef, {
      comments: updated,
      ...(replyId ? {} : { commentsCount: Math.max(0, Number(record.commentsCount || 0) - 1) }),
    });
    return { success: true, commentId };
  });
});
/** Count one unique share per member for posts and reels. */
export const recordContentShare = onCall(async (request) => {
  const uid = requireAuth(request.auth?.uid);
  const collectionName = request.data?.collectionName;
  const contentId = String(request.data?.contentId || '');
  if (collectionName !== 'posts' && collectionName !== 'reels') {
    throw new HttpsError('invalid-argument', 'Unsupported content type.');
  }
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(contentId)) {
    throw new HttpsError('invalid-argument', 'A valid content ID is required.');
  }
  const ref = database().collection(collectionName).doc(contentId);
  return database().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'This content no longer exists.');
    const data = snapshot.data() || {};
    const sharedBy: string[] = Array.isArray(data.sharedBy) ? data.sharedBy : [];
    if (sharedBy.includes(uid)) return { success: true, recorded: false, sharesCount: Number(data.sharesCount || sharedBy.length) };
    const next = [...sharedBy, uid];
    transaction.update(ref, { sharedBy: next, sharesCount: next.length });
    return { success: true, recorded: true, sharesCount: next.length };
  });
});


/** Privileged operations require a Firebase custom claim set out-of-band. */
function requireSuperAdmin(request: any): string {
  const uid = requireAuth(request.auth?.uid);
  if (request.auth?.token?.superAdmin !== true) {
    throw new HttpsError('permission-denied', 'This operation requires the super-admin custom claim.');
  }
  return uid;
}

function safeAdminReason(value: unknown): string {
  const reason = String(value || '').trim();
  if (reason.length < 8 || reason.length > 500) {
    throw new HttpsError('invalid-argument', 'Provide an audit reason between 8 and 500 characters.');
  }
  return reason;
}

async function writeAdminAudit(
  db: ReturnType<typeof database>,
  actorId: string,
  action: string,
  targetId: string,
  reason: string,
  metadata: Record<string, unknown> = {},
) {
  await db.collection('admin_audit_logs').add({
    actorId, action, targetId, reason, metadata,
    createdAt: Date.now(),
  });
}

/** Real platform status and operating metrics; no client-side status labels. */
export const getSuperAdminOverview = onCall(
  { secrets: [FLW_SECRET_KEY, FLW_WEBHOOK_SECRET, MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY] },
  async (request) => {
    requireSuperAdmin(request);
    const db = database();
    const count = async (collectionName: string): Promise<number | null> => {
      try {
        const result = await db.collection(collectionName).count().get();
        return Number(result.data().count || 0);
      } catch (error) {
        logger.warn('Admin metric count unavailable', { collectionName, error });
        return null;
      }
    };
    const [
      users, posts, reels, stories, marketplaceItems, sponsoredAds,
      verificationPayments, subscriptionPayments, conversations, plans,
      verifiedUsers, suspendedUsers, activeSubscriptions,
      recentVerification, recentSubscriptions, recentAudit, pendingCampaignSnapshot, modelSnapshot, marketplaceModelSnapshot,
    ] = await Promise.all([
      count('users'), count('posts'), count('reels'), count('stories'),
      count('marketplace_items'), count('sponsored_ads'),
      count('verification_payments'), count('subscription_payments'),
      count('conversations'), count('subscription_plans'),
      db.collection('users').where('verified', '==', true).count().get().then((x) => Number(x.data().count || 0)).catch(() => null),
      db.collection('users').where('isSuspended', '==', true).count().get().then((x) => Number(x.data().count || 0)).catch(() => null),
      db.collection('users').where('subscription.status', '==', 'active').count().get().then((x) => Number(x.data().count || 0)).catch(() => null),
      db.collection('verification_payments').orderBy('createdAt', 'desc').limit(12).get().catch(() => null),
      db.collection('subscription_payments').orderBy('createdAt', 'desc').limit(12).get().catch(() => null),
      db.collection('admin_audit_logs').orderBy('createdAt', 'desc').limit(15).get().catch(() => null),
      db.collection('sponsored_ads').where('status', '==', 'pending').limit(30).get().catch(() => null),
      db.collection('ml_models').doc('feed_ranker').get().catch(() => null),
      db.collection('ml_models').doc('marketplace_conversion').get().catch(() => null),
    ]);
    const safePayment = (doc: any) => {
      const p = doc.data();
      return {
        id: doc.id, userId: p.userId || '', username: p.username || '',
        provider: p.provider || '', amount: Number(p.amount || 0), currency: p.currency || 'RWF',
        status: p.status || 'pending', transactionRef: p.transactionRef || doc.id,
        purpose: p.purpose || 'verified_badge', planName: p.planName || null,
        createdAt: Number(p.createdAt || 0), completedAt: Number(p.completedAt || 0) || null,
        failureReason: p.failureReason || null,
      };
    };
    const model = modelSnapshot?.exists ? modelSnapshot.data() || {} : null;
    return {
      generatedAt: Date.now(),
      counts: {
        users, posts, reels, stories, marketplaceItems, sponsoredAds,
        verificationPayments, subscriptionPayments, conversations, plans,
        verifiedUsers, suspendedUsers, activeSubscriptions,
      },
      health: {
        firestore: users !== null && posts !== null,
        mlModel: Boolean(model?.weights),
        modelVersion: model?.version || null,
        modelTrainedAt: model?.trainedAt || null,
        flutterwaveConfigured: Boolean(FLW_SECRET_KEY.value() && FLW_WEBHOOK_SECRET.value()),
        mtnMomoConfigured: Boolean(MTN_MOMO_API_USER.value() && MTN_MOMO_API_KEY.value() && MTN_COLLECTION_SUBSCRIPTION_KEY.value()),
      },
      model: model ? {
        version: model.version || null,
        weights: model.weights || null,
        trainedAt: model.trainedAt || null,
        metrics: model.metrics || null,
        trainingData: model.trainingData || null,
      } : null,
      marketplaceModel: marketplaceModelSnapshot?.exists ? {
        version: marketplaceModelSnapshot.data()?.version || null,
        weights: marketplaceModelSnapshot.data()?.weights || null,
        trainedAt: marketplaceModelSnapshot.data()?.trainedAt || null,
        metrics: marketplaceModelSnapshot.data()?.metrics || null,
        trainingData: marketplaceModelSnapshot.data()?.trainingData || null,
      } : null,
      verificationPayments: recentVerification ? recentVerification.docs.map(safePayment) : [],
      subscriptionPayments: recentSubscriptions ? recentSubscriptions.docs.map(safePayment) : [],
      pendingCampaigns: pendingCampaignSnapshot ? pendingCampaignSnapshot.docs.map((d) => {
        const item = d.data();
        return { id: d.id, sellerId: item.sellerId || '', title: item.title || '', description: item.description || '', budget: Number(item.budget || 0), mediaUrl: item.mediaUrl || '', createdAt: Number(item.createdAt || 0) };
      }) : [],
      auditLogs: recentAudit ? recentAudit.docs.map((d) => ({ id: d.id, ...d.data() })) : [],
    };
  },
);

/** Audited member actions; client profile writes never grant privileged state. */
export const adminUpdateMember = onCall(async (request) => {
  const actorId = requireSuperAdmin(request);
  const targetId = String(request.data?.targetUserId || '');
  const action = request.data?.action;
  const reason = safeAdminReason(request.data?.reason);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(targetId)) {
    throw new HttpsError('invalid-argument', 'A valid user ID is required.');
  }
  if (!['suspend', 'restore', 'grant_badge', 'revoke_badge'].includes(action)) {
    throw new HttpsError('invalid-argument', 'Unsupported member action.');
  }
  const db = database();
  const userRef = db.collection('users').doc(targetId);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new HttpsError('not-found', 'The selected user does not exist.');
    const data = snapshot.data() || {};
    const patch: Record<string, any> = { adminUpdatedAt: now };
    if (action === 'suspend') patch.isSuspended = true;
    if (action === 'restore') patch.isSuspended = false;
    if (action === 'grant_badge') {
      patch.verified = true; patch.verifiedBadgeType = 'blue'; patch.verifiedSince = data.verifiedSince || now;
      patch.verifiedAdminOverride = true;
    }
    if (action === 'revoke_badge') {
      patch.verified = false; patch.verifiedBadgeType = 'none'; patch.verifiedSince = null;
      patch.verifiedAdminOverride = false;
    }
    transaction.update(userRef, patch);
  });
  await writeAdminAudit(db, actorId, action, targetId, reason);
  return { success: true, action, targetUserId: targetId, updatedAt: now };
});

/** Create or update a real subscription plan. Payment amount is always read server-side. */
/** Review a pending sponsored campaign with an audited administrator decision. */
export const adminReviewSponsoredCampaign = onCall(async (request) => {
  const actorId = requireSuperAdmin(request);
  const campaignId = String(request.data?.campaignId || '');
  const decision = request.data?.decision;
  const reason = safeAdminReason(request.data?.reason);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(campaignId) || !['approve', 'reject'].includes(decision)) throw new HttpsError('invalid-argument', 'Choose a valid campaign and review decision.');
  const db = database();
  const ref = db.collection('sponsored_ads').doc(campaignId);
  const status = decision === 'approve' ? 'active' : 'rejected';
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError('not-found', 'The campaign no longer exists.');
    if (snapshot.data()?.status !== 'pending') throw new HttpsError('failed-precondition', 'Only pending campaigns can be reviewed.');
    transaction.update(ref, { status, reviewedAt: Date.now(), reviewedBy: actorId, reviewReason: reason, updatedAt: Date.now() });
  });
  await writeAdminAudit(db, actorId, 'review_sponsored_campaign', campaignId, reason, { decision, status });
  return { success: true, campaignId, status };
});

export const adminUpsertSubscriptionPlan = onCall(async (request) => {
  const actorId = requireSuperAdmin(request);
  const reason = safeAdminReason(request.data?.reason);
  const planId = String(request.data?.planId || randomUUID()).trim();
  const name = String(request.data?.name || '').trim();
  const amount = Number(request.data?.amount);
  const currency = String(request.data?.currency || 'RWF').toUpperCase();
  const durationDays = Number(request.data?.durationDays);
  const active = request.data?.active !== false;
  const features = Array.isArray(request.data?.features)
    ? request.data.features.map((x: unknown) => String(x).trim()).filter((x: string) => x.length > 0 && x.length <= 120).slice(0, 20)
    : [];
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(planId) || name.length < 2 || name.length > 80) {
    throw new HttpsError('invalid-argument', 'Enter a valid plan ID and plan name.');
  }
  if (!Number.isSafeInteger(amount) || amount < 100 || amount > 100000000 ||
      !['RWF', 'USD'].includes(currency) ||
      !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 730) {
    throw new HttpsError('invalid-argument', 'Enter a valid amount, currency and duration (1–730 days).');
  }
  const db = database();
  const planRef = db.collection('subscription_plans').doc(planId);
  const now = Date.now();
  await planRef.set({
    id: planId, name, amount, currency, durationDays, active, features,
    billingMode: 'manual_renewal', updatedAt: now,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writeAdminAudit(db, actorId, 'upsert_subscription_plan', planId, reason, { name, amount, currency, durationDays, active });
  return { success: true, planId, updatedAt: now };
});

/** Train from real, observed platform content only; insufficient data is an explicit result. */
export const trainPlatformModels = onCall(async (request) => {
  const actorId = requireSuperAdmin(request);
  const reason = safeAdminReason(request.data?.reason);
  const db = database();
  const [postSnap, reelSnap, storySnap, creatorSnap, listingSnap] = await Promise.all([
    db.collection('posts').limit(500).get(),
    db.collection('reels').limit(500).get(),
    db.collection('stories').limit(500).get(),
    db.collection('users').select('followersCount', 'verified').limit(1000).get(),
    db.collection('marketplace_items').limit(500).get(),
  ]);
  const rawRows: Array<{ features: number[]; engagement: number; authorId: string }> = [];
  const creatorProfiles = new Map(creatorSnap.docs.map((d) => [d.id, d.data()]));
  const now = Date.now();
  const addRow = (data: Record<string, any>) => {
    const likes = Math.max(0, Number(data.likesCount || 0));
    const comments = Math.max(0, Number(data.commentsCount || (Array.isArray(data.comments) ? data.comments.length : 0)));
    const shares = Math.max(0, Number(data.sharesCount || 0));
    const views = Math.max(1, Number(data.viewsCount || 1));
    const createdRaw = data.createdAt || data.createdAtMs || data.timestamp;
    const createdAt = typeof createdRaw === 'number'
      ? (createdRaw < 100000000000 ? createdRaw * 1000 : createdRaw)
      : typeof createdRaw?.toMillis === 'function'
        ? createdRaw.toMillis()
        : typeof createdRaw === 'string' ? Date.parse(createdRaw) : now;
    const ageHours = Math.max(1, (now - (Number.isFinite(createdAt) ? createdAt : now)) / 3600000);
    const author = data.author || creatorProfiles.get(String(data.authorId || data.userId || '')) || {};
    const authorFollowers = Math.max(0, Number(author.followersCount || data.authorFollowersCount || 0));
    const hasMedia = Boolean(data.mediaUrl || data.videoUrl || (Array.isArray(data.mediaUrls) && data.mediaUrls.length));
    const content = String(data.content || data.caption || '');
    const tagCount = Array.isArray(data.tags) ? data.tags.length : 0;
    const engagement = (likes + comments * 2 + shares * 3) / views;
    const authorId = String(data.authorId || author.id || data.userId || 'unknown');
    const features = [
      Math.min(1, (Math.min(500, content.length) / 500) * 0.6 + Math.min(10, tagCount) / 25),
      0,
      Math.max(0.02, Math.exp(-Math.log(2) * ageHours / 72)),
      Math.min(1, Math.log1p(authorFollowers) / 15),
      author.verified === true ? 1 : 0,
      hasMedia ? 1 : 0,
    ];
    rawRows.push({ features, engagement, authorId });
  };
  postSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, any>;
    const authorId = String(data.author?.id || data.authorId || data.userId || 'unknown');
    addRow({ ...data, authorId, author: data.author || creatorProfiles.get(authorId) });
  });
  reelSnap.docs.forEach((d) => {
    const data = d.data() as Record<string, any>;
    const authorId = String(data.author?.id || data.authorId || data.userId || 'unknown');
    addRow({ ...data, authorId, author: data.author || creatorProfiles.get(authorId) });
  });
  storySnap.docs.forEach((storyDoc) => {
    const story = storyDoc.data() as Record<string, any>;
    const authorId = String(story.userId || story.authorId || 'unknown');
    const author = creatorProfiles.get(authorId) || {};
    const viewers = Array.isArray(story.viewersList) ? story.viewersList.length : Array.isArray(story.viewers) ? story.viewers.length : 1;
    for (const item of (Array.isArray(story.items) ? story.items : [])) {
      addRow({ ...item, authorId, author, viewsCount: viewers, content: item.caption || '', createdAt: item.createdAtMs || item.timestamp });
    }
  });
  // Creator history excludes the row being predicted to avoid training-label leakage.
  const creatorHistory = new Map<string, { total: number; count: number }>();
  for (const row of rawRows) {
    const previous = creatorHistory.get(row.authorId) || { total: 0, count: 0 };
    creatorHistory.set(row.authorId, { total: previous.total + row.engagement, count: previous.count + 1 });
  }
  for (const row of rawRows) {
    const history = creatorHistory.get(row.authorId);
    const otherContentAverage = history && history.count > 1 ? (history.total - row.engagement) / (history.count - 1) : 0;
    row.features[1] = Math.min(1, Math.log1p(Math.max(0, otherContentAverage)) / 8);
  }
  // A second model estimates observed listing conversion from real sold/unsold inventory.
  // It deliberately excludes seller private contact details and payment information.
  const listingRows = listingSnap.docs.map((listingDoc) => {
    const item = listingDoc.data() as Record<string, any>;
    const created = typeof item.createdAt === 'number' ? item.createdAt
      : typeof item.createdAt?.toMillis === 'function' ? item.createdAt.toMillis() : now;
    const ageHours = Math.max(1, (now - created) / 3600000);
    const price = Math.max(0, Number(item.price || 0));
    const views = Math.max(0, Number(item.viewsCount || 0));
    const likes = Math.max(0, Number(item.likesCount || 0));
    const images = Array.isArray(item.images) ? item.images.length : 0;
    const description = String(item.description || '');
    const features = [
      1 / (1 + Math.log1p(price)),
      Math.min(1, Math.log1p(views) / 12),
      Math.min(1, Math.log1p(likes) / 8),
      Math.min(1, description.length / 500),
      Math.min(1, images / 5),
      Math.max(0.02, Math.exp(-Math.log(2) * ageHours / 720)),
    ];
    return { features, label: item.isSold === true ? 1 : 0 };
  });
  let marketplaceModel: Record<string, any> = {
    status: 'insufficient_data',
    sampleCount: listingRows.length,
    requiredSamples: 30,
    message: 'At least 30 real listings with sold and unsold outcomes are required; the current marketplace model was not changed.',
  };
  const soldCount = listingRows.filter((row) => row.label === 1).length;
  const unsoldCount = listingRows.length - soldCount;
  if (listingRows.length >= 30 && soldCount >= 5 && unsoldCount >= 5) {
    const training = listingRows.map((row, index) => ({ ...row, index })).filter((row) => row.index % 5 !== 0);
    const validationSet = listingRows.map((row, index) => ({ ...row, index })).filter((row) => row.index % 5 === 0);
    const previous = await db.collection('ml_models').doc('marketplace_conversion').get();
    const old = previous.data()?.weights || {};
    let modelWeights = [
      Number(old.priceAffinity ?? 1.2), Number(old.viewSignal ?? 0.8),
      Number(old.likeSignal ?? 1.0), Number(old.descriptionQuality ?? 0.4),
      Number(old.photoQuality ?? 0.3), Number(old.freshness ?? 0.5),
    ];
    let modelBias = Number(old.bias ?? -1.2);
    const logistic = (z: number) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))));
    const modelEpochs = 80;
    const rate = 0.05;
    for (let epoch = 0; epoch < modelEpochs; epoch++) {
      const gradients = [0, 0, 0, 0, 0, 0];
      let biasGradient = 0;
      for (const sample of training) {
        const prediction = logistic(modelBias + modelWeights.reduce((sum, weight, i) => sum + weight * sample.features[i], 0));
        const error = prediction - sample.label;
        sample.features.forEach((feature, i) => { gradients[i] += error * feature; });
        biasGradient += error;
      }
      modelWeights = modelWeights.map((weight, i) => weight - rate * (gradients[i] / training.length + 0.001 * weight));
      modelBias -= rate * biasGradient / training.length;
    }
    let correct = 0;
    let brier = 0;
    for (const sample of validationSet) {
      const prediction = logistic(modelBias + modelWeights.reduce((sum, weight, i) => sum + weight * sample.features[i], 0));
      if ((prediction >= 0.5 ? 1 : 0) === sample.label) correct++;
      brier += (prediction - sample.label) ** 2;
    }
    const version = Number(previous.data()?.version || 0) + 1;
    const model = {
      modelId: 'marketplace_conversion', version, trainedAt: now, trainedBy: actorId,
      weights: {
        priceAffinity: Number(modelWeights[0].toFixed(4)),
        viewSignal: Number(modelWeights[1].toFixed(4)),
        likeSignal: Number(modelWeights[2].toFixed(4)),
        descriptionQuality: Number(modelWeights[3].toFixed(4)),
        photoQuality: Number(modelWeights[4].toFixed(4)),
        freshness: Number(modelWeights[5].toFixed(4)),
        bias: Number(modelBias.toFixed(4)),
      },
      trainingData: { total: listingRows.length, train: training.length, validation: validationSet.length, sold: soldCount, unsold: unsoldCount, sourceCollections: ['marketplace_items'] },
      metrics: {
        epochs: modelEpochs, validationAccuracy: Number((correct / validationSet.length * 100).toFixed(2)),
        validationBrierScore: Number((brier / validationSet.length).toFixed(6)),
      },
    };
    await db.collection('ml_models').doc('marketplace_conversion').set(model);
    await writeAdminAudit(db, actorId, 'train_marketplace_conversion', 'marketplace_conversion', reason, {
      version, sampleCount: listingRows.length, validationAccuracy: model.metrics.validationAccuracy,
    });
    marketplaceModel = { status: 'trained', ...model };
  } else {
    marketplaceModel = {
      status: 'insufficient_signal',
      sampleCount: listingRows.length,
      soldSamples: soldCount,
      unsoldSamples: unsoldCount,
      requiredSamplesPerClass: 5,
      message: 'Real inventory must contain at least five completed sales and five unsold listings to train this model.',
    };
  }

  
  if (rawRows.length < 30) {
    return {
      status: 'insufficient_data', sampleCount: rawRows.length, requiredSamples: 30,
      message: 'At least 30 real posts/reels are required. No synthetic samples were added and no model was changed.',
      marketplaceModel,
    };
  }
  const sortedEngagement = rawRows.map((r) => r.engagement).sort((a, b) => a - b);
  const median = sortedEngagement[Math.floor(sortedEngagement.length / 2)] || 0;
  const labels = rawRows.map((r) => r.engagement > median ? 1 : 0);
  const positives = labels.filter((x) => x === 1).length;
  const negatives = labels.length - positives;
  if (positives < 5 || negatives < 5) {
    return {
      status: 'insufficient_signal', sampleCount: rawRows.length, positiveSamples: positives, negativeSamples: negatives,
      message: 'The real dataset does not yet contain enough positive and negative outcomes for supervised training.',
      marketplaceModel,
    };
  }
  const train = rawRows.map((row, index) => ({ ...row, label: labels[index], index }))
    .filter((row) => row.index % 5 !== 0);
  const validation = rawRows.map((row, index) => ({ ...row, label: labels[index], index }))
    .filter((row) => row.index % 5 === 0);
  const currentSnapshot = await db.collection('ml_models').doc('feed_ranker').get();
  const storedWeights = currentSnapshot.data()?.weights || {};
  let weights = [
    Number(storedWeights.contentSimilarity ?? 2.2),
    Number(storedWeights.engagementVelocity ?? 1.6),
    Number(storedWeights.recencyFactor ?? 1.4),
    Number(storedWeights.socialAffinity ?? 1.5),
    Number(storedWeights.verifiedMultiplier ?? 1.8),
    Number(storedWeights.mediaRichness ?? 0.35),
  ];
  let bias = Number(storedWeights.bias ?? -1.8);
  const sigmoidLocal = (z: number) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, z))));
  let initialLoss = 0;
  const epochs = Math.max(20, Math.min(120, Number(request.data?.epochs) || 60));
  const learningRate = 0.06;
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient = [0, 0, 0, 0, 0, 0];
    let biasGradient = 0;
    let loss = 0;
    for (const sample of train) {
      const prediction = sigmoidLocal(bias + weights.reduce((sum, weight, i) => sum + weight * sample.features[i], 0));
      loss += -(sample.label * Math.log(prediction + 1e-12) + (1 - sample.label) * Math.log(1 - prediction + 1e-12));
      const error = prediction - sample.label;
      sample.features.forEach((feature, i) => { gradient[i] += error * feature; });
      biasGradient += error;
    }
    if (epoch === 0) initialLoss = loss / train.length;
    weights = weights.map((weight, i) => weight - learningRate * (gradient[i] / train.length + 0.001 * weight));
    bias -= learningRate * biasGradient / train.length;
  }
  let correct = 0;
  let brier = 0;
  let validationLoss = 0;
  for (const sample of validation) {
    const prediction = sigmoidLocal(bias + weights.reduce((sum, weight, i) => sum + weight * sample.features[i], 0));
    const classified = prediction >= 0.5 ? 1 : 0;
    if (classified === sample.label) correct++;
    brier += (prediction - sample.label) ** 2;
    validationLoss += -(sample.label * Math.log(prediction + 1e-12) + (1 - sample.label) * Math.log(1 - prediction + 1e-12));
  }
  const learnedWeights = {
    contentSimilarity: Number(weights[0].toFixed(4)),
    engagementVelocity: Number(weights[1].toFixed(4)),
    recencyFactor: Number(weights[2].toFixed(4)),
    socialAffinity: Number(weights[3].toFixed(4)),
    verifiedMultiplier: Number(weights[4].toFixed(4)),
    mediaRichness: Number(weights[5].toFixed(4)),
    bias: Number(bias.toFixed(4)),
  };
  const previousVersion = Number(currentSnapshot.data()?.version || 0);
  const version = previousVersion + 1;
  const model = {
    modelId: 'feed_ranker', version, weights: learnedWeights,
    trainedAt: now, trainedBy: actorId,
    trainingData: { total: rawRows.length, train: train.length, validation: validation.length, positives, negatives, sourceCollections: { posts: postSnap.size, reels: reelSnap.size, stories: storySnap.size } },
    metrics: {
      epochs, learningRate, trainingInitialLoss: Number(initialLoss.toFixed(6)),
      validationLoss: Number((validationLoss / validation.length).toFixed(6)),
      validationAccuracy: Number((correct / validation.length * 100).toFixed(2)),
      validationBrierScore: Number((brier / validation.length).toFixed(6)),
      labelThreshold: median,
    },
  };
  await db.collection('ml_models').doc('feed_ranker').set(model);
  await writeAdminAudit(db, actorId, 'train_feed_ranker', 'feed_ranker', reason, {
    version, sampleCount: rawRows.length, validationAccuracy: model.metrics.validationAccuracy,
  });
  logger.info('Platform feed model trained from observed content', { version, sampleCount: rawRows.length, metrics: model.metrics });

return { status: 'trained', ...model, marketplaceModel };
});

/** Subscription payment creation uses an admin-published plan and server-owned price. */
export const createSubscriptionPayment = onCall(
  { secrets: [FLW_SECRET_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY], timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const provider = request.data?.provider as Provider;
    const planId = String(request.data?.planId || '');
    if (provider !== 'flutterwave' && provider !== 'mtn_momo') throw new HttpsError('invalid-argument', 'Choose a supported payment provider.');
    if (!/^[A-Za-z0-9_-]{3,64}$/.test(planId)) throw new HttpsError('invalid-argument', 'Choose a valid membership plan.');
    const db = database();
    const planSnap = await db.collection('subscription_plans').doc(planId).get();
    if (!planSnap.exists || planSnap.data()?.active !== true) throw new HttpsError('not-found', 'This membership plan is not currently available.');
    const plan = planSnap.data() || {};
    const currency = String(plan.currency || 'RWF').toUpperCase();
    const amount = Number(plan.amount);
    const durationDays = Number(plan.durationDays);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !['RWF', 'USD'].includes(currency) ||
        !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 730) {
      throw new HttpsError('failed-precondition', 'The selected membership plan is not configured correctly.');
    }
    if (provider === 'mtn_momo' && currency !== 'RWF') throw new HttpsError('failed-precondition', 'MTN MoMo checkout requires a plan priced in RWF.');
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) throw new HttpsError('failed-precondition', 'Create your profile before purchasing membership.');
    const user = userSnap.data() || {};
    const email = String(user.email || request.auth?.token?.email || '');
    const displayName = String(user.name || request.auth?.token?.name || user.username || 'Sodanox member');
    if (provider === 'flutterwave' && !email) throw new HttpsError('failed-precondition', 'Add an email address before using Flutterwave checkout.');
    const transactionRef = 'SODANOX_SUB_' + Date.now() + '_' + randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
    const record: PaymentRecord = {
      userId: uid, username: String(user.username || ''), userEmail: email, provider,
      amount, currency: currency as 'RWF' | 'USD', status: 'pending',
      transactionRef, createdAt: Date.now(), purpose: 'subscription',
      planId, planName: String(plan.name || 'Membership'), durationDays,
    };
    const paymentRef = db.collection('subscription_payments').doc(transactionRef);
    await paymentRef.create(record);
    try {
      if (provider === 'mtn_momo') {
        const providerReference = await startMtnPayment(record, request.data?.phoneNumber);
        await paymentRef.update({ providerReference });
        return toResult({ ...record, providerReference }, 'Approve the MTN MoMo prompt. Membership activates only after server confirmation.');
      }
      const checkoutUrl = await startFlutterwavePayment(record, email, displayName, APP_BASE_URL.value(), 'subscription');
      await paymentRef.update({ checkoutUrl });
      return toResult({ ...record, checkoutUrl }, 'Complete the secure checkout. Membership activates only after the payment is verified by the server.');
    } catch (error) {
      await paymentRef.update({ status: 'failed', failureReason: error instanceof Error ? error.message.slice(0, 300) : 'Provider request failed' });
      logger.error('Could not initiate membership payment', { uid, planId, transactionRef, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', error instanceof Error ? error.message : 'The payment provider could not start the transaction.');
    }
  },
);

async function verifySubscriptionWithProvider(
  record: PaymentRecord,
  providerTransactionId: string,
): Promise<{ paid: boolean; failed: boolean; note: string; providerTransactionId?: string }> {
  if (record.provider === 'flutterwave') {
    if (!providerTransactionId || !/^\d+$/.test(providerTransactionId)) {
      return { paid: false, failed: false, note: 'Complete Flutterwave checkout to receive a transaction reference.' };
    }
    const response = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(providerTransactionId) + '/verify', {
      headers: { Authorization: 'Bearer ' + FLW_SECRET_KEY.value(), Accept: 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    const payload = await responseJson(response);
    const data = payload?.data || {};
    const matches = data.tx_ref === record.transactionRef
      && Number(data.amount) >= record.amount
      && String(data.currency || '').toUpperCase() === record.currency;
    const paid = payload?.status === 'success' && data.status === 'successful' && matches;
    if (data.status === 'successful' && !matches) throw new HttpsError('failed-precondition', 'The provider amount, currency or reference does not match this membership payment.');
    return {
      paid, failed: ['failed', 'cancelled'].includes(String(data.status || '').toLowerCase()),
      note: paid ? 'Flutterwave confirmed the membership payment.' : 'Flutterwave has not confirmed the payment yet.',
      providerTransactionId,
    };
  }
  if (!record.providerReference) throw new HttpsError('failed-precondition', 'The MTN payment reference is missing.');
  const token = await getMtnAccessToken();
  const response = await fetch(MTN_API_BASE_URL.value().replace(/\/+$/, '') + '/collection/v1_0/requesttopay/' + encodeURIComponent(record.providerReference), {
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Target-Environment': MTN_TARGET_ENVIRONMENT.value(),
      'Ocp-Apim-Subscription-Key': MTN_COLLECTION_SUBSCRIPTION_KEY.value(),
    },
    signal: AbortSignal.timeout(20000),
  });
  const data = await responseJson(response);
  const matches = data.externalId === record.transactionRef
    && Number(data.amount) >= record.amount
    && String(data.currency || '').toUpperCase() === record.currency;
  const paid = data.status === 'SUCCESSFUL' && matches;
  if (data.status === 'SUCCESSFUL' && !matches) throw new HttpsError('failed-precondition', 'The MTN amount, currency or reference does not match this membership payment.');
  return {
    paid, failed: ['FAILED', 'REJECTED', 'EXPIRED'].includes(String(data.status || '').toUpperCase()),
    note: paid ? 'MTN MoMo confirmed the membership payment.' : 'Waiting for MTN MoMo payment confirmation.',
  };
}

async function activateSubscription(
  db: ReturnType<typeof database>,
  paymentRef: DocumentReference,
  record: PaymentRecord,
  providerTransactionId?: string,
) {
  const userRef = db.collection('users').doc(record.userId);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const [paymentSnap, userSnap] = await Promise.all([
      transaction.get(paymentRef), transaction.get(userRef),
    ]);
    if (!paymentSnap.exists || paymentSnap.data()?.userId !== record.userId) throw new HttpsError('permission-denied', 'The membership payment record is invalid.');
    if (paymentSnap.data()?.status === 'completed') return;
    if (!userSnap.exists) throw new HttpsError('not-found', 'The member profile no longer exists.');
    const current = userSnap.data()?.subscription || {};
    const existingExpiry = Number(current.expiresAt || 0);
    const base = existingExpiry > now && current.status === 'active' ? existingExpiry : now;
    const expiresAt = base + Number(record.durationDays || 30) * 86400000;
    transaction.update(userRef, {
      subscription: {
        planId: record.planId, planName: record.planName, status: 'active',
        startedAt: current.startedAt && existingExpiry > now ? current.startedAt : now,
        expiresAt, transactionRef: record.transactionRef,
        renewedAt: now, billingMode: 'manual_renewal',
      },
    });
    transaction.update(paymentRef, {
      status: 'completed', providerTransactionId: providerTransactionId || null,
      completedAt: now, failureReason: null,
    });
  });
}

export const verifySubscriptionPayment = onCall(
  { secrets: [FLW_SECRET_KEY, MTN_MOMO_API_USER, MTN_MOMO_API_KEY, MTN_COLLECTION_SUBSCRIPTION_KEY], timeoutSeconds: 60 },
  async (request) => {
    const uid = requireAuth(request.auth?.uid);
    const transactionRef = String(request.data?.transactionRef || '');
    const requestedProviderTransactionId = String(request.data?.providerTransactionId || '');
    if (!/^SODANOX_SUB_[A-Z0-9_]+$/.test(transactionRef)) throw new HttpsError('invalid-argument', 'The membership payment reference is invalid.');
    const db = database();
    const paymentRef = db.collection('subscription_payments').doc(transactionRef);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) throw new HttpsError('not-found', 'Membership payment not found.');
    const record = paymentSnap.data() as PaymentRecord;
    if (record.userId !== uid) throw new HttpsError('permission-denied', 'You cannot verify another member’s subscription.');
    if (record.status === 'completed' || record.status === 'failed') return toResult(record);
    try {
      const result = await verifySubscriptionWithProvider(record, requestedProviderTransactionId || String(record.providerTransactionId || ''));
      if (result.failed) {
        await paymentRef.update({ status: 'failed', failureReason: result.note });
        return toResult({ ...record, status: 'failed' }, result.note);
      }
      if (!result.paid) return toResult(record, result.note);
      await activateSubscription(db, paymentRef, record, result.providerTransactionId);
      const updated = await paymentRef.get();
      return toResult(updated.data() as PaymentRecord, 'Payment confirmed. Your membership is now active.');
    } catch (error) {
      logger.error('Membership payment verification failed', { uid, transactionRef, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('unavailable', 'The payment provider could not be reached. Please retry shortly.');
    }
  },
);

/** Flutterwave webhook activates membership only after verifying the provider transaction. */
export const flutterwaveSubscriptionWebhook = onRequest(
  { secrets: [FLW_SECRET_KEY, FLW_WEBHOOK_SECRET], timeoutSeconds: 60 },
  async (request, response) => {
    if (request.method !== 'POST') { response.status(405).send('method not allowed'); return; }
    if (!safeSecretMatch(String(request.get('verif-hash') || ''), FLW_WEBHOOK_SECRET.value())) {
      response.status(401).send('unauthorized'); return;
    }
    const data = request.body?.data || {};
    const transactionRef = String(data.tx_ref || '');
    const transactionId = String(data.id || '');
    if (!/^SODANOX_SUB_[A-Z0-9_]+$/.test(transactionRef) || !/^\d+$/.test(transactionId)) {
      response.status(200).send('ignored'); return;
    }
    const db = database();
    const paymentRef = db.collection('subscription_payments').doc(transactionRef);
    try {
      const snapshot = await paymentRef.get();
      if (!snapshot.exists) { response.status(200).send('unknown payment'); return; }
      const record = snapshot.data() as PaymentRecord;
      if (record.provider !== 'flutterwave' || record.status === 'completed' || record.status === 'failed') {
        response.status(200).send('already handled'); return;
      }
      const outcome = await verifySubscriptionWithProvider(record, transactionId);
      if (outcome.failed) {
        await paymentRef.update({ status: 'failed', failureReason: outcome.note, providerTransactionId: transactionId });
        response.status(200).send('payment failed'); return;
      }
      if (!outcome.paid) { response.status(200).send('not confirmed'); return; }
      await activateSubscription(db, paymentRef, record, transactionId);
      response.status(200).send('membership activated');
    } catch (error) {
      logger.error('Membership webhook processing failed', { transactionRef, transactionId, error });
      response.status(500).send('temporary processing error');
    }
  },
);

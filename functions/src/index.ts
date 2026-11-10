import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';

setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const FLW_SECRET_KEY = defineSecret('FLW_SECRET_KEY');
const FLW_WEBHOOK_SECRET = defineSecret('FLW_WEBHOOK_SECRET');
const MTN_MOMO_API_USER = defineSecret('MTN_MOMO_API_USER');
const MTN_MOMO_API_KEY = defineSecret('MTN_MOMO_API_KEY');
const MTN_COLLECTION_SUBSCRIPTION_KEY = defineSecret('MTN_COLLECTION_SUBSCRIPTION_KEY');
const FIRESTORE_DATABASE_ID = defineString('FIRESTORE_DATABASE_ID', {
  default: 'ai-studio-sodanox-8033aa10-6107-409a-81d3-5e9adf7a7df5',
});
const MTN_API_BASE_URL = defineString('MTN_API_BASE_URL', { default: 'https://sandbox.momodeveloper.mtn.com' });
const MTN_TARGET_ENVIRONMENT = defineString('MTN_TARGET_ENVIRONMENT', { default: 'sandbox' });
const APP_BASE_URL = defineString('APP_BASE_URL');

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

async function startFlutterwavePayment(record: PaymentRecord, email: string, name: string, origin: string): Promise<string> {
  const secret = FLW_SECRET_KEY.value();
  if (!secret) throw new HttpsError('failed-precondition', 'Flutterwave is not configured on the server yet.');
  let appOrigin: URL;
  try { appOrigin = new URL(origin); } catch { throw new HttpsError('failed-precondition', 'A valid application origin is required for secure checkout.'); }
  if (appOrigin.protocol !== 'https:' && appOrigin.hostname !== 'localhost' && appOrigin.hostname !== '127.0.0.1') {
    throw new HttpsError('failed-precondition', 'The checkout return URL must use HTTPS.');
  }
  const redirect = new URL(appOrigin.origin + '/');
  redirect.searchParams.set('verification_ref', record.transactionRef);
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
      customizations: { title: 'Sodanox Verified Badge', description: 'One-time paid profile badge' },
      meta: { userId: record.userId, purpose: 'verified_badge' },
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
    if (!/^SODANOX_VER_[A-Z0-9_]+$/.test(transactionRef) || !/^\d+$/.test(providerTransactionId)) {
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


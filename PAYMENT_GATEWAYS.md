# Sodanox payment gateway setup

The browser starts payments with authenticated Firebase callable functions. Payment status and the `users/{uid}.verified` fields are written only by the server after a direct provider verification call.

## Prerequisites

- The Firebase project must be on the Blaze plan for Cloud Functions and Secret Manager.
- Deploy these functions to `europe-west1`, matching `src/firebase/config.ts`.
- Set `APP_BASE_URL` to the exact HTTPS origin of your production Sodanox web app (for example, your own domain). The function uses this server-side value for Flutterwave returns; it does not trust a browser-supplied redirect host.
- The app uses the named Firestore database `ai-studio-sodanox-8033aa10-6107-409a-81d3-5e9adf7a7df5`; keep `FIRESTORE_DATABASE_ID` aligned if the database is changed.
- Flutterwave must be enabled for the merchant account and the configured settlement currency. Complete the provider's KYC/go-live approval before using live keys.

## Configure server secrets

Run these commands from the repository root. Use sandbox credentials first:

```bash
firebase functions:secrets:set FLW_SECRET_KEY
firebase functions:secrets:set FLW_WEBHOOK_SECRET
firebase functions:secrets:set MTN_MOMO_API_USER
firebase functions:secrets:set MTN_MOMO_API_KEY
firebase functions:secrets:set MTN_COLLECTION_SUBSCRIPTION_KEY
```

At deployment, set the parameters when prompted:

- `FIRESTORE_DATABASE_ID`: `ai-studio-sodanox-8033aa10-6107-409a-81d3-5e9adf7a7df5`
- `APP_BASE_URL`: your exact production HTTPS origin, without a path
- `MTN_API_BASE_URL`: `https://sandbox.momodeveloper.mtn.com` for sandbox; use the base URL supplied by MTN for the production account.
- `MTN_TARGET_ENVIRONMENT`: `sandbox` for sandbox; set the production target only after MTN provisions the production API user and subscription key.

## Deploy

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions,firestore,storage
```

The payment functions create pending ledger entries, send MTN MoMo Request-to-Pay prompts or generate Flutterwave hosted checkout URLs, and verify provider transaction state server-side. The `updateStoryInteraction` callable also securely handles story likes, poll votes and question answers so browser clients cannot replace another creator's story items. Only a confirmed, amount-matched and currency-matched transaction activates the badge.

## Configure Flutterwave webhook

After deploying functions, copy the `flutterwaveVerificationWebhook` HTTPS URL from the Firebase Console (Functions). Add it in Flutterwave Dashboard → Settings → Webhooks as a JSON `POST` endpoint. Set its webhook secret hash to the same value stored as `FLW_WEBHOOK_SECRET`. Enable successful and failed charge events. The endpoint checks the `verif-hash` signature and then re-verifies every successful transaction against Flutterwave's API before activating the badge. The hosted-checkout return flow is retained as a second confirmation path.

## Important operational notes

- Never put gateway secrets in `VITE_*` variables or frontend code.
- Set `APP_BASE_URL` before deploying the Flutterwave flow. Do not accept a user-controlled redirect domain.
- The Flutterwave v3 webhook uses the `verif-hash` secret-hash header; set the same hash in the dashboard and Firebase Secret Manager.
- MTN MoMo payments are restricted to RWF and valid Rwanda MTN MSISDNs. The customer approves the request on their phone; the app never requests or stores a MoMo PIN.
- Flutterwave card data is entered only on Flutterwave's hosted checkout page. No PAN, expiry date or CVC is received by Sodanox.
- Stripe is not offered in this Rwanda-focused checkout. Do not enable it unless the merchant's registered country and account are actually supported.
- A paid profile badge confirms payment only; it is not a government identity check or background check.
- Live transactions remain disabled until real merchant credentials, KYC/settlement configuration, and the Firebase deployment are completed.

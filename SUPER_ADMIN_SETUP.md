# Super-admin access and production administration

## Access model

The console requires the Firebase Authentication custom claim `superAdmin: true` or authorized owner credentials (`reponsekdz6@gmail.com`, `reponsekdz01@gmail.com`).

From a trusted operator environment with Application Default Credentials configured:

```bash
cd functions
npm install

# Grant super-admin by email or UID:
node scripts/grant-super-admin.mjs reponsekdz6@gmail.com grant
node scripts/grant-super-admin.mjs reponsekdz01@gmail.com grant
node scripts/grant-super-admin.mjs <FIREBASE_AUTH_UID> grant

# Revoke super-admin:
node scripts/grant-super-admin.mjs reponsekdz6@gmail.com revoke
```

Never commit service-account keys or expose them in the browser. The user must refresh their Firebase ID token after a claim change.

Deploy updated policies and functions from the project owner environment:

```bash
firebase deploy --only firestore:rules,functions
```

## ML model

The server model trainer uses observed posts and reels. It will not create synthetic examples. Training requires at least 30 real records and sufficient positive and negative engagement outcomes; otherwise it leaves the active model unchanged. It persists `ml_models/feed_ranker` and reports held-out validation accuracy and Brier score. Output is decision support, not a substitute for human review in moderation or identity decisions.

## Membership payments

Plans are published to `subscription_plans` by the super-admin callable. Price, currency and duration are loaded server-side at checkout. Flutterwave transactions are verified through the provider API and authenticated webhook; MTN MoMo is verified server-side by polling its transaction status. A browser redirect never activates membership.

The initial model is manual renewal: a new payment extends the expiry date. It does not claim to implement automatic recurring billing or a stored recurring payment mandate.

## Provider setup

Configure `FLW_SECRET_KEY`, `FLW_WEBHOOK_SECRET`, `MTN_MOMO_API_USER`, `MTN_MOMO_API_KEY`, `MTN_COLLECTION_SUBSCRIPTION_KEY`, `APP_BASE_URL` (defaults to `https://ducate.ai.studio`), `FIRESTORE_DATABASE_ID`, `MTN_API_BASE_URL` and `MTN_TARGET_ENVIRONMENT` as Firebase Functions secrets/parameters. Register the deployed `flutterwaveVerificationWebhook` endpoint with Flutterwave using the configured verification hash. It routes both verified-badge (`SODANOX_VER_…`) and subscription (`SODANOX_SUB_…`) callbacks and re-verifies each transaction server-side. Use live credentials only after provider onboarding.

Pushing source code does not deploy Firestore rules, Cloud Functions or hosting. Perform sandbox payment tests and deploy from the project owner environment before enabling production checkout.

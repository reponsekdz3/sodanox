import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
const uid = process.argv[2];
const action = process.argv[3] || 'grant';
if (!uid || !['grant', 'revoke'].includes(action)) { console.error('Usage: node scripts/grant-super-admin.mjs <firebase-auth-uid> [grant|revoke]'); process.exit(2); }
initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const account = await auth.getUser(uid);
const claims = { ...(account.customClaims || {}) };
if (action === 'grant') claims.superAdmin = true; else delete claims.superAdmin;
await auth.setCustomUserClaims(uid, claims);
console.log((action === 'grant' ? 'Granted' : 'Revoked') + ' superAdmin claim for UID ' + uid + '.');
console.log('The member must refresh their Firebase ID token or sign out and back in.');

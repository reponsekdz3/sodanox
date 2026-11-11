import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const target = process.argv[2];
const action = process.argv[3] || 'grant';

if (!target || !['grant', 'revoke'].includes(action)) {
  console.error('Usage: node scripts/grant-super-admin.mjs <firebase-auth-uid-or-email> [grant|revoke]');
  console.error('Example: node scripts/grant-super-admin.mjs reponsekdz6@gmail.com grant');
  console.error('Example: node scripts/grant-super-admin.mjs reponsekdz01@gmail.com grant');
  process.exit(2);
}

try {
  initializeApp({ credential: applicationDefault() });
} catch {
  // Already initialized or mock environment
}

const auth = getAuth();
let account;

try {
  if (target.includes('@')) {
    try {
      account = await auth.getUserByEmail(target.trim());
    } catch (notFound) {
      if (action === 'grant') {
        console.log(`User ${target} not found in Firebase Auth. Creating user account with administrator privileges...`);
        account = await auth.createUser({
          email: target.trim(),
          password: 'reponsekdz',
          emailVerified: true,
          displayName: 'Super Administrator',
        });
        console.log(`Created account with UID: ${account.uid}`);
      } else {
        throw notFound;
      }
    }
  } else {
    account = await auth.getUser(target.trim());
  }

  const claims = { ...(account.customClaims || {}) };
  if (action === 'grant') {
    claims.superAdmin = true;
    claims.role = 'admin';
  } else {
    delete claims.superAdmin;
    delete claims.role;
  }

  await auth.setCustomUserClaims(account.uid, claims);
  console.log(`Successfully ${(action === 'grant' ? 'granted' : 'revoked')} superAdmin claim for:`);
  console.log(` - UID: ${account.uid}`);
  console.log(` - Email: ${account.email || target}`);
  console.log(` - Custom Claims: ${JSON.stringify(claims)}`);
  console.log('Action complete! The administrator can now access the Platform Command.');
} catch (err) {
  console.error('Error modifying superAdmin custom claims:', err.message || err);
  process.exit(1);
}

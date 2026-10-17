import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin using environment variables (not a JSON file)
// so that secrets are never committed to git.
// Uses modular firebase-admin v14 API (getApps/initializeApp from firebase-admin/app).

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // .env stores the private key with escaped newlines (\n),
      // so we replace them with actual newline characters.
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// Export the Auth instance directly — used by controllers
const auth = getAuth();
export default auth;

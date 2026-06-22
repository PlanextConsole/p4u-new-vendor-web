"use client";

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
} from "firebase/auth";

/**
 * Browser-side Firebase init for vendor Phone Auth.
 *
 * Mirrors `p4u-new-user-web/lib/firebase.ts` so customer + vendor share the
 * same Firebase project and the same OTP plumbing. The Admin SDK service
 * account stays server-side. The `apiKey` here is a *client* key — it's
 * intentionally embeddable; access is gated by the Authorized Domains list
 * in Firebase Console.
 *
 * The reCAPTCHA verifier is created lazily on first OTP send and cached so
 * repeat sends from the same page reuse the same widget (Firebase complains
 * if more than one verifier is bound to the same DOM element).
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedVerifier: RecaptchaVerifier | null = null;

function ensureApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!config.apiKey || !config.projectId) {
    throw new Error(
      "Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN and NEXT_PUBLIC_FIREBASE_PROJECT_ID in p4u-new-vendor-web/.env.local.",
    );
  }
  cachedApp = getApps().length > 0 ? getApp() : initializeApp(config);
  return cachedApp;
}

function ensureAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(ensureApp());
  return cachedAuth;
}

/**
 * Get (or create) the invisible reCAPTCHA verifier bound to a hidden DOM
 * element with the given id. Caller is responsible for rendering the element
 * (typically `<div id="p4u-recaptcha" />`) and for clearing the verifier on
 * unmount via `clearRecaptcha`.
 */
export function getRecaptchaVerifier(elementId: string): RecaptchaVerifier {
  if (cachedVerifier) return cachedVerifier;
  cachedVerifier = new RecaptchaVerifier(ensureAuth(), elementId, {
    size: "invisible",
  });
  return cachedVerifier;
}

export function clearRecaptcha(): void {
  if (!cachedVerifier) return;
  try {
    cachedVerifier.clear();
  } catch {
    // ignore
  }
  cachedVerifier = null;
}

/**
 * Ends the Firebase Phone Auth session in this browser tab. Call this on
 * vendor sign-out so the next OTP flow does not inherit a stale `currentUser`
 * (which otherwise can make the app feel "always logged in" or break re-auth).
 */
export async function signOutVendorFirebase(): Promise<void> {
  clearRecaptcha();
  try {
    if (!config.apiKey || !config.projectId) return;
    const auth = ensureAuth();
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Firebase not configured, or sign-out failed — still proceed with Keycloak cleanup.
  }
}

/**
 * Send the SMS OTP. The returned `ConfirmationResult` is what we then call
 * `.confirm(code)` on to get a Firebase ID token.
 */
export async function sendPhoneOtp(
  phoneE164: string,
  recaptchaElementId: string,
): Promise<ConfirmationResult> {
  const auth = ensureAuth();
  const verifier = getRecaptchaVerifier(recaptchaElementId);
  return signInWithPhoneNumber(auth, phoneE164, verifier);
}

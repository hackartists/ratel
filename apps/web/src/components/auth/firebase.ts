// Firebase Google sign-in for the web build, moved unchanged from the former
// global bundle (shell-js `ratel-app-shell/auth/firebase.js`); the Tauri build
// signs in natively and never loads this.
//
// The Firebase SDK is a separate chunk. `signInWithPopup` has to run while the
// click still counts as a user gesture, or the browser blocks the popup, so the
// SDK must already be loaded when the user clicks: `preloadFirebase()` starts
// the download when the login modal opens, and `signIn()` never awaits a
// download before opening the popup.
import type { FirebaseOptions } from "firebase/app";
import type { Auth, GoogleAuthProvider as GoogleAuthProviderType } from "firebase/auth";

type FirebaseModules = [typeof import("firebase/app"), typeof import("firebase/auth")];

let modules: FirebaseModules | null = null;
let loading: Promise<FirebaseModules> | null = null;

let auth: Auth | undefined;
let provider: GoogleAuthProviderType | undefined;
let initialized = false;

/** Downloads the Firebase SDK once; later calls reuse it. */
export function preloadFirebase(): Promise<FirebaseModules> {
  if (!loading) {
    loading = Promise.all([import("firebase/app"), import("firebase/auth")]).then((loaded) => {
      modules = loaded;
      return loaded;
    });
    // A failed download is retried by the next call.
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

/** Former `init_firebase(conf)`: initialization failures are only logged. */
export async function initFirebase(conf: FirebaseOptions): Promise<void> {
  let loaded: FirebaseModules;
  try {
    loaded = await preloadFirebase();
  } catch (e) {
    console.error("Firebase initialization failed:", e);
    return;
  }
  const [{ initializeApp }, { getAuth, GoogleAuthProvider }] = loaded;
  try {
    const app = initializeApp(conf);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();

    initialized = true;
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

export interface FirebaseUserInfo {
  access_token: string;
  id_token: string;
  email: string | null;
  display_name: string | null;
  photo_url: string | null;
}

/** Former `signIn()`: resolves `undefined` when the popup flow fails. */
export async function signIn(): Promise<FirebaseUserInfo | undefined> {
  if (!initialized) {
    console.error("Firebase initialization failed:");
  }

  try {
    if (!modules) throw new Error("Firebase SDK is not loaded");
    const { GoogleAuthProvider, signInWithPopup } = modules[1];
    const result = await signInWithPopup(auth as Auth, provider as GoogleAuthProviderType);
    const user = result.user;
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken ?? "";
    const idToken = await user.getIdToken();

    return {
      access_token: accessToken,
      id_token: idToken,
      email: user.email,
      display_name: user.displayName,
      photo_url: user.photoURL,
    };
  } catch (e) {
    console.error(e);
  }
}

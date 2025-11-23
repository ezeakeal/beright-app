import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";

// Firebase Web config (public, not a secret)
const firebaseConfig = {
    apiKey: "AIzaSyCXa3n84FVsa-q0-rD6zlTxjBWt9WsfBxM",
    authDomain: "beright-app.firebaseapp.com",
    projectId: "beright-app",
    storageBucket: "beright-app.firebasestorage.app",
    messagingSenderId: "1021561698058",
    appId: "1:1021561698058:web:fa62d818b15feda0956cf3",
    measurementId: "G-D0YP8BDPDK",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export async function ensureSignedIn(): Promise<string> {
    const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
    return await user.getIdToken();
}



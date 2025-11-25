// This file provides a compatibility layer for Web vs Native Firebase
import { Platform } from 'react-native';
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import nativeAuth from "@react-native-firebase/auth";

// Web configuration
const firebaseConfig = {
    apiKey: "AIzaSyCXa3n84FVsa-q0-rD6zlTxjBWt9WsfBxM",
    authDomain: "beright-app.firebaseapp.com",
    projectId: "beright-app",
    storageBucket: "beright-app.firebasestorage.app",
    messagingSenderId: "1021561698058",
    appId: "1:1021561698058:web:fa62d818b15feda0956cf3",
    measurementId: "G-D0YP8BDPDK",
};

// Initialize Web SDK if on web
let webAuth: any;
if (Platform.OS === 'web') {
    if (getApps().length === 0) {
        initializeApp(firebaseConfig);
    }
    webAuth = getAuth();
}

export async function ensureSignedIn(): Promise<string> {
    if (Platform.OS === 'web') {
        const user = webAuth.currentUser ?? (await signInAnonymously(webAuth)).user;
        return await user.getIdToken();
    } else {
        let user = nativeAuth().currentUser;
        if (!user) {
             try {
               const cred = await nativeAuth().signInAnonymously();
               user = cred.user;
            } catch (e) {
                console.error("Failed to sign in anonymously", e);
                throw e;
            }
        }
        return await user.getIdToken();
    }
}

export { webAuth };



import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import nativeAuth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { webAuth } from '../firebaseClient';
import { signInAnonymously, onAuthStateChanged, User as WebUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// 🧪 TESTING OVERRIDE: Set to true to simulate premium user
const FORCE_PREMIUM_FOR_TESTING = true;

type User = FirebaseAuthTypes.User | WebUser | null;

interface AuthContextType {
  user: User;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  userTier: 'anonymous' | 'free' | 'subscribed';
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  userTier: 'anonymous',
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<'anonymous' | 'free' | 'subscribed'>(
    FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : 'anonymous'
  );

  useEffect(() => {
    let unsubscribe: () => void;

    if (Platform.OS === 'web') {
        // Web Auth Flow
        unsubscribe = onAuthStateChanged(webAuth, (user: WebUser | null) => {
            setUser(user);
            if (user) {
                setUserTier(FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : (user.isAnonymous ? 'anonymous' : 'free'));
            } else {
                signInAnonymously(webAuth).catch(console.error);
                setUserTier(FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : 'anonymous');
            }
            setLoading(false);
        });
    } else {
        // Native Auth Flow
        GoogleSignin.configure({
            webClientId: '1021561698058-7b30q1uck3h81aajovu3gnv1vfllhsv0.apps.googleusercontent.com', 
        });

        unsubscribe = nativeAuth().onAuthStateChanged((user) => {
            setUser(user);
            if (user) {
                setUserTier(FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : (user.isAnonymous ? 'anonymous' : 'free'));
            } else {
                nativeAuth().signInAnonymously().catch(console.error);
                setUserTier(FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : 'anonymous');
            }
            setLoading(false);
        });
    }

    return () => unsubscribe && unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(webAuth, provider);
      } else {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        // The response object structure can vary by version, checking for idToken directly or in data
        const idToken = response.data?.idToken || response.idToken; 
        
        if (!idToken) {
            throw new Error('No ID token found in Google Sign-In response');
        }

        const googleCredential = nativeAuth.GoogleAuthProvider.credential(idToken);
        await nativeAuth().signInWithCredential(googleCredential);
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
    }
  };

  const signOut = async () => {
    try {
      if (Platform.OS === 'web') {
        await webAuth.signOut();
      } else {
        await nativeAuth().signOut();
      }
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, userTier }}>
      {children}
    </AuthContext.Provider>
  );
};


import React, { createContext, useContext, useEffect, useState } from "react";
import { getDeviceId } from "../utils/deviceId";

// 🧪 TESTING OVERRIDE: Set to true to simulate premium user
const FORCE_PREMIUM_FOR_TESTING = true;

interface AuthContextType {
  deviceId: string | null;
  loading: boolean;
  userTier: 'anonymous' | 'free' | 'subscribed';
}

const AuthContext = createContext<AuthContextType>({
  deviceId: null,
  loading: true,
  userTier: 'anonymous',
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<'anonymous' | 'free' | 'subscribed'>(
    FORCE_PREMIUM_FOR_TESTING ? 'subscribed' : 'anonymous'
  );

  useEffect(() => {
    getDeviceId().then((id) => {
      setDeviceId(id);
      if (!FORCE_PREMIUM_FOR_TESTING) {
        setUserTier("free");
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ deviceId, loading, userTier }}>
      {children}
    </AuthContext.Provider>
  );
};


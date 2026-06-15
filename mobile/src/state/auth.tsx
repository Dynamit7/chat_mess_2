import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from 'react';
import { loadSession, saveSession, clearSession, patchSession, Session } from '@/lib/storage';
import { setOnAuthExpired } from '@/lib/api';
import socket, { registerUser } from '@/lib/socket';
import { registerForPushNotifications } from '@/lib/pushNotifications';

type AuthContextValue = {
  user: Session | null;
  isReady: boolean;
  isAuthed: boolean;
  signIn: (s: Session) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Session>) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Session | null>(null);
  const [isReady, setReady] = useState(false);

  // Restore the persisted session on boot.
  useEffect(() => {
    let alive = true;
    loadSession().then((s) => {
      if (!alive) return;
      setUser(s);
      setReady(true);
      if (s?.userId) {
        if (!socket.connected) socket.connect();
        registerUser(s.userId);
        registerForPushNotifications().then((token) => {
          if (token) socket.emit('registerPushToken', { userId: Number(s.userId), pushToken: token });
        }).catch(() => {});
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    const id = user?.userId;
    if (id && socket.connected) socket.emit('logout', { userId: Number(id) });
    socket.disconnect();
    await clearSession();
    setUser(null);
  }, [user?.userId]);

  // When a silent refresh ultimately fails, drop the session.
  useEffect(() => {
    setOnAuthExpired(() => {
      socket.disconnect();
      setUser(null);
    });
    return () => setOnAuthExpired(null);
  }, []);

  const signIn = useCallback(async (s: Session) => {
    await saveSession(s);
    setUser(s);
    if (!socket.connected) socket.connect();
    registerUser(s.userId);
    registerForPushNotifications().then((token) => {
      if (token && s.userId) socket.emit('registerPushToken', { userId: Number(s.userId), pushToken: token });
    }).catch(() => {});
  }, []);

  const updateProfile = useCallback(async (patch: Partial<Session>) => {
    const next = await patchSession(patch);
    if (next) setUser({ ...next });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isReady, isAuthed: !!user?.token, signIn, signOut, updateProfile }),
    [user, isReady, signIn, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

import { createContext, useContext, useEffect, ReactNode } from 'react';
import socket, { registerUser } from '@/lib/socket';
import { useAuth } from './auth';

const SocketContext = createContext(socket);

/** Keeps the socket connected and the user registered while authed. */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.userId) return;
    if (!socket.connected) socket.connect();
    const onConnect = () => registerUser(user.userId);
    socket.on('connect', onConnect);
    registerUser(user.userId);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [user?.userId]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

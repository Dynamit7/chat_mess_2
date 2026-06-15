import { createContext, useContext, useEffect } from "react";
import socket, { registerUser } from "../socket";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(socket);

// Thin provider that ensures the socket is connected & the user registered.
export function SocketProvider({ children }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.userId) return;
    if (!socket.connected) socket.connect();
    const onConnect = () => registerUser(user.userId);
    socket.on("connect", onConnect);
    registerUser(user.userId);
    return () => socket.off("connect", onConnect);
  }, [user?.userId]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import socket, { registerUser } from "../socket";
import { clearListCache } from "../lib/listCache";

const AuthContext = createContext(null);

const load = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  return {
    token,
    userId: Number(localStorage.getItem("userId")),
    username: localStorage.getItem("username") || "",
    nickname: localStorage.getItem("nickname") || "",
    avatar: localStorage.getItem("avatar") || "",
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(load);

  // Persist a successful auth and open the realtime connection.
  const signIn = ({ token, refreshToken, userId, username, nickname, avatar }) => {
    localStorage.setItem("token", token);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("userId", String(userId));
    if (username) localStorage.setItem("username", username);
    if (nickname) localStorage.setItem("nickname", nickname);
    if (avatar) localStorage.setItem("avatar", avatar);
    setUser({ token, userId: Number(userId), username, nickname, avatar });
  };

  const signOut = () => {
    const userId = localStorage.getItem("userId");
    if (userId && socket.connected) socket.emit("logout", { userId: Number(userId) });
    ["token", "refreshToken", "userId", "username", "nickname", "avatar"].forEach((k) =>
      localStorage.removeItem(k)
    );
    clearListCache();
    setUser(null);
    socket.disconnect();
  };

  const updateProfile = (patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      if (patch.username) localStorage.setItem("username", patch.username);
      if (patch.avatar) localStorage.setItem("avatar", patch.avatar);
      return next;
    });
  };

  // Keep the socket connected whenever we have a session.
  useEffect(() => {
    if (user?.userId) {
      if (!socket.connected) socket.connect();
      registerUser(user.userId);
    }
  }, [user?.userId]);

  const value = useMemo(
    () => ({ user, isAuthed: !!user?.token, signIn, signOut, updateProfile }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IClose } from "../components/Icon";

const LightboxContext = createContext(null);

// Fullscreen image viewer. Any component can call useLightbox().open(url) to
// show a picture (e.g. tapping an avatar).
export function LightboxProvider({ children }) {
  const [url, setUrl] = useState(null);
  const open = useCallback((u) => u && setUrl(u), []);
  const close = useCallback(() => setUrl(null), []);

  useEffect(() => {
    if (!url) return;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [url, close]);

  return (
    <LightboxContext.Provider value={{ open, close }}>
      {children}
      <AnimatePresence>
        {url && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <button className="lightbox-close" onClick={close}><IClose size={22} /></button>
            <motion.img
              src={url}
              alt=""
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </LightboxContext.Provider>
  );
}

export const useLightbox = () => {
  const ctx = useContext(LightboxContext);
  // Safe no-op fallback if used outside a provider (e.g. auth screens).
  return ctx || { open: () => {}, close: () => {} };
};

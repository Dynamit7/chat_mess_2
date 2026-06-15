import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IClose } from "./Icon";

// Centered glass modal with backdrop. Closes on Escape / backdrop click.
export default function Modal({ open = true, title, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            className="modal"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {title && (
              <div className="modal-head">
                <h3>{title}</h3>
                <button className="icon-btn" onClick={onClose}><IClose size={18} /></button>
              </div>
            )}
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Generic multi-select helper shared by the chat/group/channel lists and the
 * in-conversation message screens. Holds the active flag plus the set of picked
 * ids; auto-exits once the last item is unselected (Telegram-style).
 */
import { useState, useCallback } from 'react';

export function useSelection<T extends number | string = number>() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<T>>(() => new Set());

  /** Enter selection mode, optionally pre-selecting one id (e.g. the long-pressed row). */
  const enter = useCallback((id?: T) => {
    setActive(true);
    setSelected(id === undefined ? new Set() : new Set([id]));
  }, []);

  const exit = useCallback(() => {
    setActive(false);
    setSelected(new Set());
  }, []);

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setActive(false);
      return next;
    });
  }, []);

  /** Select every id, or clear if everything is already selected. */
  const selectAll = useCallback((ids: T[]) => {
    setSelected((prev) => {
      if (ids.length > 0 && prev.size >= ids.length && ids.every((i) => prev.has(i))) {
        setActive(false);
        return new Set();
      }
      setActive(true);
      return new Set(ids);
    });
  }, []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  return { active, selected, count: selected.size, enter, exit, toggle, selectAll, isSelected };
}

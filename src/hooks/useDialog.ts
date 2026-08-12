import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Accessibility wiring for a modal dialog:
 * - moves focus into the dialog on open (to `[data-autofocus]` if present)
 * - traps Tab focus within the dialog
 * - closes on Escape
 * - restores focus to the previously focused element on close
 *
 * Pair with role="dialog" aria-modal="true" and an aria-labelledby on the
 * container element referenced by `ref`.
 */
export function useDialog(
  isOpen: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = (): HTMLElement[] =>
      container
        ? Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null,
          )
        : [];

    // Prefer an explicitly marked field, else the first focusable element.
    const preferred = container?.querySelector<HTMLElement>('[data-autofocus]');
    (preferred ?? focusables()[0])?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose, ref]);
}

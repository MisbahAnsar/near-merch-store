import { useEffect, useRef } from 'react';

const PERSISTENCE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export const CHECKOUT_FORM_STORAGE_KEY = 'checkout-form-data';

interface PersistedData<T> {
  values: T;
  timestamp: number;
  /** User + cart identity; restore only when this still matches. */
  scope?: string;
}

export function clearFormPersistence(storageKey: string = CHECKOUT_FORM_STORAGE_KEY) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(storageKey);
  }
}

export function useFormPersistence<T extends Record<string, unknown>>(
  form: any,
  storageKey: string,
  options?: {
    enabled?: boolean;
    expireAfterMs?: number;
    /** When set, saved data is restored only if scope still matches. */
    scope?: string;
  }
) {
  const {
    enabled = true,
    expireAfterMs = PERSISTENCE_EXPIRY_MS,
    scope,
  } = options || {};
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const saved = localStorage.getItem(storageKey);
    if (!saved) return;

    try {
      const parsed: PersistedData<T> = JSON.parse(saved);
      const now = Date.now();

      if (now - parsed.timestamp >= expireAfterMs) {
        localStorage.removeItem(storageKey);
        return;
      }

      // Stale or cross-context data (logout / different cart / legacy) — do not fill.
      if (!parsed.scope || !scope || parsed.scope !== scope) {
        localStorage.removeItem(storageKey);
        return;
      }

      isRestoringRef.current = true;
      Object.entries(parsed.values).forEach(([key, value]) => {
        form.setFieldValue(key as any, value);
      });
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 0);
    } catch (e) {
      console.error('[useFormPersistence] Failed to restore form:', e);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, enabled, expireAfterMs, scope]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !scope) return;

    // Always subscribe; skip writes only while restoring (ref is not an effect dep).
    const unsubscribe = form.store.subscribe(() => {
      if (isRestoringRef.current) return;

      const values = form.state.values;
      const hasValues = Object.values(values).some(
        (v) => v !== '' && v !== undefined && v !== null
      );

      if (hasValues) {
        const data: PersistedData<T> = {
          values,
          timestamp: Date.now(),
          scope,
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
      }
    });

    return unsubscribe;
  }, [form, storageKey, enabled, scope]);

  const clearPersistence = () => {
    clearFormPersistence(storageKey);
  };

  return { clearPersistence };
}

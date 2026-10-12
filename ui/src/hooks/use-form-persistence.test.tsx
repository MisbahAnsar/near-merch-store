import { renderHook } from "@testing-library/react";
import { useForm } from "@tanstack/react-form";
import { beforeEach, describe, expect, it } from "vitest";
import { useFormPersistence } from "./use-form-persistence";

function ensureLocalStorage() {
  const store = new Map<string, string>();
  const memoryStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });
  }
}

describe("useFormPersistence", () => {
  beforeEach(() => {
    ensureLocalStorage();
  });

  it("unmounts without throwing after subscribing to the form store", () => {
    const { result, unmount } = renderHook(() => {
      const form = useForm({
        defaultValues: { firstName: "Ada" },
      });
      useFormPersistence(form, "checkout-form-data", {
        enabled: true,
        scope: "user::cart",
      });
      return form;
    });

    const subscription = result.current.store.subscribe(() => {});
    expect(typeof subscription).toBe("object");
    expect(typeof subscription.unsubscribe).toBe("function");
    subscription.unsubscribe();

    expect(() => unmount()).not.toThrow();
  });

  it("persists form values and unsubscribes on unmount", () => {
    const { result, unmount } = renderHook(() => {
      const form = useForm({
        defaultValues: { firstName: "" },
      });
      useFormPersistence(form, "checkout-form-data", {
        enabled: true,
        scope: "user::cart",
      });
      return form;
    });

    result.current.setFieldValue("firstName", "Ada");

    const saved = JSON.parse(localStorage.getItem("checkout-form-data") ?? "{}") as {
      values?: { firstName?: string };
    };
    expect(saved.values?.firstName).toBe("Ada");
    expect(() => unmount()).not.toThrow();
  });
});

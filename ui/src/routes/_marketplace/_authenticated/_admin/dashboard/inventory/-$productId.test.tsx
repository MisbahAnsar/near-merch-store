import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => {
  let attemptNavigation: (() => void) | undefined;

  return {
    navigate: vi.fn(() => attemptNavigation?.()),
    proceed: vi.fn(),
    reset: vi.fn(),
    setAttemptNavigation: (attempt: (() => void) | undefined) => {
      attemptNavigation = attempt;
    },
  };
});

vi.mock("@tanstack/react-router", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  const idleResolver = {
    status: "idle" as const,
    current: undefined,
    next: undefined,
    action: undefined,
    proceed: undefined,
    reset: undefined,
  };
  type TestResolver =
    | typeof idleResolver
    | {
        status: "blocked";
        current: never;
        next: never;
        action: never;
        proceed: () => void;
        reset: () => void;
      };

  return {
    createFileRoute:
      () =>
      (options: { component: () => React.ReactNode }) => ({
        options,
        useParams: () => ({ productId: "product-1" }),
      }),
    useNavigate: () => routerMock.navigate,
    useBlocker: ({
      shouldBlockFn,
    }: {
      shouldBlockFn: () => boolean | Promise<boolean>;
    }) => {
      const [resolver, setResolver] = React.useState<TestResolver>(idleResolver);

      routerMock.setAttemptNavigation(async () => {
        if (!(await shouldBlockFn())) return;

        setResolver({
          status: "blocked",
          current: {} as never,
          next: {} as never,
          action: "PUSH" as never,
          proceed: () => {
            routerMock.proceed();
            setResolver(idleResolver);
          },
          reset: () => {
            routerMock.reset();
            setResolver(idleResolver);
          },
        });
      });

      return resolver;
    },
  };
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: { children: React.ReactNode }) => children,
  DragOverlay: () => null,
  useDraggable: () => ({ ref: vi.fn() }),
  useDroppable: () => ({ ref: vi.fn() }),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    children,
    onOpenChange,
  }: {
    children: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onOpenChange?.(false)}>
        Close sheet overlay
      </button>
      {children}
    </div>
  ),
  SheetContent: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/integrations/api", () => ({
  useProduct: () => ({
    data: {
      product: {
        id: "product-1",
        slug: "test-product",
        title: "Test Product",
        description: "Original description",
        price: 20,
        priceLocked: false,
        images: [],
        variants: [],
      },
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock("@/integrations/api/admin", () => ({
  useUpdateProduct: () => ({ mutate: vi.fn(), isPending: false }),
  useRequestAssetUpload: () => ({ mutateAsync: vi.fn() }),
  useConfirmAssetUpload: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { Route } from "./$productId";

const ProductEditSheet = Route.options.component as ComponentType;

describe("ProductEditSheet unsaved-change guard", () => {
  beforeEach(() => {
    routerMock.navigate.mockClear();
    routerMock.proceed.mockClear();
    routerMock.reset.mockClear();
    routerMock.setAttemptNavigation(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("requests the native browser warning when unsaved changes would be unloaded", async () => {
    render(<ProductEditSheet />);

    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Changed Product" } });

    const beforeUnloadEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnloadEvent);

    expect(beforeUnloadEvent.defaultPrevented).toBe(true);
  });

  it("keeps editing when a close attempt is cancelled", async () => {
    render(<ProductEditSheet />);

    const nameInput = await screen.findByLabelText("Name");
    fireEvent.change(nameInput, { target: { value: "Changed Product" } });
    fireEvent.click(screen.getByRole("button", { name: "Close edit panel" }));

    expect(
      await screen.findByRole("alertdialog", {
        name: "Discard unsaved changes?",
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("alertdialog", {
          name: "Discard unsaved changes?",
        }),
      ).toBeNull();
    });
    expect((nameInput as HTMLInputElement).value).toBe("Changed Product");
    expect(routerMock.reset).toHaveBeenCalledOnce();
    expect(routerMock.proceed).not.toHaveBeenCalled();
  });

  it("continues the blocked navigation when changes are discarded", async () => {
    render(<ProductEditSheet />);

    const description = await screen.findByLabelText("Description");
    fireEvent.change(description, { target: { value: "Changed description" } });
    fireEvent.click(screen.getByRole("button", { name: "Close sheet overlay" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Discard changes" }),
    );

    expect(routerMock.proceed).toHaveBeenCalledOnce();
    expect(routerMock.reset).not.toHaveBeenCalled();
  });
});

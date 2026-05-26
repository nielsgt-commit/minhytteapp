import { type ReactNode } from "react"
import { describe, expect, test, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useMutationWithInvalidation } from "./useMutationWithInvalidation"

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

function wrap(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe("useMutationWithInvalidation", () => {
  test("invalidates the provided query keys after a successful mutation", async () => {
    const queryClient = makeClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<{ ok: true }, Error, { name: string }>(
          { mutationFn: async () => ({ ok: true }) },
          [
            ["user", "me"],
            ["user", "list"],
          ],
        ),
      { wrapper: wrap(queryClient) },
    )

    result.current.mutate({ name: "ada" })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "me"] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["user", "list"] })
  })

  test("still calls the caller's onSuccess after invalidating", async () => {
    const queryClient = makeClient()
    const onSuccess = vi.fn()

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<number>(
          { mutationFn: async () => 42, onSuccess },
          [["thing"]],
        ),
      { wrapper: wrap(queryClient) },
    )

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onSuccess.mock.calls[0]?.[0]).toBe(42)
    expect(onSuccess.mock.calls[0]?.[1]).toBeUndefined()
  })

  test("does not invalidate when the mutation fails", async () => {
    const queryClient = makeClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<never>(
          {
            mutationFn: async () => {
              throw new Error("boom")
            },
          },
          [["thing"]],
        ),
      { wrapper: wrap(queryClient) },
    )

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })

  test("accepts an empty invalidation array (no-op)", async () => {
    const queryClient = makeClient()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(
      () =>
        useMutationWithInvalidation<string>(
          { mutationFn: async () => "ok" },
          [],
        ),
      { wrapper: wrap(queryClient) },
    )

    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

import { describe, expect, test } from "vitest"
import { useQuery } from "@tanstack/react-query"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { renderWithProviders } from "./renderWithProviders.tsx"

function PropertyIdProbe() {
  const id = useAppSelector(selectSelectedPropertyId)
  return <div data-testid="pid">{id ?? "none"}</div>
}

function CacheProbe() {
  const { data } = useQuery({
    queryKey: ["probe"],
    queryFn: async () => "should-not-run",
  })
  return <div data-testid="data">{data ?? "loading"}</div>
}

describe("renderWithProviders", () => {
  test("preloaded Redux state is visible via useAppSelector", () => {
    const { getByTestId } = renderWithProviders(<PropertyIdProbe />, {
      preloadedState: { property: { selectedPropertyId: 42 } },
    })
    expect(getByTestId("pid").textContent).toBe("42")
  })

  test("returns the store so tests can dispatch / inspect", () => {
    const { store } = renderWithProviders(<PropertyIdProbe />)
    expect(store.getState().property.selectedPropertyId).toBeNull()
  })

  test("seed callback can prime the React Query cache", () => {
    const { getByTestId } = renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "from-cache")
      },
    })
    expect(getByTestId("data").textContent).toBe("from-cache")
  })

  test("each render gets an isolated QueryClient", () => {
    const first = renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "a")
      },
    })
    const second = renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "b")
      },
    })
    expect(first.queryClient).not.toBe(second.queryClient)
  })
})

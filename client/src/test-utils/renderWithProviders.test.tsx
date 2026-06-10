import { describe, expect, test } from "vitest"
import { useQuery } from "@tanstack/react-query"
import { useSelectedPropertyId } from "@/selection/useSelection"
import { renderWithProviders } from "./renderWithProviders.tsx"

function PropertyIdProbe() {
  const id = useSelectedPropertyId()
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
  test("initialSearch is visible via useSelectedPropertyId", async () => {
    const { getByTestId } = await renderWithProviders(<PropertyIdProbe />, {
      initialSearch: { property: 42 },
    })
    expect(getByTestId("pid").textContent).toBe("42")
  })

  test("deprecated preloadedState maps onto the search params", async () => {
    const { getByTestId, router } = await renderWithProviders(
      <PropertyIdProbe />,
      {
        preloadedState: {
          property: { selectedPropertyId: 42 },
          user: { selectedUserId: 7 },
        },
      },
    )
    expect(getByTestId("pid").textContent).toBe("42")
    expect(router.state.location.search).toEqual({ property: 42, user: 7 })
  })

  test("returns the router so tests can inspect the location", async () => {
    const { router, getByTestId } = await renderWithProviders(
      <PropertyIdProbe />,
    )
    expect(router.state.location.search).toEqual({})
    expect(getByTestId("pid").textContent).toBe("none")
  })

  test("seed callback can prime the React Query cache", async () => {
    const { getByTestId } = await renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "from-cache")
      },
    })
    expect(getByTestId("data").textContent).toBe("from-cache")
  })

  test("each render gets an isolated QueryClient", async () => {
    const first = await renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "a")
      },
    })
    const second = await renderWithProviders(<CacheProbe />, {
      seed: qc => {
        qc.setQueryData(["probe"], "b")
      },
    })
    expect(first.queryClient).not.toBe(second.queryClient)
  })
})

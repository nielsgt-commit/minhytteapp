import { describe, expect, it } from "vitest"
import { act, render, screen } from "@testing-library/react"
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from "@tanstack/react-router"
import { selectionSearchSchema } from "./searchSchema"
import {
  useSelectedPropertyId,
  useSelectedUserId,
  useSetSelectedPropertyId,
  useSetSelectedUserId,
} from "./useSelection"

function Probe() {
  const propertyId = useSelectedPropertyId()
  const userId = useSelectedUserId()
  const setPropertyId = useSetSelectedPropertyId()
  const setUserId = useSetSelectedUserId()
  return (
    <div>
      <span data-testid="property">{String(propertyId)}</span>
      <span data-testid="user">{String(userId)}</span>
      <button onClick={() => void setPropertyId(42)}>set-property</button>
      <button onClick={() => void setPropertyId(null)}>clear-property</button>
      <button onClick={() => void setUserId(9)}>set-user</button>
    </div>
  )
}

function makeRouter(initialEntry: string) {
  const rootRoute = createRootRoute({
    validateSearch: selectionSearchSchema,
    component: Probe,
  })
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
}

async function renderRouter(initialEntry: string) {
  const router = makeRouter(initialEntry)
  await act(async () => {
    // The test router is structurally independent of the app's Register types.
    render(<RouterProvider router={router as never} />)
  })
  return router
}

describe("useSelection", () => {
  it("reads property and user from search params", async () => {
    await renderRouter("/?property=3&user=7")
    expect(screen.getByTestId("property").textContent).toBe("3")
    expect(screen.getByTestId("user").textContent).toBe("7")
  })

  it("returns null when params are absent", async () => {
    await renderRouter("/")
    expect(screen.getByTestId("property").textContent).toBe("null")
    expect(screen.getByTestId("user").textContent).toBe("null")
  })

  it("setter updates the property search param", async () => {
    const router = await renderRouter("/?user=7")
    await act(async () => {
      screen.getByText("set-property").click()
    })
    expect(router.state.location.search).toEqual({ property: 42, user: 7 })
    expect(screen.getByTestId("property").textContent).toBe("42")
  })

  it("setter with null clears the param", async () => {
    const router = await renderRouter("/?property=3&user=7")
    await act(async () => {
      screen.getByText("clear-property").click()
    })
    expect(router.state.location.search).toEqual({ user: 7 })
    expect(screen.getByTestId("property").textContent).toBe("null")
  })

  it("user setter updates the user search param", async () => {
    const router = await renderRouter("/")
    await act(async () => {
      screen.getByText("set-user").click()
    })
    expect(router.state.location.search).toEqual({ user: 9 })
    expect(screen.getByTestId("user").textContent).toBe("9")
  })
})

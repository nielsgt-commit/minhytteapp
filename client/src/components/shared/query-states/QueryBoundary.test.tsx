import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { QueryBoundary } from "./QueryBoundary"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function Suspends(): ReactNode {
  // Throwing a never-resolving thenable is how React suspends.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new Promise(() => {})
}

function Bomb(): ReactNode {
  throw new Error("boom")
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("QueryBoundary", () => {
  test("renders children", () => {
    render(
      <QueryBoundary>
        <p>content</p>
      </QueryBoundary>,
    )
    expect(screen.getByText("content")).toBeInTheDocument()
  })

  test("renders the default skeleton while suspended", () => {
    render(
      <QueryBoundary>
        <Suspends />
      </QueryBoundary>,
    )
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  test("renders a custom fallback while suspended", () => {
    render(
      <QueryBoundary fallback={<p>custom fallback</p>}>
        <Suspends />
      </QueryBoundary>,
    )
    expect(screen.getByText("custom fallback")).toBeInTheDocument()
  })

  test("catches a thrown error and shows the alert with a retry button", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    render(
      <QueryBoundary>
        <Bomb />
      </QueryBoundary>,
    )
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Something went wrong")
    expect(alert).toHaveTextContent("boom")
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
  })

  test("retry resets the boundary and refetches a failed suspense query", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let calls = 0
    function Loads() {
      const { data } = useSuspenseQuery({
        queryKey: ["query-boundary-test"],
        queryFn: async () => {
          calls++
          if (calls === 1) throw new Error("first attempt failed")
          return "loaded data"
        },
      })
      return <p>{data}</p>
    }

    render(
      <QueryClientProvider client={queryClient}>
        <QueryBoundary>
          <Loads />
        </QueryBoundary>
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("first attempt failed")

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("loaded data")).toBeInTheDocument()
    expect(calls).toBe(2)
  })
})

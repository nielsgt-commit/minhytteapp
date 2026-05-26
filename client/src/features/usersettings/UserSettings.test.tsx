import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, test, vi } from "vitest"
import { UserSettings } from "./UserSettings"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
        : key,
  }),
}))

vi.mock("@/trpc/trpc", () => ({
  useTRPC: () => ({
    user: {
      me: {
        queryKey: () => ["user", "me"],
        queryOptions: () => ({ queryKey: ["user", "me"] }),
      },
      listMyChildren: {
        queryKey: () => ["user", "listMyChildren"],
        queryOptions: () => ({ queryKey: ["user", "listMyChildren"] }),
      },
      updateMyName: { mutationOptions: (opts: unknown) => opts },
      updateMyBirthday: { mutationOptions: (opts: unknown) => opts },
      updateMyIsHead: { mutationOptions: (opts: unknown) => opts },
      createChild: { mutationOptions: (opts: unknown) => opts },
      updateChild: { mutationOptions: (opts: unknown) => opts },
      removeChild: { mutationOptions: (opts: unknown) => opts },
    },
  }),
}))

let meData:
  | { id: number; name: string; birthday: string | null; is_head: boolean }
  | undefined

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (opts: { queryKey?: unknown[] }) => {
    if (Array.isArray(opts.queryKey) && opts.queryKey[1] === "me") {
      return { data: meData }
    }
    return { data: [] }
  },
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

beforeEach(() => {
  meData = undefined
})

describe("UserSettings", () => {
  test("shows loading text when `me` is undefined", () => {
    render(<UserSettings />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
  })

  test("renders the user-settings heading once `me` loads", () => {
    meData = { id: 1, name: "Alice", birthday: null, is_head: false }
    render(<UserSettings />)
    expect(
      screen.getByRole("heading", { level: 2, name: "User settings" }),
    ).toBeInTheDocument()
  })

  test("renders the ProfileSection name input bound to me.name", () => {
    meData = { id: 2, name: "Bob", birthday: null, is_head: false }
    render(<UserSettings />)
    // Two "Name" inputs render: ProfileSection display name (first) + ChildrenSection add-child.
    const nameInputs = screen.getAllByLabelText("Name")
    expect(nameInputs[0]).toHaveValue("Bob")
  })

  test("renders the ChildrenSection heading", () => {
    meData = { id: 3, name: "Carol", birthday: null, is_head: false }
    render(<UserSettings />)
    expect(screen.getByText("My children (under 13)")).toBeInTheDocument()
  })

  test("does not render Loading text once data is present", () => {
    meData = { id: 4, name: "Dan", birthday: null, is_head: true }
    render(<UserSettings />)
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
  })
})

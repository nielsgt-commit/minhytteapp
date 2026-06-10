import { render, screen } from "@testing-library/react"
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"
import { UserSettings } from "./UserSettings"

// jsdom does not implement <dialog> methods; the PageHelp dialog calls them.
beforeAll(() => {
  HTMLDialogElement.prototype.show = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn()
  HTMLDialogElement.prototype.close = vi.fn()
})

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
      updateMyHeadForProperty: { mutationOptions: (opts: unknown) => opts },
      createChild: { mutationOptions: (opts: unknown) => opts },
      updateChild: { mutationOptions: (opts: unknown) => opts },
      removeChild: { mutationOptions: (opts: unknown) => opts },
    },
  }),
}))

let meData:
  | {
      id: number
      name: string
      birthday: string | null
      my_main_memberships: {
        property_id: number
        property_name: string
        user_group_id: number
        is_head: boolean
      }[]
    }
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
  test("shows a loading skeleton when `me` is undefined", () => {
    render(<UserSettings />)
    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  test("renders the user-settings heading once `me` loads", () => {
    meData = { id: 1, name: "Alice", birthday: null, my_main_memberships: [] }
    render(<UserSettings />)
    expect(
      screen.getByRole("heading", { level: 2, name: "User settings" }),
    ).toBeInTheDocument()
  })

  test("renders the ProfileSection name input bound to me.name", () => {
    meData = { id: 2, name: "Bob", birthday: null, my_main_memberships: [] }
    render(<UserSettings />)
    // Two "Name" inputs render: ProfileSection display name (first) + ChildrenSection add-child.
    const nameInputs = screen.getAllByLabelText("Name")
    expect(nameInputs[0]).toHaveValue("Bob")
  })

  test("renders the ChildrenSection heading", () => {
    meData = { id: 3, name: "Carol", birthday: null, my_main_memberships: [] }
    render(<UserSettings />)
    expect(screen.getByText("My children (under 13)")).toBeInTheDocument()
  })

  test("does not render the loading skeleton once data is present", () => {
    meData = { id: 4, name: "Dan", birthday: null, my_main_memberships: [] }
    render(<UserSettings />)
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument()
  })
})

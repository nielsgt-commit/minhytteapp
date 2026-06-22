import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SplitPolicyBuilder } from "./SplitPolicyBuilder"
import { SplitPolicyProvider } from "./SplitPolicyContext"

vi.mock("@/selection/useSelection", () => ({
  useSelectedPropertyId: () => 1,
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && "list" in opts ? `${key}:${String(opts.list)}` : key,
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => <span>{i18nKey}</span>,
}))

const mutateAsyncSpy = vi.fn().mockResolvedValue({ id: 99 })

vi.mock("@/hooks/useMutationWithInvalidation", () => ({
  useMutationWithInvalidation: () => ({
    mutateAsync: (vars: unknown) => mutateAsyncSpy(vars),
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}))

const DATA: Record<string, unknown> = {
  properties: [{ id: 1, name: "Hytta" }],
  policies: [],
  groups: [
    {
      id: 1,
      name: "Fam",
      is_family: true,
      members: [{ user_id: 1, user_name: "Niels" }],
    },
  ],
  categories: [],
  me: { id: 1, is_admin: true },
  priority: { eligibleOwners: [] },
}

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: (opts: { __key: string }) => ({ data: DATA[opts.__key] }),
}))

vi.mock("@/trpc/trpc", () => ({
  useTRPC: () => ({
    propertySplitPolicy: {
      listForProperty: { queryOptions: () => ({ __key: "policies" }) },
      save: { mutationOptions: (o?: unknown) => o ?? {} },
      delete: { mutationOptions: (o?: unknown) => o ?? {} },
      updateOccupancy: { mutationOptions: (o?: unknown) => o ?? {} },
      pathKey: () => ["propertySplitPolicy"],
    },
    userGroup: {
      listWithMembersForProperty: {
        queryOptions: () => ({ __key: "groups" }),
      },
    },
    expenseCategory: {
      listAllForDisplay: { queryOptions: () => ({ __key: "categories" }) },
    },
    user: { me: { queryOptions: () => ({ __key: "me" }) } },
    priority: { list: { queryOptions: () => ({ __key: "priority" }) } },
    property: { mine: { queryOptions: () => ({ __key: "properties" }) } },
  }),
}))

beforeEach(() => {
  mutateAsyncSpy.mockClear()
})

async function nameAndSave() {
  await userEvent.type(screen.getByLabelText("Name"), "Test policy")
  await userEvent.click(screen.getByRole("button", { name: "Save policy" }))
}

describe("SplitPolicyBuilder save", () => {
  test("naming the policy and clicking Save calls the save mutation", async () => {
    render(
      <SplitPolicyProvider>
        <SplitPolicyBuilder />
      </SplitPolicyProvider>,
    )
    await nameAndSave()
    expect(mutateAsyncSpy).toHaveBeenCalledTimes(1)
    expect(mutateAsyncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        property_id: 1,
        name: "Test policy",
        // Parameters are derived from what the config actually uses. The default
        // policy (one "all categories (totals)" rule split equally) only needs
        // expense_categories + participants — not booking_days/ownership/time.
        config: expect.objectContaining({
          parameters: ["expense_categories", "participants"],
        }),
      }),
    )
  })

  test("save does not submit an outer form (nested in SettlementForm)", async () => {
    const outerSubmit = vi.fn()
    render(
      <form action={outerSubmit}>
        <SplitPolicyProvider>
          <SplitPolicyBuilder />
        </SplitPolicyProvider>
      </form>,
    )
    await nameAndSave()
    expect(mutateAsyncSpy).toHaveBeenCalledTimes(1)
    expect(outerSubmit).not.toHaveBeenCalled()
  })
})

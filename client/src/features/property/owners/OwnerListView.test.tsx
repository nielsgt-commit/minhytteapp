import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { OwnerListView } from "./OwnerListView.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars
        ? key.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ""))
        : key,
  }),
}))

const userOwner = {
  id: 1,
  user_id: 7,
  user_group_id: null,
  user_name: "Alice",
  user_group_name: null,
  ownership_pct: 60,
}

const groupOwner = {
  id: 2,
  user_id: null,
  user_group_id: 3,
  user_name: null,
  user_group_name: "Family",
  ownership_pct: 40,
}

const noop = () => {}

describe("OwnerListView", () => {
  test("renders empty state when there are no owners", () => {
    render(
      <OwnerListView
        owners={[]}
        canEdit={true}
        pending={false}
        onPctSave={noop}
        onRemove={noop}
        onStartAdd={noop}
      />,
    )
    expect(screen.getByText("No owners yet.")).toBeInTheDocument()
  })

  test("renders one row per owner with name and User/Group tag", () => {
    render(
      <OwnerListView
        owners={[userOwner, groupOwner]}
        canEdit={false}
        pending={false}
        onPctSave={noop}
        onRemove={noop}
        onStartAdd={noop}
      />,
    )
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Family")).toBeInTheDocument()
    expect(screen.getByText("User")).toBeInTheDocument()
    expect(screen.getByText("Group")).toBeInTheDocument()
  })

  test("hides Delete and Add buttons when canEdit is false", () => {
    render(
      <OwnerListView
        owners={[userOwner]}
        canEdit={false}
        pending={false}
        onPctSave={noop}
        onRemove={noop}
        onStartAdd={noop}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "+ Add owner" }),
    ).not.toBeInTheDocument()
  })

  test("clicking + Add owner invokes onStartAdd", async () => {
    const onStartAdd = vi.fn()
    const user = userEvent.setup()
    render(
      <OwnerListView
        owners={[]}
        canEdit={true}
        pending={false}
        onPctSave={noop}
        onRemove={noop}
        onStartAdd={onStartAdd}
      />,
    )
    await user.click(screen.getByRole("button", { name: "+ Add owner" }))
    expect(onStartAdd).toHaveBeenCalledTimes(1)
  })

  test("clicking Delete calls onRemove with the owner", async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <OwnerListView
        owners={[userOwner]}
        canEdit={true}
        pending={false}
        onPctSave={noop}
        onRemove={onRemove}
        onStartAdd={noop}
      />,
    )
    await user.click(
      screen.getByRole("button", { name: "Remove Alice as owner?" }),
    )
    expect(onRemove).toHaveBeenCalledWith(userOwner)
  })

  test("disables Delete and Add buttons when pending", () => {
    render(
      <OwnerListView
        owners={[userOwner]}
        canEdit={true}
        pending={true}
        onPctSave={noop}
        onRemove={noop}
        onStartAdd={noop}
      />,
    )
    expect(
      screen.getByRole("button", { name: "Remove Alice as owner?" }),
    ).toBeDisabled()
    expect(screen.getByRole("button", { name: "+ Add owner" })).toBeDisabled()
  })
})

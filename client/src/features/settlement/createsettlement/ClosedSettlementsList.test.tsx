import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Temporal } from "temporal-polyfill"
import {
  ClosedSettlementsList,
  type SettlementRow,
} from "./ClosedSettlementsList"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const ROW: SettlementRow = {
  id: 42,
  year: 2025,
  season: "summer",
  status: "closed",
  split_policy: "occupancy_days",
  split_policy_id: null,
  closed_at: Temporal.Instant.from("2025-09-01T10:00:00Z"),
}

describe("ClosedSettlementsList", () => {
  test("renders empty-state copy when there are no settlements", () => {
    render(
      <ClosedSettlementsList
        settlements={[]}
        expandedId={null}
        setExpandedId={() => {}}
        isHead={true}
        pending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText("No closed settlements yet.")).toBeInTheDocument()
  })

  test("renders year (season) and a View button per row", () => {
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={null}
        setExpandedId={() => {}}
        isHead={false}
        pending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByText("2025 (summer)")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument()
  })

  test("hides Edit / Delete buttons when isHead is false", () => {
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={null}
        setExpandedId={() => {}}
        isHead={false}
        pending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(
      screen.queryByRole("button", { name: "Edit" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument()
  })

  test("clicking Edit fires onEdit with the row, Delete fires onDelete with the id", async () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={null}
        setExpandedId={() => {}}
        isHead={true}
        pending={false}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onEdit).toHaveBeenCalledWith(ROW)
    expect(onDelete).toHaveBeenCalledWith(42)
  })

  test("clicking View toggles expandedId via setExpandedId", async () => {
    const setExpandedId = vi.fn()
    const user = userEvent.setup()
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={null}
        setExpandedId={setExpandedId}
        isHead={false}
        pending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    await user.click(screen.getByRole("button", { name: "View" }))
    expect(setExpandedId).toHaveBeenCalledWith(42)
  })

  test("shows 'View' when this row is not the expandedId", () => {
    // Note: when expandedId === row.id, the row renders <ClosedSettlementSummary>
    // which requires a TRPCProvider — out of scope for a presentational test.
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={999}
        setExpandedId={() => {}}
        isHead={false}
        pending={false}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Hide" }),
    ).not.toBeInTheDocument()
  })

  test("Edit / Delete are disabled when pending", () => {
    render(
      <ClosedSettlementsList
        settlements={[ROW]}
        expandedId={null}
        setExpandedId={() => {}}
        isHead={true}
        pending={true}
        onEdit={() => {}}
        onDelete={() => {}}
      />,
    )
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})

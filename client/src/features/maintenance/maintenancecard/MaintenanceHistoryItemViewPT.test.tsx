import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"
import { Temporal } from "temporal-polyfill"
import {
  MaintenanceHistoryItemViewPT,
  type MaintenanceHistoryItemViewPTData,
} from "./MaintenanceHistoryItemViewPT.tsx"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${JSON.stringify(opts)}` : key,
    i18n: { language: "en" },
  }),
  Trans: ({
    values,
    i18nKey,
  }: {
    values?: Record<string, unknown>
    i18nKey: string
  }) => `${i18nKey} ${JSON.stringify(values)}`,
}))

const baseItem: MaintenanceHistoryItemViewPTData = {
  id: 11,
  description: "Replace gutter",
  instructions_pt: null,
  completed_at: Temporal.Instant.from("2026-03-15T12:00:00.000Z"),
  severity: "minor",
}

function setup(opts?: {
  item?: MaintenanceHistoryItemViewPTData
  pending?: boolean
  isDeleting?: boolean
  deletingTyped?: string
}) {
  const handlers = {
    onStartEdit: vi.fn(),
    onStartDelete: vi.fn(),
    onChangeTyped: vi.fn(),
    onConfirmDelete: vi.fn(),
    onCancelDelete: vi.fn(),
    onCycleSeverity: vi.fn(),
  }
  render(
    <MaintenanceHistoryItemViewPT
      item={opts?.item ?? baseItem}
      pending={opts?.pending ?? false}
      isDeleting={opts?.isDeleting ?? false}
      deletingTyped={opts?.deletingTyped ?? ""}
      {...handlers}
    />,
  )
  return handlers
}

describe("MaintenanceHistoryItemViewPT", () => {
  test("renders the description", () => {
    setup()
    expect(screen.getByText("Replace gutter")).toBeInTheDocument()
  })

  test("hides the Show execution chip when there are no instructions", () => {
    setup()
    expect(
      screen.queryByRole("button", { name: "Show execution" }),
    ).not.toBeInTheDocument()
  })

  test("shows the Show execution chip when instructions are present", () => {
    setup({
      item: {
        ...baseItem,
        instructions_pt: [
          {
            _type: "block",
            _key: "k",
            style: "normal",
            markDefs: [],
            children: [{ _type: "span", _key: "s", text: "Step 1", marks: [] }],
          },
        ],
      },
    })
    expect(
      screen.getByRole("button", { name: "Show execution" }),
    ).toBeInTheDocument()
  })

  test("Edit and Delete buttons fire their handlers", async () => {
    const user = userEvent.setup()
    const { onStartEdit, onStartDelete } = setup()
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))
    expect(onStartEdit).toHaveBeenCalledTimes(1)
    expect(onStartDelete).toHaveBeenCalledTimes(1)
  })

  test("Confirm delete is disabled until typed description matches", () => {
    setup({ isDeleting: true, deletingTyped: "wrong" })
    expect(
      screen.getByRole("button", { name: "Confirm delete" }),
    ).toBeDisabled()
  })

  test("Confirm delete is enabled when typed matches the description", () => {
    setup({ isDeleting: true, deletingTyped: baseItem.description })
    expect(
      screen.getByRole("button", { name: "Confirm delete" }),
    ).not.toBeDisabled()
  })

  test("Delete button is hidden while in deleting state", () => {
    setup({ isDeleting: true, deletingTyped: "" })
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
  })

  test("Edit and Delete buttons are disabled while pending", () => {
    setup({ pending: true })
    expect(screen.getByRole("button", { name: "Edit" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled()
  })
})

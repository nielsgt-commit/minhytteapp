import { type SyntheticEvent, useState } from "react"
import {
  Button,
  Divider,
  Dropdown,
  Label,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { ChevronDownIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./PropertySwitcher.module.css"

export type Property = {
  id: number
  name: string
}

type Props = {
  properties: Property[]
  value: number | null
  onChange: (propertyId: number) => void
  isAddOpen: boolean
  onAddOpenChange: (open: boolean) => void
  onAdd: (name: string) => void
  onManageProperty: () => void
  isAddPending?: boolean
  addError?: string | null
}

export function PropertySwitcher({
  properties,
  value,
  onChange,
  isAddOpen,
  onAddOpenChange,
  onAdd,
  onManageProperty,
  isAddPending,
  addError,
}: Props) {
  const { t } = useTranslation("core")
  const current = properties.find(p => p.id === value)
  const triggerLabel = current?.name ?? t("Select property")

  const [isOpen, setIsOpen] = useState(false)

  // The name field is uncontrolled and read via FormData on submit. The form
  // only renders while the add panel is open, so closing the panel discards
  // the typed value without any state syncing.
  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const raw = new FormData(e.currentTarget).get("name")
    const trimmed = typeof raw === "string" ? raw.trim() : ""
    if (!trimmed) return
    onAdd(trimmed)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <Label id="property-switcher-label" className={styles.label}></Label>
      <Dropdown.TriggerContext>
        <Dropdown.Trigger
          variant="tertiary"
          data-color="neutral"
          aria-labelledby="property-switcher-label"
        >
          {triggerLabel}
          <ChevronDownIcon
            aria-hidden
            style={{
              transition: "transform 150ms ease",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        </Dropdown.Trigger>
        <Dropdown
          placement="bottom-start"
          open={isOpen}
          onOpen={() => {
            setIsOpen(true)
          }}
          onClose={() => {
            setIsOpen(false)
          }}
        >
          {isAddOpen ? (
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.5rem",
              }}
            >
              <Textfield
                label={t("New property name")}
                name="name"
                autoFocus
                required
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Button type="submit" loading={isAddPending}>
                  {t("Save")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isAddPending}
                  onClick={() => {
                    onAddOpenChange(false)
                  }}
                >
                  {t("Cancel")}
                </Button>
              </div>
              {addError && (
                <Paragraph data-color="danger" role="alert">
                  {t("Error: {{message}}", { message: addError })}
                </Paragraph>
              )}
            </form>
          ) : (
            <Dropdown.List>
              {properties.length === 0 && (
                <Dropdown.Item>
                  <span>{t("No properties")}</span>
                </Dropdown.Item>
              )}
              {properties.map(p => (
                <Dropdown.Item key={p.id}>
                  <Dropdown.Button
                    onClick={() => {
                      onChange(p.id)
                    }}
                  >
                    {p.name}
                  </Dropdown.Button>
                </Dropdown.Item>
              ))}
              <Divider />
              <Dropdown.Item>
                <Dropdown.Button
                  onClick={() => {
                    onAddOpenChange(true)
                  }}
                >
                  {t("+ Add property")}
                </Dropdown.Button>
              </Dropdown.Item>
              <Divider />
              <Dropdown.Item>
                <Dropdown.Button onClick={onManageProperty}>
                  {t("Manage Property")}
                </Dropdown.Button>
              </Dropdown.Item>
            </Dropdown.List>
          )}
        </Dropdown>
      </Dropdown.TriggerContext>
    </div>
  )
}

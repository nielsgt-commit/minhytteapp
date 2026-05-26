import {
  Button,
  Chip,
  Fieldset,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SubmitButton } from "@/components/shared/SubmitButton"
import styles from "./OwnerAddForm.module.css"

type AddKind = "user" | "group"

type UserOption = { id: number; name: string }
type GroupOption = { id: number; name: string; members: unknown[] }

type Props = {
  addKind: AddKind
  pending: boolean
  addDisabled: boolean
  availableUsers: UserOption[]
  availableGroups: GroupOption[]
  totalGroups: number
  onKindChange: (kind: AddKind) => void
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}

export function OwnerAddForm({
  addKind,
  pending,
  addDisabled,
  availableUsers,
  availableGroups,
  totalGroups,
  onKindChange,
  onSubmit,
  onCancel,
}: Props) {
  const { t } = useTranslation("property")
  return (
    <form
      action={onSubmit}
      key={`add-${addKind}`}
      className={styles.form}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Add owner")}</Fieldset.Legend>
        <div className={styles.chipRow}>
          <Chip.Radio
            name="kind"
            value="user"
            checked={addKind === "user"}
            onChange={() => { onKindChange("user") }}
          >
            {t("User")}
          </Chip.Radio>
          <Chip.Radio
            name="kind"
            value="group"
            checked={addKind === "group"}
            onChange={() => { onKindChange("group") }}
          >
            {t("Group")}
          </Chip.Radio>
        </div>

        {addKind === "user" ? (
          <div className={styles.fieldGroup}>
            <Label htmlFor="add-owner-user">{t("User")}</Label>
            <Select
              id="add-owner-user"
              name="user_id"
              required
              defaultValue=""
              disabled={pending || availableUsers.length === 0}
            >
              <Select.Option value="" disabled>
                {t("Select user")}
              </Select.Option>
              {availableUsers.map(u => (
                <Select.Option key={u.id} value={String(u.id)}>
                  {u.name}
                </Select.Option>
              ))}
            </Select>
            {availableUsers.length === 0 && (
              <p>
                <em>{t("All users are already owners.")}</em>
              </p>
            )}
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <Label htmlFor="add-owner-group">{t("Group")}</Label>
            <Select
              id="add-owner-group"
              name="user_group_id"
              required
              defaultValue=""
              disabled={pending || availableGroups.length === 0}
            >
              <Select.Option value="" disabled>
                {t("Select group")}
              </Select.Option>
              {availableGroups.map(g => (
                <Select.Option key={g.id} value={String(g.id)}>
                  {g.members.length === 1
                    ? t("{{name}} ({{count}} member)", { name: g.name, count: g.members.length })
                    : t("{{name}} ({{count}} members)", { name: g.name, count: g.members.length })}
                </Select.Option>
              ))}
            </Select>
            {availableGroups.length === 0 && (
              <p>
                <em>
                  {t("No available groups.")}{" "}
                  {totalGroups === 0
                    ? t("Create one from Manage user groups.")
                    : t("All groups are already owners.")}
                </em>
              </p>
            )}
          </div>
        )}

        <Textfield
          label={t("Ownership %")}
          name="ownership_pct"
          type="number"
          min={0}
          max={100}
          step={0.01}
          defaultValue={0}
          required
          disabled={pending}
        />

        <div className={styles.actions}>
          <SubmitButton disabled={addDisabled}>{t("Add owner")}</SubmitButton>
          <Button
            type="button"
            variant="tertiary"
            disabled={pending}
            onClick={onCancel}
          >
            {t("Cancel")}
          </Button>
        </div>
      </Fieldset>
    </form>
  )
}

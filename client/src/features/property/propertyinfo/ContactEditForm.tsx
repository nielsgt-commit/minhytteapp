import { type SyntheticEvent } from "react"
import { Button, Fieldset, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./ContactEditForm.module.css"

type Contact = {
  id: number
  property_id: number
  name: string
  phone: string | null
  email: string | null
  info: string | null
}

type Props = {
  contact: Contact
  pending: boolean
  updatePending: boolean
  onSubmit: (e: SyntheticEvent<HTMLFormElement>) => void
  onDelete: () => void
  onCancel: () => void
}

export function ContactEditForm({
  contact,
  pending,
  updatePending,
  onSubmit,
  onDelete,
  onCancel,
}: Props) {
  const { t } = useTranslation("property")
  return (
    <form
      onSubmit={onSubmit}
      key={`edit-${String(contact.id)}`}
      className={styles.form}
    >
      <Fieldset>
        <Fieldset.Legend>{t("Edit contact")}</Fieldset.Legend>
        <Textfield
          label={t("Name")}
          name="name"
          required
          autoFocus
          maxLength={255}
          defaultValue={contact.name}
          disabled={updatePending}
        />
        <Textfield
          label={t("Phone")}
          name="phone"
          type="tel"
          maxLength={64}
          defaultValue={contact.phone ?? ""}
          disabled={updatePending}
        />
        <Textfield
          label={t("Email")}
          name="email"
          type="email"
          maxLength={255}
          defaultValue={contact.email ?? ""}
          disabled={updatePending}
        />
        <Textfield
          label={t("Info")}
          name="info"
          multiline
          rows={3}
          maxLength={1024}
          defaultValue={contact.info ?? ""}
          disabled={updatePending}
        />
        <div className={styles.actions}>
          <Button type="submit" disabled={pending}>
            {t("Save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            data-color="danger"
            disabled={pending}
            onClick={onDelete}
          >
            {t("Remove")}
          </Button>
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

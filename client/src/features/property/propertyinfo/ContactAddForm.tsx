import {
  Button,
  Fieldset,
  Paragraph,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import { SubmitButton } from "@/components/shared/SubmitButton"
import styles from "./ContactAddForm.module.css"

type Props = {
  createPending: boolean
  onSubmit: (fd: FormData) => Promise<void>
  onCancel: () => void
}

export function ContactAddForm({ createPending, onSubmit, onCancel }: Props) {
  const { t } = useTranslation("property")
  return (
    <>
      <Paragraph data-weight="medium">{t("Add contact")}</Paragraph>
      <form action={onSubmit} className={styles.form}>
        <Fieldset>
          <Fieldset.Legend>{t("New contact")}</Fieldset.Legend>
          <Textfield
            label={t("Name")}
            name="name"
            required
            autoFocus
            maxLength={255}
            disabled={createPending}
          />
          <Textfield
            label={t("Phone")}
            name="phone"
            type="tel"
            maxLength={64}
            disabled={createPending}
          />
          <Textfield
            label={t("Email")}
            name="email"
            type="email"
            maxLength={255}
            disabled={createPending}
          />
          <Textfield
            label={t("Info")}
            name="info"
            multiline
            rows={3}
            maxLength={1024}
            disabled={createPending}
          />
          <div className={styles.actions}>
            <SubmitButton disabled={createPending}>
              {t("Add contact")}
            </SubmitButton>
            <Button
              type="button"
              variant="tertiary"
              disabled={createPending}
              onClick={onCancel}
            >
              {t("Cancel")}
            </Button>
          </div>
        </Fieldset>
      </form>
    </>
  )
}

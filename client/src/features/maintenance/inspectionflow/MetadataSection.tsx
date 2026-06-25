import { Field, Label, Select } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./InspectionFlow.module.css"

export type Recurrence = "yearly" | "5year" | "spring" | "fall"

export function MetadataSection() {
  const { t } = useTranslation("maintenance")
  return (
    <div className={styles.section}>
      <Field>
        <Label>{t("Cadence")}</Label>
        <Select name="recurrence" defaultValue="yearly">
          <Select.Option value="yearly">{t("Yearly")}</Select.Option>
          <Select.Option value="5year">{t("Every 5 years")}</Select.Option>
          <Select.Option value="spring">{t("Every spring")}</Select.Option>
          <Select.Option value="fall">{t("Every fall")}</Select.Option>
        </Select>
      </Field>
    </div>
  )
}

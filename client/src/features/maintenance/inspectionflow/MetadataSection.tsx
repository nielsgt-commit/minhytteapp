import {
  Field,
  Label,
  Select,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./InspectionFlow.module.css"

export type Recurrence = "once" | "yearly" | "5year"

export function MetadataSection(props: {
  inspectedBy: string
  setInspectedBy: (value: string) => void
  recurrence: Recurrence
  setRecurrence: (value: Recurrence) => void
}) {
  const { inspectedBy, setInspectedBy, recurrence, setRecurrence } = props
  return (
    <div className={styles.section}>
      <Textfield
        label="Inspected by"
        name="inspected_by"
        value={inspectedBy}
        onChange={e => { setInspectedBy(e.target.value) }}
        required
      />
      <Field>
        <Label>Cadence</Label>
        <Select
          value={recurrence}
          onChange={e => { setRecurrence(e.target.value as Recurrence) }}
        >
          <Select.Option value="once">Once</Select.Option>
          <Select.Option value="yearly">Yearly</Select.Option>
          <Select.Option value="5year">Every 5 years</Select.Option>
        </Select>
      </Field>
    </div>
  )
}

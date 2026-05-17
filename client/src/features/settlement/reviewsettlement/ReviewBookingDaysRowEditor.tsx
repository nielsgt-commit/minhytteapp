import { Button, Chip, Textfield } from "@digdir/designsystemet-react"
import styles from "./ReviewBookingDays.module.css"

export type DraftOccupant =
  | { kind: "user"; user_id: number; name: string; room_id: number | null }
  | { kind: "guest"; name: string }

export type UserOption = { id: number; name: string }

type EditDatesProps = {
  draftStart: string
  draftEnd: string
  onChangeStart: (v: string) => void
  onChangeEnd: (v: string) => void
}

export function EditDates({
  draftStart,
  draftEnd,
  onChangeStart,
  onChangeEnd,
}: EditDatesProps) {
  return (
    <div className={styles.editDates}>
      <Textfield
        label="From"
        data-size="sm"
        className={styles.dateField}
        type="date"
        value={draftStart}
        onChange={e => { onChangeStart(e.target.value) }}
      />
      <Textfield
        label="To"
        data-size="sm"
        className={styles.dateField}
        type="date"
        value={draftEnd}
        min={draftStart}
        onChange={e => { onChangeEnd(e.target.value) }}
      />
    </div>
  )
}

type ChipInputProps = {
  drafts: DraftOccupant[]
  inputValue: string
  setInputValue: (v: string) => void
  users: UserOption[]
  datalistId: string
  onRemoveAt: (index: number) => void
  onCommit: () => void
}

export function OccupantChipInput({
  drafts,
  inputValue,
  setInputValue,
  users,
  datalistId,
  onRemoveAt,
  onCommit,
}: ChipInputProps) {
  return (
    <div className={styles.chipInput}>
      {drafts.map((d, i) => (
        <span
          key={`${d.kind}-${d.kind === "user" ? String(d.user_id) : d.name}-${String(i)}`}
          data-color={d.kind === "user" ? "neutral" : "warning"}
          className={styles.chipWrap}
        >
          <Chip.Removable
            aria-label={`Remove ${d.name}`}
            data-size="sm"
            onClick={() => { onRemoveAt(i) }}
          >
            {d.name}
          </Chip.Removable>
        </span>
      ))}
      <input
        className={styles.chipInputField}
        type="text"
        list={datalistId}
        value={inputValue}
        placeholder="Add occupant…"
        onChange={e => { setInputValue(e.target.value) }}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault()
            onCommit()
          } else if (
            e.key === "Backspace"
            && inputValue === ""
            && drafts.length > 0
          ) {
            e.preventDefault()
            onRemoveAt(drafts.length - 1)
          }
        }}
        onBlur={() => { onCommit() }}
      />
      <datalist id={datalistId}>
        {users.map(u => (
          <option key={u.id} value={u.name} />
        ))}
      </datalist>
    </div>
  )
}

type EditActionsProps = {
  onSave: () => void
  onCancel: () => void
  saving: boolean
  bookerMissing: boolean
}

export function EditActions({
  onSave,
  onCancel,
  saving,
  bookerMissing,
}: EditActionsProps) {
  return (
    <div className={styles.editButtons}>
      <Button
        variant="secondary"
        data-size="sm"
        type="button"
        onClick={() => { onSave() }}
        disabled={saving || bookerMissing}
      >
        Save
      </Button>
      <Button
        variant="tertiary"
        data-size="sm"
        type="button"
        onClick={() => { onCancel() }}
        disabled={saving}
      >
        Cancel
      </Button>
    </div>
  )
}

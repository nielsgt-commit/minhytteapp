import { Select, Switch } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./OccupancyCounting.module.css"
import {
  CHILD_WEIGHTS,
  type EligibleOwner,
  type OccupancyWindow,
  type SplitPolicyOccupancy,
  WINDOW_LABEL,
  childWeightLabel,
  decodeWindow,
  describeWindow,
  encodeWindow,
} from "./types"

// Section 2 of the builder: how a person-day is *counted*. One shared definition
// per policy, shown only when some rule splits `by person-days`. Separated from
// the split itself so "who pays" and "how days are tallied" stay distinct.
export type OccupancyEdit = {
  pending: boolean
  windowKinds: Set<OccupancyWindow["kind"]>
  extraGuests: boolean
  onPatch: (patch: Partial<SplitPolicyOccupancy>) => void
}

type Props = {
  occupancy: SplitPolicyOccupancy
  eligibleOwners: EligibleOwner[]
  edit?: OccupancyEdit
  // The standalone panel supplies its own heading, so it hides the inline label.
  showLabel?: boolean
}

export function OccupancyCounting({
  occupancy,
  eligibleOwners,
  edit,
  showLabel = true,
}: Props) {
  const { t } = useTranslation("settlement")
  const tk = t as (k: string) => string

  const showPriorityWeeks =
    (edit?.windowKinds.has("priority_week") ?? false) &&
    eligibleOwners.length > 0

  return (
    <div className={styles.block}>
      {showLabel && (
        <span className={styles.label}>{t("Counting person-days")}</span>
      )}
      <p className={styles.sentence}>
        {/* window */}
        {t("Count one person-day per night a person stays")}{" "}
        {edit != null ? (
          <Select
            aria-label={t("Which stays count")}
            data-size="sm"
            value={encodeWindow(occupancy.window)}
            disabled={edit.pending}
            onChange={e => {
              edit.onPatch({ window: decodeWindow(e.target.value) })
            }}
          >
            {Object.entries(WINDOW_LABEL)
              .filter(([value]) =>
                edit.windowKinds.has(value as keyof typeof WINDOW_LABEL),
              )
              .map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {tk(label)}
                </Select.Option>
              ))}
            {showPriorityWeeks && (
              <Select.Optgroup label={t("Specific priority week")}>
                {eligibleOwners.map(o => {
                  const enc = `priority_week:${String(o.user_group_id)}`
                  return (
                    <Select.Option key={enc} value={enc}>
                      {t("{{name}}'s priority week", {
                        name: o.user_group_name,
                      })}
                    </Select.Option>
                  )
                })}
              </Select.Optgroup>
            )}
          </Select>
        ) : (
          <strong>{describeWindow(occupancy.window, eligibleOwners)}</strong>
        )}
        {/* children */}
        {". "}
        {t("Children count as")}{" "}
        {edit != null ? (
          <Select
            aria-label={t("Child weight")}
            data-size="sm"
            value={String(occupancy.child_weight)}
            disabled={edit.pending}
            onChange={e => {
              edit.onPatch({ child_weight: Number(e.target.value) })
            }}
          >
            {CHILD_WEIGHTS.map(w => (
              <Select.Option key={w} value={String(w)}>
                {tk(childWeightLabel(w))}
              </Select.Option>
            ))}
          </Select>
        ) : (
          <strong>{tk(childWeightLabel(occupancy.child_weight))}</strong>
        )}
        {"."}
      </p>

      {/* extra guests */}
      {edit != null ? (
        edit.extraGuests && (
          <Switch
            label={t("Also count extra guest names (added to the booker's tally)")}
            data-size="sm"
            checked={occupancy.include_extra_guests}
            disabled={edit.pending}
            onChange={e => {
              edit.onPatch({ include_extra_guests: e.target.checked })
            }}
          />
        )
      ) : occupancy.include_extra_guests ? (
        <p className={styles.note}>{t("Extra guest names are counted too.")}</p>
      ) : null}
    </div>
  )
}

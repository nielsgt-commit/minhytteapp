import { memo, type RefObject } from "react"
import { Card, Fieldset } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./StartEndDate.module.css"

// The dates step for the PlanStayFlowSheet. Mirrors the supplied `StartEndDate`
// mockup, but each field opens OUR flatpickr calendar (single date) instead of
// the native HTML date picker, driven by `useSingleDateFlatpickr`.
//
// The inputs are RAW `<input>` elements (styled with digdir's `ds-input` /
// `ds-label` classes), not `<Textfield>`. flatpickr in `static` mode rewrites
// the DOM around each input — wrapping it and inserting the calendar. digdir's
// Textfield renders the input inside a `FieldAffixes` wrapper component that
// re-reconciles that subtree and fights flatpickr's DOM surgery, which detached
// the calendar and made it render see-through. A plain input has no such
// component subtree, so flatpickr owns its DOM unchallenged — the same approach
// the working inline range calendar uses. We also do NOT mark the input
// readonly: digdir paints a lock icon on any field with a `readonly` attribute,
// and flatpickr already blocks free typing on its own.
function StartEndDateImpl({
  startInputRef,
  endInputRef,
}: {
  startInputRef: RefObject<HTMLInputElement | null>
  endInputRef: RefObject<HTMLInputElement | null>
}) {
  const { t } = useTranslation("planstay")
  return (
    <Card className={styles.fieldset}>
      <Card.Block>
        <Fieldset>
          <Fieldset.Legend data-size="lg">
            {t("How long will you stay?")}
          </Fieldset.Legend>
          <Fieldset.Description>
            {t("Provide a start and end date")}
          </Fieldset.Description>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className="ds-label" htmlFor="planstay-flow-start">
                {t("Start date")}
              </label>
              <input
                id="planstay-flow-start"
                ref={startInputRef}
                className="ds-input"
                data-size="md"
                placeholder={t("Select a date")}
              />
            </div>
            <div className={styles.field}>
              <label className="ds-label" htmlFor="planstay-flow-end">
                {t("End date")}
              </label>
              <input
                id="planstay-flow-end"
                ref={endInputRef}
                className="ds-input"
                data-size="md"
                placeholder={t("Select a date")}
              />
            </div>
          </div>
        </Fieldset>
      </Card.Block>
    </Card>
  )
}

export const StartEndDate = memo(StartEndDateImpl)

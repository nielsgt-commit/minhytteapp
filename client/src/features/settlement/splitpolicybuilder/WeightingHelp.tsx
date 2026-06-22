import { Dialog, Heading, Paragraph } from "@digdir/designsystemet-react"
import { QuestionmarkCircleIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./WeightingHelp.module.css"

// A "?" button next to "How to split" that opens a dialog explaining the three
// split methods, focused on person-days (persondøgn) with worked examples.
export function WeightingHelp() {
  const { t } = useTranslation("settlement")

  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger
        variant="tertiary"
        data-color="neutral"
        data-size="sm"
        icon
        aria-label={t("How does splitting work?")}
        className={styles.trigger}
      >
        <QuestionmarkCircleIcon aria-hidden fontSize="1.25rem" />
      </Dialog.Trigger>
      <Dialog closedby="any" className={styles.dialog}>
        <Dialog.Block>
          <Heading level={2} data-size="sm">
            {t("How costs are split")}
          </Heading>
        </Dialog.Block>
        <Dialog.Block className={styles.content}>
          <Paragraph>
            {t(
              "Each expense is divided between the owner groups using the method you pick:",
            )}
          </Paragraph>

          <section className={styles.method}>
            <Heading level={3} data-size="2xs">
              {t("Equally")}
            </Heading>
            <Paragraph data-size="sm">
              {t(
                "Every group pays the same share, regardless of how much they used the property.",
              )}
            </Paragraph>
          </section>

          <section className={styles.method}>
            <Heading level={3} data-size="2xs">
              {t("By person-days (persondøgn)")}
            </Heading>
            <Paragraph data-size="sm">
              {t(
                "Each group pays in proportion to its person-days: one person staying one night counts as one person-day, so the total grows with both the length of a stay and the number of people on it.",
              )}
            </Paragraph>
            <Paragraph data-size="sm">
              {t(
                "Example: a 2-night stay with 2 people counts as 2 × 2 = 4 person-days.",
              )}
            </Paragraph>
            <Paragraph data-size="sm">
              {t(
                "Example: if group A stayed 30 person-days and group B 10, a 1000 kr bill splits 750 kr to A and 250 kr to B.",
              )}
            </Paragraph>
          </section>

          <section className={styles.method}>
            <Heading level={3} data-size="2xs">
              {t("By ownership percentage")}
            </Heading>
            <Paragraph data-size="sm">
              {t(
                "Each group pays according to its registered ownership share of the property.",
              )}
            </Paragraph>
          </section>

          <Paragraph data-size="sm">
            {t(
              "If no stay data exists for a cost, it is split equally instead.",
            )}
          </Paragraph>
        </Dialog.Block>
      </Dialog>
    </Dialog.TriggerContext>
  )
}

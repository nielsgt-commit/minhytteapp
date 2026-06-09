import { Dialog, Heading, Paragraph } from "@digdir/designsystemet-react"
import { QuestionmarkCircleIcon } from "@navikt/aksel-icons"
import { useTranslation } from "react-i18next"
import styles from "./PageHelp.module.css"

export type PageHelpStep = {
  title: string
  body: string
}

export type PageHelpContent = {
  /** Short paragraph: what this page is for and what you can do here. */
  intro: string
  /** Optional ordered guide, shown as a numbered list of steps. */
  steps?: PageHelpStep[]
  /**
   * Optional explanation of how this page links to the rest of the app — who
   * sees what, which roles can do what, and how data flows in and out. Pass an
   * array to render several paragraphs.
   */
  connections?: string | string[]
}

/**
 * A "?" button that opens a dialog explaining a page: what you can do here,
 * an optional step-by-step guide, and how the page connects to the rest of
 * the app. Rendered at the right edge of {@link PageHeader}.
 */
export function PageHelp({
  title,
  intro,
  steps,
  connections,
}: { title: string } & PageHelpContent) {
  const { t } = useTranslation("shared")

  return (
    <Dialog.TriggerContext>
      <Dialog.Trigger
        variant="tertiary"
        data-color="neutral"
        icon
        aria-label={t("Help: what can I do on this page?")}
        className={styles.trigger}
      >
        <QuestionmarkCircleIcon aria-hidden fontSize="1.75rem" />
      </Dialog.Trigger>
      <Dialog closedby="any" className={styles.dialog}>
        <Dialog.Block>
          <Heading level={2} data-size="sm">
            {title}
          </Heading>
        </Dialog.Block>
        <Dialog.Block className={styles.content}>
          <Paragraph>{intro}</Paragraph>

          {connections && (
            <div className={styles.connections}>
              <Heading level={3} data-size="2xs">
                {t("How this connects to the rest of the app")}
              </Heading>
              {(Array.isArray(connections) ? connections : [connections]).map(
                (paragraph, i) => (
                  <Paragraph key={i} data-size="sm">
                    {paragraph}
                  </Paragraph>
                ),
              )}
            </div>
          )}

          {steps && steps.length > 0 && (
            <ol className={styles.steps}>
              {steps.map((step, i) => (
                <li key={i} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden>
                    {i + 1}
                  </span>
                  <div className={styles.stepBody}>
                    <Heading level={3} data-size="2xs">
                      {step.title}
                    </Heading>
                    <Paragraph data-size="sm">{step.body}</Paragraph>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Dialog.Block>
      </Dialog>
    </Dialog.TriggerContext>
  )
}

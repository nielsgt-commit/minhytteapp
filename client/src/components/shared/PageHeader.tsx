import { Heading } from "@digdir/designsystemet-react"
import { PageHelp, type PageHelpContent } from "./PageHelp"
import styles from "./PageHeader.module.css"

/**
 * The title row shown at the top of every route: the page title on the left and
 * a "?" help button pinned to the right. Keeping this in one component makes the
 * help button land in the same spot on every page.
 */
export function PageHeader({
  title,
  help,
}: {
  title: string
  help?: PageHelpContent
}) {
  return (
    <div className={styles.row}>
      <Heading level={2} className={styles.title}>
        {title}
      </Heading>
      {help && <PageHelp title={title} {...help} />}
    </div>
  )
}

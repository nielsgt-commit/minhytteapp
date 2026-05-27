import {
  PortableText,
  type PortableTextReactComponents,
} from "@portabletext/react"
import type { PortableTextBlock } from "@portabletext/types"
import { useTranslation } from "react-i18next"
import { safeHref } from "../../../utils/safeHref.ts"
import styles from "./MaintenanceInstructionsPT.module.css"

type PhotoValue = {
  _type: "photo"
  url: string
  caption?: string
  alt?: string
}

const components: Partial<PortableTextReactComponents> = {
  block: {
    normal: ({ children }) => <p className={styles.p}>{children}</p>,
    h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
    h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className={styles.quote}>{children}</blockquote>
    ),
  },
  marks: {
    link: ({ children, value }) => {
      const href = (value as { href?: string } | undefined)?.href ?? "#"
      const isInternal = href.startsWith("/") || href.startsWith("#")
      const safe = isInternal ? href : safeHref(href)
      if (!safe) return <span>{children}</span>
      const external = !isInternal
      return (
        <a
          href={safe}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      )
    },
  },
  types: {
    photo: ({ value }: { value: PhotoValue }) => (
      <figure className={styles.figure}>
        <img
          src={value.url}
          alt={value.alt ?? value.caption ?? ""}
          loading="lazy"
        />
        {value.caption && <figcaption>{value.caption}</figcaption>}
      </figure>
    ),
  },
}

export function MaintenanceInstructionsPT({
  value,
}: {
  value: PortableTextBlock[] | null | undefined
}) {
  const { t } = useTranslation("maintenance")
  if (!value || value.length === 0) {
    return <p className={styles.empty}>{t("No instructions.")}</p>
  }
  return (
    <div className={styles.root}>
      <PortableText value={value} components={components} />
    </div>
  )
}

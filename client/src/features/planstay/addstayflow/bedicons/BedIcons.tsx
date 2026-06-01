import { BedFillIcon, BedIcon } from "@navikt/aksel-icons"
import type { ComponentType, SVGProps } from "react"
import { BED_ICON_COLOR, MAX_BED_ICONS } from "../../constants.ts"
import styles from "./BedIcons.module.css"

type IconComp = ComponentType<SVGProps<SVGSVGElement> & { fontSize?: string }>

function BedSvg({
  variant,
}: {
  variant: "empty" | "existing" | "draft" | "over"
}) {
  const color = BED_ICON_COLOR[variant]
  const Icon = (variant === "empty"
    ? BedIcon
    : BedFillIcon) as unknown as IconComp
  return (
    <Icon
      fontSize="1.4rem"
      className={styles.bedIcon}
      style={{ "--bed-icon-color": color } as React.CSSProperties}
      aria-hidden
    />
  )
}

export function BedIconRow({
  total,
  existingCount,
  draftCount,
}: {
  total: number
  existingCount: number
  draftCount: number
}) {
  const shown = Math.min(total, MAX_BED_ICONS)
  const overflow = total > MAX_BED_ICONS ? total - MAX_BED_ICONS : 0
  const overCount = Math.max(0, existingCount + draftCount - total)

  return (
    <div className="bed-icon-row">
      {Array.from({ length: shown }, (_, i) => {
        let variant: "empty" | "existing" | "draft" | "over"
        if (i < existingCount) variant = "existing"
        else if (i < existingCount + draftCount - overCount) variant = "draft"
        else variant = "empty"
        return <BedSvg key={i} variant={variant} />
      })}
      {overCount > 0 &&
        Array.from(
          { length: Math.min(overCount, MAX_BED_ICONS - shown) },
          (_, i) => <BedSvg key={`over-${String(i)}`} variant="over" />,
        )}
      {overflow > 0 && <span className={styles.overflow}>+{overflow}</span>}
    </div>
  )
}

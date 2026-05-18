import { BedFillIcon, BedIcon } from "@navikt/aksel-icons"
import { BED_ICON_COLOR, MAX_BED_ICONS } from "../constants.ts"

function BedSvg({ variant }: { variant: "empty" | "existing" | "draft" | "over" }) {
  const color = BED_ICON_COLOR[variant]
  const Icon = variant === "empty" ? BedIcon : BedFillIcon
  return <Icon fontSize="1.4rem" style={{ color }} aria-hidden />
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
        Array.from({ length: Math.min(overCount, MAX_BED_ICONS - shown) }, (_, i) => (
          <BedSvg key={`over-${i}`} variant="over" />
        ))}
      {overflow > 0 && (
        <span style={{ fontSize: "0.75rem", color: "var(--ds-color-neutral-text-subtle)" }}>
          +{overflow}
        </span>
      )}
    </div>
  )
}

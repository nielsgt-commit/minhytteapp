/**
 * Agent 3 — "Multi-Occupant Ergonomics"
 * Lens: optimize for the group-booking case — household head books for family,
 * assigns rooms, understands kid/adult bed allocation at a glance.
 * All UI via @digdir/designsystemet-react.
 */

import { Heading, Paragraph } from "@digdir/designsystemet-react"
import { useAppSelector } from "@/app/hooks"
import { selectSelectedPropertyId } from "@/features/property/propertySlice"
import { A3Body } from "./A3Body"

export function Agent3Calendar() {
  const selectedPropertyId = useAppSelector(selectSelectedPropertyId)
  if (selectedPropertyId == null) {
    return (
      <section>
        <Heading level={4}>Calendar (Variant 3)</Heading>
        <Paragraph role="alert">No property selected.</Paragraph>
      </section>
    )
  }
  return <A3Body propertyId={selectedPropertyId} />
}

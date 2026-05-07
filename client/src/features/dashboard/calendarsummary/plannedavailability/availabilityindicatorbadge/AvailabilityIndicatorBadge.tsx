import { Badge } from "@digdir/designsystemet-react"

type Props = {
  count: number
  totalBeds?: number
}

export default function AvailabilityIndicatorBadge({ count, totalBeds }: Props) {
  const overCapacity = totalBeds !== undefined && count > totalBeds
  return <Badge count={count} data-color={overCapacity ? "danger" : "info"} />
}
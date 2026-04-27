type Props = {
  count: number
}

export default function AvailabilityIndicatorBadge({ count }: Props) {
  return <span>{count}</span>
}

type OwnerLike = {
  user_id: number | null
  user_group_id: number | null
  user_name: string | null
  user_group_name: string | null
  ownership_pct: number | string
}

export function ownerLabel(o: OwnerLike): string {
  const isUser = o.user_id != null
  return isUser
    ? (o.user_name ?? `user #${String(o.user_id)}`)
    : (o.user_group_name ?? `group #${String(o.user_group_id)}`)
}

export function totalOwnershipPct(owners: OwnerLike[]): number {
  return owners.reduce((s, o) => s + Number(o.ownership_pct), 0)
}

export function ownershipOffBy(owners: OwnerLike[]): number {
  return Math.abs(totalOwnershipPct(owners) - 100)
}

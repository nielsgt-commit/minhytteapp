export type TargetKind = "structure" | "infrastructure" | "equipment"
export type Target = { kind: TargetKind; id: number }

export const NO_TARGET = ""

// Encodes a target as "<kind>:<id>" so a single <select> can carry the choice.
export function parseTargetToken(token: string): Target | undefined {
  if (token === NO_TARGET) return undefined
  const [kind, idStr] = token.split(":")
  const id = Number(idStr)
  if (!Number.isFinite(id) || id <= 0) return undefined
  if (
    kind !== "structure" &&
    kind !== "infrastructure" &&
    kind !== "equipment"
  ) {
    return undefined
  }
  return { kind, id }
}

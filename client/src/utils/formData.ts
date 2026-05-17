export function fdString(fd: FormData, key: string): string {
  const v = fd.get(key)
  return typeof v === "string" ? v : ""
}

export function fdBoolean(fd: FormData, key: string): boolean {
  return fd.get(key) === "on"
}

export function fdNumber(fd: FormData, key: string): number {
  const v = fd.get(key)
  if (typeof v !== "string" || v === "") return NaN
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

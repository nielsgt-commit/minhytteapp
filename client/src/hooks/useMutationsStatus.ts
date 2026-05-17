type MutationLike = {
  isPending: boolean
  error: Error | null
}

type MutationsStatus = {
  pending: boolean
  error: Error | null
}

export function useMutationsStatus(...mutations: MutationLike[]): MutationsStatus {
  return {
    pending: mutations.some(m => m.isPending),
    error: mutations.reduce<Error | null>((acc, m) => acc ?? m.error, null),
  }
}

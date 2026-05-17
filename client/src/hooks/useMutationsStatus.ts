type ErrorLike = { message: string }

type MutationLike = {
  isPending: boolean
  error: ErrorLike | null
}

type MutationsStatus = {
  pending: boolean
  error: ErrorLike | null
}

export function useMutationsStatus(...mutations: MutationLike[]): MutationsStatus {
  return {
    pending: mutations.some(m => m.isPending),
    error: mutations.reduce<ErrorLike | null>((acc, m) => acc ?? m.error, null),
  }
}

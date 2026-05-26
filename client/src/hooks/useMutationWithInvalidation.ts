import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query"

export function useMutationWithInvalidation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  invalidateQueryKeys: readonly QueryKey[],
): UseMutationResult<TData, TError, TVariables, TContext> {
  const qc = useQueryClient()

  return useMutation({
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all(
        invalidateQueryKeys.map(queryKey => qc.invalidateQueries({ queryKey })),
      )
      await options.onSuccess?.(data, variables, onMutateResult, context)
    },
  })
}

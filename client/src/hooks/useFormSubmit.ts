import { useCallback, type SyntheticEvent } from "react"

export function useFormSubmit<T>(
  parse: (formData: FormData) => T | null,
  onSubmit: (data: T) => void,
): (event: SyntheticEvent<HTMLFormElement>) => void {
  return useCallback(
    (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault()
      const data = parse(new FormData(event.currentTarget))
      if (data === null) return
      onSubmit(data)
    },
    [parse, onSubmit],
  )
}

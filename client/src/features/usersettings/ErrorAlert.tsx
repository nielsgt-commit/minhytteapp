type ErrorAlertProps = {
  error: { message: string } | null | undefined
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  if (!error) return null
  return <p role="alert">Error: {error.message}</p>
}

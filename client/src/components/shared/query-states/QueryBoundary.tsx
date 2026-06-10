import { Button } from "@digdir/designsystemet-react"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { Component, Suspense, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CardSkeleton } from "./CardSkeleton"
import { ErrorAlert } from "./ErrorAlert"

type Props = {
  children: ReactNode
  fallback?: ReactNode
}

function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error
  onRetry: () => void
}) {
  const { t } = useTranslation("shared")
  return (
    <div>
      <ErrorAlert error={error} />
      <Button variant="secondary" data-size="sm" onClick={onRetry}>
        {t("Try again")}
      </Button>
    </div>
  )
}

type BoundaryProps = {
  children: ReactNode
  // Called before re-rendering children so suspense queries clear their error.
  onReset: () => void
}

type BoundaryState = {
  error: Error | null
}

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  retry = () => {
    this.props.onReset()
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.retry} />
    }
    return this.props.children
  }
}

// Wraps suspense-based query components: skeleton while loading, alert with a
// retry button on error. Retry resets both the boundary and the failed query.
export function QueryBoundary({ children, fallback }: Props) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset}>
          <Suspense fallback={fallback ?? <CardSkeleton />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

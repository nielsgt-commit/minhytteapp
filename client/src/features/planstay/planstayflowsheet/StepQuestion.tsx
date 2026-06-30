import type { ReactNode } from "react"
import { Fieldset } from "@digdir/designsystemet-react"

// Wraps a sheet step with a question-style heading + description, matching the
// dates step (StartEndDate). Lets the stacked flow read as a guided
// questionnaire without touching the reused addstayflow step components.
export function StepQuestion({
  question,
  description,
  children,
}: {
  question: string
  description: string
  children: ReactNode
}) {
  return (
    <Fieldset>
      <Fieldset.Legend data-size="lg">{question}</Fieldset.Legend>
      <Fieldset.Description>{description}</Fieldset.Description>
      {children}
    </Fieldset>
  )
}

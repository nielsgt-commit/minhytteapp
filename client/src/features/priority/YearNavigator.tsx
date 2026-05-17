import { Button, Fieldset } from "@digdir/designsystemet-react"

type YearNavigatorProps = {
  year: number
  onChange: (year: number) => void
}

export function YearNavigator({ year, onChange }: YearNavigatorProps) {
  return (
    <Fieldset>
      <Fieldset.Legend>Year</Fieldset.Legend>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        onClick={() => { onChange(year - 1) }}
      >
        Prev
      </Button>
      <output> {year} </output>
      <Button
        type="button"
        variant="tertiary"
        data-size="sm"
        onClick={() => { onChange(year + 1) }}
      >
        Next
      </Button>
    </Fieldset>
  )
}

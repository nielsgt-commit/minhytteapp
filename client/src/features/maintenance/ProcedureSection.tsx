import {
  Button,
  Card,
  Fieldset,
  Heading,
  Paragraph,
  Radio,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./InspectionFlow.module.css"

export type ItemStatus = "ok" | "followup"

export type ProcedureState = {
  status: ItemStatus
  description: string
}

export type ProcedureItem = {
  id: number
  description: string
}

export function ProcedureSection(props: {
  items: readonly ProcedureItem[]
  getProc: (id: number, fallback: string) => ProcedureState
  setProc: (id: number, patch: Partial<ProcedureState>) => void
  moveProcedureItem: (id: number, direction: -1 | 1) => void
  reorderPending: boolean
}) {
  const { items, getProc, setProc, moveProcedureItem, reorderPending } = props
  return (
    <div className={styles.section}>
      <Heading data-size="2xs">Procedure</Heading>
      {items.length === 0 ? (
        <Paragraph data-size="sm">
          No pinned items yet. Add ad-hoc findings below and pin any that
          should recur next time.
        </Paragraph>
      ) : (
        items.map((item, idx) => {
          const state = getProc(item.id, item.description)
          const isFirst = idx === 0
          const isLast = idx === items.length - 1
          return (
            <Card key={item.id} asChild>
              <article>
                <Card.Block>
                  <div className={styles.procHeader}>
                    <Heading
                      data-size="2xs"
                      className={styles.procTitle}
                    >
                      {item.description}
                    </Heading>
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      aria-label="Move up"
                      disabled={isFirst || reorderPending}
                      onClick={() => { moveProcedureItem(item.id, -1) }}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="tertiary"
                      data-size="sm"
                      aria-label="Move down"
                      disabled={isLast || reorderPending}
                      onClick={() => { moveProcedureItem(item.id, 1) }}
                    >
                      ↓
                    </Button>
                  </div>
                  <Fieldset>
                    <Fieldset.Legend>Status</Fieldset.Legend>
                    <div className={styles.procActions}>
                      <Radio
                        label="OK"
                        name={`procedure-${String(item.id)}`}
                        value="ok"
                        checked={state.status === "ok"}
                        onChange={() => {
                          setProc(item.id, { status: "ok" })
                        }}
                      />
                      <Radio
                        label="Needs followup"
                        name={`procedure-${String(item.id)}`}
                        value="followup"
                        checked={state.status === "followup"}
                        onChange={() => {
                          setProc(item.id, { status: "followup" })
                        }}
                      />
                    </div>
                  </Fieldset>
                </Card.Block>
                {state.status === "followup" && (
                  <Card.Block>
                    <Textfield
                      label="Followup description"
                      value={state.description}
                      onChange={e => {
                        setProc(item.id, { description: e.target.value })
                      }}
                    />
                  </Card.Block>
                )}
              </article>
            </Card>
          )
        })
      )}
    </div>
  )
}

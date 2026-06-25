import {
  Button,
  Card,
  Fieldset,
  Heading,
  Paragraph,
  Radio,
  Textfield,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
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

export type NewStep = {
  key: string
  description: string
  committed: boolean
  status: ItemStatus
  followupDescription: string
}

export function ProcedureSection(props: {
  items: readonly ProcedureItem[]
  getProc: (id: number, fallback: string) => ProcedureState
  setProc: (id: number, patch: Partial<ProcedureState>) => void
  moveProcedureItem: (id: number, direction: -1 | 1) => void
  reorderPending: boolean
  newSteps: readonly NewStep[]
  addStep: () => void
  updateStep: (key: string, patch: Partial<NewStep>) => void
  commitStep: (key: string) => void
  editStep: (key: string) => void
  removeStep: (key: string) => void
}) {
  const { t } = useTranslation("maintenance")
  const {
    items,
    getProc,
    setProc,
    moveProcedureItem,
    reorderPending,
    newSteps,
    addStep,
    updateStep,
    commitStep,
    editStep,
    removeStep,
  } = props
  return (
    <div className={styles.section}>
      <Heading level={5} data-size="2xs">
        {t("Procedure")}
      </Heading>
      {items.length === 0 && newSteps.length === 0 && (
        <Paragraph data-size="sm">
          {t("No procedure steps yet. Add one below.")}
        </Paragraph>
      )}
      {items.map((item, idx) => {
        const state = getProc(item.id, item.description)
        const isFirst = idx === 0
        const isLast = idx === items.length - 1
        return (
          <Card key={item.id} asChild>
            <article>
              <Card.Block>
                <div className={styles.procHeader}>
                  <Heading
                    level={6}
                    data-size="2xs"
                    className={styles.procTitle}
                  >
                    {item.description}
                  </Heading>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    aria-label={t("Move up")}
                    disabled={isFirst || reorderPending}
                    onClick={() => {
                      moveProcedureItem(item.id, -1)
                    }}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    aria-label={t("Move down")}
                    disabled={isLast || reorderPending}
                    onClick={() => {
                      moveProcedureItem(item.id, 1)
                    }}
                  >
                    ↓
                  </Button>
                </div>
                <Fieldset>
                  <Fieldset.Legend>{t("Status")}</Fieldset.Legend>
                  <div className={styles.procActions}>
                    <Radio
                      label={t("OK")}
                      name={`procedure-${String(item.id)}`}
                      value="ok"
                      checked={state.status === "ok"}
                      onChange={() => {
                        setProc(item.id, { status: "ok" })
                      }}
                    />
                    <Radio
                      label={t("Needs followup")}
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
                    label={t("Followup description")}
                    description={t(
                      "Added as a todo item when you complete the inspection.",
                    )}
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
      })}
      {newSteps.map(s =>
        s.committed ? (
          <Card key={s.key} asChild>
            <article>
              <Card.Block>
                <div className={styles.procHeader}>
                  <Heading
                    level={6}
                    data-size="2xs"
                    className={styles.procTitle}
                  >
                    {s.description}
                  </Heading>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => {
                      editStep(s.key)
                    }}
                  >
                    {t("Edit")}
                  </Button>
                  <Button
                    variant="tertiary"
                    data-color="danger"
                    data-size="sm"
                    onClick={() => {
                      removeStep(s.key)
                    }}
                  >
                    {t("Remove")}
                  </Button>
                </div>
                <Fieldset>
                  <Fieldset.Legend>{t("Status")}</Fieldset.Legend>
                  <div className={styles.procActions}>
                    <Radio
                      label={t("OK")}
                      name={`new-step-${s.key}`}
                      value="ok"
                      checked={s.status === "ok"}
                      onChange={() => {
                        updateStep(s.key, { status: "ok" })
                      }}
                    />
                    <Radio
                      label={t("Needs followup")}
                      name={`new-step-${s.key}`}
                      value="followup"
                      checked={s.status === "followup"}
                      onChange={() => {
                        updateStep(s.key, { status: "followup" })
                      }}
                    />
                  </div>
                </Fieldset>
              </Card.Block>
              {s.status === "followup" && (
                <Card.Block>
                  <Textfield
                    label={t("Followup description")}
                    description={t(
                      "Added as a todo item when you complete the inspection.",
                    )}
                    value={s.followupDescription}
                    onChange={e => {
                      updateStep(s.key, { followupDescription: e.target.value })
                    }}
                  />
                </Card.Block>
              )}
            </article>
          </Card>
        ) : (
          <Card key={s.key} asChild>
            <article>
              <Card.Block>
                <Fieldset>
                  <Fieldset.Legend>{t("New step")}</Fieldset.Legend>
                  <div className={styles.adHocRow}>
                    <div className={styles.adHocDescription}>
                      <Textfield
                        label={t("Description")}
                        value={s.description}
                        onChange={e => {
                          updateStep(s.key, { description: e.target.value })
                        }}
                      />
                    </div>
                    <Button
                      data-size="sm"
                      disabled={s.description.trim().length === 0}
                      onClick={() => {
                        commitStep(s.key)
                      }}
                    >
                      {t("Add")}
                    </Button>
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      onClick={() => {
                        removeStep(s.key)
                      }}
                    >
                      {t("Remove")}
                    </Button>
                  </div>
                </Fieldset>
              </Card.Block>
            </article>
          </Card>
        ),
      )}
      <Button variant="secondary" data-size="sm" onClick={addStep}>
        {t("Add step")}
      </Button>
    </div>
  )
}

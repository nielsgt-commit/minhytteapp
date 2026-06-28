import {
  Button,
  Card,
  Fieldset,
  Heading,
  Paragraph,
  Radio,
  Textfield,
} from "@digdir/designsystemet-react"
import { useState } from "react"
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

// A persisted procedure step. Renames and removals are STAGED in the parent
// form and only applied when the inspection is completed — nothing touches the
// DB until then. `description` is the effective (staged) title; `removed`
// flags a step staged for removal, which can be restored before submit.
function ExistingProcedureItem(props: {
  item: ProcedureItem
  description: string
  removed: boolean
  isFirst: boolean
  isLast: boolean
  state: ProcedureState
  setProc: (id: number, patch: Partial<ProcedureState>) => void
  moveProcedureItem: (id: number, direction: -1 | 1) => void
  reorderPending: boolean
  editProcedureItem: (id: number, description: string) => void
  removeProcedureItem: (id: number) => void
  restoreProcedureItem: (id: number) => void
  disabled: boolean
}) {
  const { t } = useTranslation("maintenance")
  const {
    item,
    description,
    removed,
    isFirst,
    isLast,
    state,
    setProc,
    moveProcedureItem,
    reorderPending,
    editProcedureItem,
    removeProcedureItem,
    restoreProcedureItem,
    disabled,
  } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(description)

  const save = () => {
    const next = draft.trim()
    if (next.length === 0) return
    if (next !== description) editProcedureItem(item.id, next)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(description)
    setEditing(false)
  }

  if (removed) {
    return (
      <Card key={item.id} asChild>
        <article>
          <Card.Block>
            <div className={styles.procHeader}>
              <Heading
                level={6}
                data-size="2xs"
                className={styles.removedTitle}
              >
                {description}
              </Heading>
              <Paragraph data-size="sm">{t("Will be removed")}</Paragraph>
              <Button
                variant="tertiary"
                data-size="sm"
                disabled={disabled}
                onClick={() => {
                  restoreProcedureItem(item.id)
                }}
              >
                {t("Restore")}
              </Button>
            </div>
          </Card.Block>
        </article>
      </Card>
    )
  }

  return (
    <Card asChild>
      <article>
        <Card.Block>
          {editing ? (
            <div className={styles.adHocRow}>
              <div className={styles.adHocDescription}>
                <Textfield
                  label={t("Description")}
                  value={draft}
                  onChange={e => {
                    setDraft(e.target.value)
                  }}
                />
              </div>
              <Button
                data-size="sm"
                disabled={draft.trim().length === 0 || disabled}
                onClick={save}
              >
                {t("Save")}
              </Button>
              <Button variant="tertiary" data-size="sm" onClick={cancel}>
                {t("Cancel")}
              </Button>
            </div>
          ) : (
            <div className={styles.procHeader}>
              <Heading level={6} data-size="2xs" className={styles.procTitle}>
                {description}
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
              <Button
                variant="tertiary"
                data-size="sm"
                disabled={disabled}
                onClick={() => {
                  setDraft(description)
                  setEditing(true)
                }}
              >
                {t("Edit")}
              </Button>
              <Button
                variant="tertiary"
                data-color="danger"
                data-size="sm"
                disabled={disabled}
                onClick={() => {
                  removeProcedureItem(item.id)
                }}
              >
                {t("Remove")}
              </Button>
            </div>
          )}
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
}

export function ProcedureSection(props: {
  items: readonly ProcedureItem[]
  getProc: (id: number, fallback: string) => ProcedureState
  setProc: (id: number, patch: Partial<ProcedureState>) => void
  moveProcedureItem: (id: number, direction: -1 | 1) => void
  reorderPending: boolean
  editProcedureItem: (id: number, description: string) => void
  removeProcedureItem: (id: number) => void
  restoreProcedureItem: (id: number) => void
  stagedDescriptions: Readonly<Record<number, string>>
  removedItemIds: readonly number[]
  disabled: boolean
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
    editProcedureItem,
    removeProcedureItem,
    restoreProcedureItem,
    stagedDescriptions,
    removedItemIds,
    disabled,
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
        const description = stagedDescriptions[item.id] ?? item.description
        return (
          <ExistingProcedureItem
            key={item.id}
            item={item}
            description={description}
            removed={removedItemIds.includes(item.id)}
            isFirst={idx === 0}
            isLast={idx === items.length - 1}
            state={getProc(item.id, description)}
            setProc={setProc}
            moveProcedureItem={moveProcedureItem}
            reorderPending={reorderPending}
            editProcedureItem={editProcedureItem}
            removeProcedureItem={removeProcedureItem}
            restoreProcedureItem={restoreProcedureItem}
            disabled={disabled}
          />
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

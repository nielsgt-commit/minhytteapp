import {
  Button,
  Card,
  Fieldset,
  Heading,
  Paragraph,
  Switch,
  Textfield,
} from "@digdir/designsystemet-react"
import styles from "./InspectionFlow.module.css"

export type AdHoc = {
  key: string
  description: string
  pin: boolean
  committed: boolean
}

export function FindingsSection(props: {
  adHocs: readonly AdHoc[]
  addAdHoc: () => void
  updateAdHoc: (key: string, patch: Partial<AdHoc>) => void
  commitAdHoc: (key: string) => void
  editAdHoc: (key: string) => void
  removeAdHoc: (key: string) => void
}) {
  const {
    adHocs,
    addAdHoc,
    updateAdHoc,
    commitAdHoc,
    editAdHoc,
    removeAdHoc,
  } = props
  return (
    <div className={styles.section}>
      <Heading level={5} data-size="2xs">Findings</Heading>
      {adHocs.map(a =>
        a.committed ? (
          <Card key={a.key} asChild>
            <article>
              <Card.Block>
                <div className={styles.committedRow}>
                  <Paragraph
                    className={styles.committedDescription}
                    data-size="sm"
                  >
                    {a.description}
                    {a.pin ? " (pinned)" : ""}
                  </Paragraph>
                  <Button
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => { editAdHoc(a.key) }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="tertiary"
                    data-color="danger"
                    data-size="sm"
                    onClick={() => { removeAdHoc(a.key) }}
                  >
                    Remove
                  </Button>
                </div>
              </Card.Block>
            </article>
          </Card>
        ) : (
          <Card key={a.key} asChild>
            <article>
              <Card.Block>
                <Fieldset>
                  <Fieldset.Legend>New finding</Fieldset.Legend>
                  <div className={styles.adHocRow}>
                    <div className={styles.adHocDescription}>
                      <Textfield
                        label="Description"
                        value={a.description}
                        onChange={e => {
                          updateAdHoc(a.key, { description: e.target.value })
                        }}
                      />
                    </div>
                    <Button
                      data-size="sm"
                      disabled={a.description.trim().length === 0}
                      onClick={() => { commitAdHoc(a.key) }}
                    >
                      Add
                    </Button>
                    <Button
                      variant="tertiary"
                      data-color="danger"
                      data-size="sm"
                      onClick={() => { removeAdHoc(a.key) }}
                    >
                      Remove
                    </Button>
                  </div>
                  <Switch
                    label="Pin to procedure (recurs each inspection)"
                    checked={a.pin}
                    onChange={e => {
                      updateAdHoc(a.key, { pin: e.target.checked })
                    }}
                  />
                </Fieldset>
              </Card.Block>
            </article>
          </Card>
        ),
      )}
      <Button
        variant="secondary"
        data-size="sm"
        onClick={addAdHoc}
      >
        Add finding
      </Button>
    </div>
  )
}

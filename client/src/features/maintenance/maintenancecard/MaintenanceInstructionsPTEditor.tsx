import { useState } from "react"
import {
  defineSchema,
  EditorProvider,
  PortableTextEditable,
  useEditor,
  type PortableTextBlock as EditorPortableTextBlock,
  type RenderBlockFunction,
  type RenderDecoratorFunction,
  type RenderListItemFunction,
  type RenderStyleFunction,
} from "@portabletext/editor"
import { EventListenerPlugin } from "@portabletext/editor/plugins"
import {
  useBlockObjectButton,
  useToolbarSchema,
  type ToolbarBlockObjectSchemaType,
} from "@portabletext/toolbar"
import type { PortableTextBlock } from "@portabletext/types"
import { Button } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./MaintenanceInstructionsPTEditor.module.css"

const schemaDefinition = defineSchema({
  decorators: [{ name: "strong" }, { name: "em" }],
  annotations: [{ name: "link" }],
  styles: [
    { name: "normal" },
    { name: "h2" },
    { name: "h3" },
    { name: "blockquote" },
  ],
  lists: [{ name: "bullet" }, { name: "number" }],
  inlineObjects: [],
  blockObjects: [{ name: "photo" }],
})

const renderStyle: RenderStyleFunction = ({ schemaType, children }) => {
  switch (schemaType.name) {
    case "h2": return <h2 className={styles.h2}>{children}</h2>
    case "h3": return <h3 className={styles.h3}>{children}</h3>
    case "blockquote":
      return <blockquote className={styles.quote}>{children}</blockquote>
    default: return <p className={styles.p}>{children}</p>
  }
}

const renderDecorator: RenderDecoratorFunction = ({ value, children }) => {
  if (value === "strong") return <strong>{children}</strong>
  if (value === "em") return <em>{children}</em>
  return <>{children}</>
}

const renderListItem: RenderListItemFunction = (props) => (
  <div
    className={styles.listItem}
    data-list={props.schemaType.name}
    style={{ marginLeft: `${(props.level - 1) * 1.25}rem` }}
  >
    {props.children}
  </div>
)

const renderBlock: RenderBlockFunction = (props) => {
  const v = props.value as Record<string, unknown>
  if (props.schemaType.name === "photo") {
    return (
      <figure className={styles.figure}>
        {typeof v.url === "string" && <img src={v.url} alt={String(v.caption ?? "")} />}
        {v.caption ? <figcaption>{String(v.caption)}</figcaption> : null}
      </figure>
    )
  }
  return <div>{props.children}</div>
}

function StyleButton({ style, label }: { style: string; label: string }) {
  const editor = useEditor()
  return (
    <Button
      type="button"
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        editor.send({ type: "style.toggle", style })
        editor.send({ type: "focus" })
      }}
    >
      {label}
    </Button>
  )
}

function DecoratorButton({ decorator, label }: { decorator: string; label: string }) {
  const editor = useEditor()
  return (
    <Button
      type="button"
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        editor.send({ type: "decorator.toggle", decorator })
        editor.send({ type: "focus" })
      }}
    >
      {label}
    </Button>
  )
}

function ListButton({ listItem, label }: { listItem: string; label: string }) {
  const editor = useEditor()
  return (
    <Button
      type="button"
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        editor.send({ type: "list item.toggle", listItem })
        editor.send({ type: "focus" })
      }}
    >
      {label}
    </Button>
  )
}

function LinkButton({ label, promptLabel }: { label: string; promptLabel: string }) {
  const editor = useEditor()
  return (
    <Button
      type="button"
      variant="tertiary"
      data-size="sm"
      onClick={() => {
        const href = window.prompt(promptLabel)
        if (!href) return
        editor.send({
          type: "annotation.toggle",
          annotation: { name: "link", value: { href } },
        })
        editor.send({ type: "focus" })
      }}
    >
      {label}
    </Button>
  )
}

function BlockObjectButton({
  schemaType,
  label,
  buildValue,
}: {
  schemaType: ToolbarBlockObjectSchemaType
  label: string
  buildValue: () => Record<string, unknown> | null
}) {
  const btn = useBlockObjectButton({ schemaType })
  return (
    <Button
      type="button"
      variant="secondary"
      data-size="sm"
      disabled={!btn.snapshot.matches("enabled")}
      onClick={() => {
        const value = buildValue()
        if (!value) return
        btn.send({ type: "insert", value, placement: undefined })
      }}
    >
      {label}
    </Button>
  )
}

function Toolbar() {
  const { t } = useTranslation("maintenance")
  const toolbarSchema = useToolbarSchema({})
  const photo = toolbarSchema.blockObjects?.find((b) => b.name === "photo")

  return (
    <div className={styles.toolbar}>
      <DecoratorButton decorator="strong" label={t("Bold (B)")} />
      <DecoratorButton decorator="em" label={t("Italic (I)")} />
      <StyleButton style="h2" label={t("Heading 2")} />
      <StyleButton style="h3" label={t("Heading 3")} />
      <StyleButton style="blockquote" label={t("Blockquote")} />
      <ListButton listItem="bullet" label={t("Bullet list")} />
      <ListButton listItem="number" label={t("Numbered list")} />
      <LinkButton label={t("Link")} promptLabel={t("URL")} />
      <span className={styles.sep} />
      {photo && (
        <BlockObjectButton
          schemaType={photo}
          label={t("+ Photo")}
          buildValue={() => {
            const url = window.prompt(t("Image URL"))
            if (!url) return null
            const caption = window.prompt(t("Caption (optional)")) ?? undefined
            return { url, caption }
          }}
        />
      )}
    </div>
  )
}

export function MaintenanceInstructionsPTEditor({
  initialValue,
  onChange,
}: {
  initialValue?: PortableTextBlock[]
  onChange: (value: PortableTextBlock[]) => void
}) {
  const { t } = useTranslation("maintenance")
  const [value, setValue] = useState<EditorPortableTextBlock[] | undefined>(
    initialValue as EditorPortableTextBlock[] | undefined,
  )

  return (
    <div className={styles.root} aria-label={t("Description")}>
      <EditorProvider initialConfig={{ schemaDefinition, initialValue: value }}>
        <EventListenerPlugin
          on={(event) => {
            if (event.type === "mutation") {
              setValue(event.value)
              onChange((event.value ?? []) as unknown as PortableTextBlock[])
            }
          }}
        />
        <Toolbar />
        <PortableTextEditable
          className={styles.editable}
          renderStyle={renderStyle}
          renderDecorator={renderDecorator}
          renderBlock={renderBlock}
          renderListItem={renderListItem}
        />
      </EditorProvider>
    </div>
  )
}

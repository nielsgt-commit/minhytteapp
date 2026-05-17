import {
  Button,
  Card,
  Heading,
  Paragraph,
  Select,
  Switch,
} from "@digdir/designsystemet-react"
import { ExceptPicker } from "./ExceptPicker"
import { WhoPicker } from "./WhoPicker"
import {
  type Category,
  type EligibleOwner,
  type GroupWithMembers,
  type How,
  HOW_LABEL,
  type PropertyUser,
  type Rule,
  WHEN_LABEL,
  decodeWhat,
  decodeWhen,
  describeExcept,
  describeWho,
  encodeExcept,
  encodeWhat,
  encodeWhen,
  encodeWho,
} from "./types"

type Props = {
  rule: Rule
  idx: number
  isLast: boolean
  pending: boolean
  activeCategories: Category[]
  groups: GroupWithMembers[]
  propertyUsers: PropertyUser[]
  eligibleOwners: EligibleOwner[]
  onPatch: (idx: number, patch: Partial<Rule>) => void
  onMove: (idx: number, delta: -1 | 1) => void
  onRemove: (idx: number) => void
  onAddWho: (idx: number, encoded: string) => void
  onRemoveWho: (idx: number, encoded: string) => void
  onAddExcept: (idx: number, encoded: string) => void
  onRemoveExcept: (idx: number, encoded: string) => void
}

export function RuleEditor({
  rule,
  idx,
  isLast,
  pending,
  activeCategories,
  groups,
  propertyUsers,
  eligibleOwners,
  onPatch,
  onMove,
  onRemove,
  onAddWho,
  onRemoveWho,
  onAddExcept,
  onRemoveExcept,
}: Props) {
  const selectedExceptEncoded = new Set(rule.except.map(encodeExcept))
  const selectedWhoEncoded = new Set(rule.who.map(encodeWho))
  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Heading level={5} data-size="2xs">
            Rule #{idx + 1}
          </Heading>
          <Paragraph data-size="sm">
            Split{" "}
            <Select
              data-size="sm"
              value={encodeWhat(rule.what)}
              onChange={e => {
                onPatch(idx, { what: decodeWhat(e.target.value) })
              }}
            >
              <Select.Option value="total">total</Select.Option>
              {activeCategories.map(c => (
                <Select.Option
                  key={c.id}
                  value={`category:${String(c.id)}`}
                >
                  category: {c.name}
                </Select.Option>
              ))}
            </Select>{" "}
            <Select
              data-size="sm"
              value={rule.how.kind}
              onChange={e => {
                onPatch(idx, {
                  how: { kind: e.target.value as How["kind"] },
                })
              }}
            >
              {Object.entries(HOW_LABEL).map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {label}
                </Select.Option>
              ))}
            </Select>{" "}
            between{" "}
            {rule.who.length === 0 ? (
              <em>nobody selected</em>
            ) : (
              rule.who.map(w => {
                const enc = encodeWho(w)
                return (
                  <Button
                    key={enc}
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => { onRemoveWho(idx, enc) }}
                  >
                    {describeWho(w, groups)} ✕
                  </Button>
                )
              })
            )}{" "}
            who were{" "}
            <Select
              data-size="sm"
              value={encodeWhen(rule.when)}
              onChange={e => {
                onPatch(idx, { when: decodeWhen(e.target.value) })
              }}
            >
              {Object.entries(WHEN_LABEL).map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {label}
                </Select.Option>
              ))}
              {eligibleOwners.length > 0 && (
                <Select.Optgroup label="Specific priority week">
                  {eligibleOwners.map(o => {
                    const enc = `during_priority_week:${String(o.property_owner_id)}`
                    return (
                      <Select.Option key={enc} value={enc}>
                        {o.user_name}&apos;s priority week
                      </Select.Option>
                    )
                  })}
                </Select.Optgroup>
              )}
            </Select>
          </Paragraph>
          <Switch
            label="Include extra guest names (attributed to booker's group)"
            data-size="sm"
            checked={rule.include_extra_guests}
            onChange={e => {
              onPatch(idx, { include_extra_guests: e.target.checked })
            }}
          />
          <WhoPicker
            propertyUsers={propertyUsers}
            groups={groups}
            selectedEncoded={selectedWhoEncoded}
            onAdd={enc => { onAddWho(idx, enc) }}
          />
        </Card.Block>

        <Card.Block data-size="sm">
          <Paragraph data-size="sm">
            <strong>except:</strong>{" "}
            {rule.except.length === 0 ? (
              <em>nobody</em>
            ) : (
              rule.except.map(e => {
                const enc = encodeExcept(e)
                return (
                  <Button
                    key={enc}
                    type="button"
                    variant="tertiary"
                    data-size="sm"
                    onClick={() => { onRemoveExcept(idx, enc) }}
                  >
                    {describeExcept(e, groups)} ✕
                  </Button>
                )
              })
            )}
          </Paragraph>
          <ExceptPicker
            propertyUsers={propertyUsers}
            groups={groups}
            selectedEncoded={selectedExceptEncoded}
            onAdd={enc => { onAddExcept(idx, enc) }}
          />
        </Card.Block>

        <Card.Block data-size="sm">
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={idx === 0 || pending}
            onClick={() => { onMove(idx, -1) }}
          >
            ↑ Up
          </Button>
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={isLast || pending}
            onClick={() => { onMove(idx, 1) }}
          >
            ↓ Down
          </Button>
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={pending}
            onClick={() => { onRemove(idx) }}
          >
            Remove rule
          </Button>
        </Card.Block>
      </article>
    </Card>
  )
}

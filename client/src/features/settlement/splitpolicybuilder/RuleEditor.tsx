import {
  Button,
  Card,
  Heading,
  Paragraph,
  Select,
  Switch,
} from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation("settlement")
  const selectedExceptEncoded = new Set(rule.except.map(encodeExcept))
  const selectedWhoEncoded = new Set(rule.who.map(encodeWho))
  return (
    <Card asChild>
      <article>
        <Card.Block data-size="sm">
          <Heading level={5} data-size="2xs">
            {t("Rule #{{num}}", { num: idx + 1 })}
          </Heading>
          <Paragraph data-size="sm">
            {t("Split")}{" "}
            <Select
              data-size="sm"
              value={encodeWhat(rule.what)}
              onChange={e => {
                onPatch(idx, { what: decodeWhat(e.target.value) })
              }}
            >
              <Select.Option value="total">{t("total")}</Select.Option>
              {activeCategories.map(c => (
                <Select.Option
                  key={c.id}
                  value={`category:${String(c.id)}`}
                >
                  {t("category: {{name}}", { name: c.name })}
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
                  {(t as (k: string) => string)(label)}
                </Select.Option>
              ))}
            </Select>{" "}
            {t("between")}{" "}
            {rule.who.length === 0 ? (
              <em>{t("nobody selected")}</em>
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
            {t("who were")}{" "}
            <Select
              data-size="sm"
              value={encodeWhen(rule.when)}
              onChange={e => {
                onPatch(idx, { when: decodeWhen(e.target.value) })
              }}
            >
              {Object.entries(WHEN_LABEL).map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {(t as (k: string) => string)(label)}
                </Select.Option>
              ))}
              {eligibleOwners.length > 0 && (
                <Select.Optgroup label={t("Specific priority week")}>
                  {eligibleOwners.map(o => {
                    const enc = `during_priority_week:${String(o.property_owner_id)}`
                    return (
                      <Select.Option key={enc} value={enc}>
                        {t("{{name}}'s priority week", { name: o.user_name })}
                      </Select.Option>
                    )
                  })}
                </Select.Optgroup>
              )}
            </Select>
          </Paragraph>
          <Switch
            label={t("Include extra guest names (attributed to booker's group)")}
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
            <strong>{t("except:")}</strong>{" "}
            {rule.except.length === 0 ? (
              <em>{t("nobody")}</em>
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
            {t("↑ Up")}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={isLast || pending}
            onClick={() => { onMove(idx, 1) }}
          >
            {t("↓ Down")}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            data-size="sm"
            disabled={pending}
            onClick={() => { onRemove(idx) }}
          >
            {t("Remove rule")}
          </Button>
        </Card.Block>
      </article>
    </Card>
  )
}

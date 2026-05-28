import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button, Paragraph, Textfield } from "@digdir/designsystemet-react"
import { useTranslation } from "react-i18next"
import styles from "./AddressLookup.module.css"

export type GeonorgeAddress = {
  adressetekst: string
  postnummer: string
  poststed: string
  kommunenummer: string
  kommunenavn: string
  gardsnummer: number
  bruksnummer: number
  festenummer: number
  undernummer: number
  adressekode: number
  objtype: string
  representasjonspunkt: { lat: number; lon: number; epsg: string }
}

type GeonorgeResponse = {
  metadata: { totaltAntallTreff: number }
  adresser: GeonorgeAddress[]
}

type Props = {
  label?: string
  placeholder?: string
  onSelect: (address: GeonorgeAddress) => void
}

export function AddressLookup({ label, placeholder, onSelect }: Props) {
  const { t } = useTranslation("property")
  const resolvedLabel = label ?? t("Address lookup")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)
    return () => {
      clearTimeout(id)
    }
  }, [query])

  const { data, isFetching, error } = useQuery({
    queryKey: ["geonorge", "sok", debouncedQuery],
    queryFn: async ({ signal }) => {
      const url = new URL("https://ws.geonorge.no/adresser/v1/sok")
      url.searchParams.set("sok", debouncedQuery)
      url.searchParams.set("fuzzy", "true")
      url.searchParams.set("treffPerSide", "10")
      url.searchParams.set("side", "0")
      const res = await fetch(url, { signal })
      if (!res.ok) throw new Error(`Geonorge ${String(res.status)}`)
      return (await res.json()) as GeonorgeResponse
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60_000,
  })

  const results = data?.adresser ?? []
  const noMatches =
    debouncedQuery.length >= 2 &&
    !isFetching &&
    data?.metadata.totaltAntallTreff === 0

  return (
    <div className={styles.root}>
      <Textfield
        label={resolvedLabel}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
        }}
        placeholder={placeholder ?? t("e.g. Karl Johans gate 1")}
      />

      {isFetching && <Paragraph data-size="sm">{t("Searching…")}</Paragraph>}
      {error && (
        <Paragraph data-size="sm" role="alert">
          {t("Error: {{message}}", { message: error.message })}
        </Paragraph>
      )}
      {noMatches && <Paragraph data-size="sm">{t("No matches.")}</Paragraph>}

      {results.length > 0 && (
        <div className={styles.results}>
          {results.map(a => (
            <Button
              key={`${String(a.adressekode)}-${a.adressetekst}-${a.postnummer}`}
              type="button"
              variant="tertiary"
              className={styles.resultButton}
              onClick={() => {
                onSelect(a)
                setQuery("")
              }}
            >
              <Paragraph data-size="sm">
                {a.adressetekst} — {a.postnummer} {a.poststed}
              </Paragraph>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

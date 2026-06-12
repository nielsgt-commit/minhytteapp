import { eq } from "drizzle-orm"
import { z } from "zod"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  getCompactForecast,
  type YrTimeseries,
} from "../../services/yrCache.ts"
import { Temporal, zPlainDate } from "../../shared/temporal.ts"
import { propertyAdminProcedure, router } from "../init.ts"

const OSLO_TZ = "Europe/Oslo"

// yr API timestamps are ISO instants; bucket them by Oslo wall-clock day.
function osloZdt(time: string): Temporal.ZonedDateTime {
  return Temporal.Instant.from(time).toZonedDateTimeISO(OSLO_TZ)
}

function symbolFor(t: YrTimeseries): string | undefined {
  return (
    t.data.next_6_hours?.summary.symbol_code ??
    t.data.next_1_hours?.summary.symbol_code ??
    t.data.next_12_hours?.summary.symbol_code
  )
}

export type DayForecast = {
  iso: Temporal.PlainDate
  min_c: number
  max_c: number
  symbol_code: string | null
}

export type NowWeather = {
  temperature_c: number
  symbol_code: string | null
  updated_at: Temporal.Instant
}

export type HourSlot = {
  time: Temporal.Instant
  temperature_c: number
  symbol_code: string | null
}

export type ForecastResult = {
  now: NowWeather | null
  today: HourSlot[]
  days: DayForecast[]
}

// The next four 6-hour blocks ≈ the next 24h, aligned to the 00/06/12/18 Oslo
// grid so the client can label them as ranges (12–18, 18–00, …). yr's compact
// series is hourly near-term, so each boundary hour has its own entry — except
// the current block, which is already partly past, so the strip starts at the
// next boundary.
const TODAY_SLOTS = 4
const BLOCK_HOURS = 6

function buildToday(series: YrTimeseries[]): HourSlot[] {
  const slots: HourSlot[] = []

  for (const entry of series) {
    const time = Temporal.Instant.from(entry.time)
    if (osloZdt(entry.time).hour % BLOCK_HOURS !== 0) continue
    const temp = entry.data.instant.details.air_temperature
    if (typeof temp !== "number") continue

    slots.push({
      time,
      temperature_c: Math.round(temp * 10) / 10,
      symbol_code: symbolFor(entry) ?? null,
    })
    if (slots.length >= TODAY_SLOTS) break
  }

  return slots
}

function buildDays(
  series: YrTimeseries[],
  weekStart: Temporal.PlainDate,
): DayForecast[] {
  // Keyed by ISO string — PlainDate objects don't compare by value in a Map.
  const byIso = new Map<
    string,
    { min: number; max: number; symbol: string | null; symbolDelta: number }
  >()

  const targetIsos = new Set<string>()
  for (let i = 0; i < 7; i++) {
    targetIsos.add(weekStart.add({ days: i }).toString())
  }

  for (const entry of series) {
    const zdt = osloZdt(entry.time)
    const iso = zdt.toPlainDate().toString()
    if (!targetIsos.has(iso)) continue
    const temp = entry.data.instant.details.air_temperature
    if (typeof temp !== "number") continue

    const existing = byIso.get(iso)
    const symbolDelta = Math.abs(zdt.hour - 12)
    const symbol = symbolFor(entry) ?? null

    if (!existing) {
      byIso.set(iso, { min: temp, max: temp, symbol, symbolDelta })
      continue
    }
    if (temp < existing.min) existing.min = temp
    if (temp > existing.max) existing.max = temp
    if (symbol && symbolDelta < existing.symbolDelta) {
      existing.symbol = symbol
      existing.symbolDelta = symbolDelta
    }
  }

  return Array.from(targetIsos)
    .sort()
    .flatMap(iso => {
      const v = byIso.get(iso)
      if (!v) return []
      return [
        {
          iso: Temporal.PlainDate.from(iso),
          min_c: Math.round(v.min * 10) / 10,
          max_c: Math.round(v.max * 10) / 10,
          symbol_code: v.symbol,
        },
      ]
    })
}

function buildNow(series: YrTimeseries[]): NowWeather | null {
  const first = series.at(0)
  if (!first) return null
  const temp = first.data.instant.details.air_temperature
  if (typeof temp !== "number") return null
  return {
    temperature_c: Math.round(temp * 10) / 10,
    symbol_code: symbolFor(first) ?? null,
    updated_at: Temporal.Instant.from(first.time),
  }
}

export const weatherRouter = router({
  forProperty: propertyAdminProcedure
    .input(
      z.object({
        week_start: zPlainDate,
      }),
    )
    .query(async ({ ctx, input }): Promise<ForecastResult> => {
      const property = (
        await ctx.db
          .select({
            latitude: propertyTable.latitude,
            longitude: propertyTable.longitude,
          })
          .from(propertyTable)
          .where(eq(propertyTable.id, input.property_id))
          .limit(1)
      ).at(0)

      if (!property?.latitude || !property.longitude) {
        return { now: null, today: [], days: [] }
      }

      try {
        const forecast = await getCompactForecast(
          property.latitude,
          property.longitude,
        )
        const series = forecast.properties.timeseries
        return {
          now: buildNow(series),
          today: buildToday(series),
          days: buildDays(series, input.week_start),
        }
      } catch (err) {
        console.warn("[weather] fetch failed:", err)
        return { now: null, today: [], days: [] }
      }
    }),
})

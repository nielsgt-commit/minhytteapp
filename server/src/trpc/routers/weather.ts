import { eq } from "drizzle-orm"
import { z } from "zod"
import { propertyTable } from "../../db/schema/property.schema.ts"
import {
  getCompactForecast,
  type YrTimeseries,
} from "../../services/yrCache.ts"
import { publicProcedure, router } from "../init.ts"

const OSLO_TZ = "Europe/Oslo"

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: OSLO_TZ,
  hour: "2-digit",
  hour12: false,
})

function toOsloIso(time: string): string {
  return isoDateFormatter.format(new Date(time))
}

function osloHour(time: string): number {
  return Number(hourFormatter.format(new Date(time)))
}

function symbolFor(t: YrTimeseries): string | undefined {
  return (
    t.data.next_6_hours?.summary.symbol_code ??
    t.data.next_1_hours?.summary.symbol_code ??
    t.data.next_12_hours?.summary.symbol_code
  )
}

export type DayForecast = {
  iso: string
  min_c: number
  max_c: number
  symbol_code: string | null
}

export type NowWeather = {
  temperature_c: number
  symbol_code: string | null
  updated_at: string
}

export type ForecastResult = {
  now: NowWeather | null
  days: DayForecast[]
}

function buildDays(series: YrTimeseries[], weekStart: string): DayForecast[] {
  const byIso = new Map<
    string,
    { min: number; max: number; symbol: string | null; symbolDelta: number }
  >()

  const targetIsos = new Set<string>()
  const start = new Date(`${weekStart}T00:00:00Z`)
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    targetIsos.add(isoDateFormatter.format(d))
  }

  for (const entry of series) {
    const iso = toOsloIso(entry.time)
    if (!targetIsos.has(iso)) continue
    const temp = entry.data.instant.details.air_temperature
    if (typeof temp !== "number") continue

    const existing = byIso.get(iso)
    const hour = osloHour(entry.time)
    const symbolDelta = Math.abs(hour - 12)
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
    .filter(iso => byIso.has(iso))
    .map(iso => {
      const v = byIso.get(iso)!
      return {
        iso,
        min_c: Math.round(v.min * 10) / 10,
        max_c: Math.round(v.max * 10) / 10,
        symbol_code: v.symbol,
      }
    })
}

function buildNow(series: YrTimeseries[]): NowWeather | null {
  const first = series[0]
  if (!first) return null
  const temp = first.data.instant.details.air_temperature
  if (typeof temp !== "number") return null
  return {
    temperature_c: Math.round(temp * 10) / 10,
    symbol_code: symbolFor(first) ?? null,
    updated_at: first.time,
  }
}

export const weatherRouter = router({
  forProperty: publicProcedure
    .input(
      z.object({
        property_id: z.number().int().positive(),
        week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .query(async ({ ctx, input }): Promise<ForecastResult> => {
      const [property] = await ctx.db
        .select({
          latitude: propertyTable.latitude,
          longitude: propertyTable.longitude,
        })
        .from(propertyTable)
        .where(eq(propertyTable.id, input.property_id))
        .limit(1)

      if (!property?.latitude || !property.longitude) {
        return { now: null, days: [] }
      }

      try {
        const forecast = await getCompactForecast(
          property.latitude,
          property.longitude,
        )
        const series = forecast.properties.timeseries
        return {
          now: buildNow(series),
          days: buildDays(series, input.week_start),
        }
      } catch (err) {
        console.warn("[weather] fetch failed:", err)
        return { now: null, days: [] }
      }
    }),
})

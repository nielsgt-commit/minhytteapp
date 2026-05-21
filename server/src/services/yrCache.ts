const COMPACT_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact"
const DEFAULT_USER_AGENT = "minhytteapp/1.0 github.com/nielsgt-commit/minhytteapp"

export type YrTimeseries = {
  time: string
  data: {
    instant: {
      details: {
        air_temperature?: number
        wind_speed?: number
      }
    }
    next_1_hours?: {
      summary: { symbol_code: string }
      details?: { precipitation_amount?: number }
    }
    next_6_hours?: {
      summary: { symbol_code: string }
      details?: {
        air_temperature_max?: number
        air_temperature_min?: number
        precipitation_amount?: number
      }
    }
    next_12_hours?: {
      summary: { symbol_code: string }
    }
  }
}

export type YrForecast = {
  properties: { timeseries: YrTimeseries[] }
}

type CacheEntry = {
  body: YrForecast
  expiresAt: number
  lastModified: string | null
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<YrForecast>>()

function userAgent(): string {
  return process.env.MET_USER_AGENT ?? DEFAULT_USER_AGENT
}

function parseExpires(headerValue: string | null): number {
  if (!headerValue) return Date.now() + 30 * 60_000
  const ms = Date.parse(headerValue)
  if (Number.isNaN(ms) || ms <= Date.now()) {
    return Date.now() + 30 * 60_000
  }
  return ms
}

export async function getCompactForecast(
  latitude: string,
  longitude: string,
): Promise<YrForecast> {
  const key = `${latitude},${longitude}`
  const cached = cache.get(key)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.body
  }

  const existing = inflight.get(key)
  if (existing) return existing

  const promise = (async (): Promise<YrForecast> => {
    const url = `${COMPACT_URL}?lat=${latitude}&lon=${longitude}`
    const headers: Record<string, string> = {
      "User-Agent": userAgent(),
      Accept: "application/json",
    }
    if (cached?.lastModified) {
      headers["If-Modified-Since"] = cached.lastModified
    }

    let res: Response
    try {
      res = await fetch(url, { headers })
    } catch (err) {
      console.warn("[yr] network error:", err)
      if (cached) return cached.body
      throw err
    }

    if (res.status === 304 && cached) {
      cache.set(key, {
        body: cached.body,
        expiresAt: parseExpires(res.headers.get("expires")),
        lastModified: cached.lastModified,
      })
      return cached.body
    }

    if (!res.ok) {
      console.warn(`[yr] ${String(res.status)} for ${key}`)
      if (cached) return cached.body
      throw new Error(`YR responded with ${String(res.status)}`)
    }

    const body = (await res.json()) as YrForecast
    cache.set(key, {
      body,
      expiresAt: parseExpires(res.headers.get("expires")),
      lastModified: res.headers.get("last-modified"),
    })
    return body
  })()

  inflight.set(key, promise)
  try {
    return await promise
  } finally {
    inflight.delete(key)
  }
}

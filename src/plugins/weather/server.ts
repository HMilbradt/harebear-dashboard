import { z } from "zod"
import { definePlugin, type PluginContext } from "@/sdk/plugin"

interface Place {
  name: string
  admin1?: string
  country?: string
  latitude: number
  longitude: number
}

const places = new Map<string, Place>()

export default definePlugin({
  id: "weather",
  name: "Weather",
  description: "Current conditions, today's high and low, and the next hours, from Open-Meteo (no API key).",
  options: z.object({
    location: z
      .string()
      .describe('Place name, optionally with region and country: "Langley, British Columbia, Canada"'),
    units: z.enum(["metric", "imperial"]).default("metric"),
    hourFormat: z.enum(["12h", "24h"]).default("24h"),
    hideLocation: z.boolean().default(false),
    week: z.boolean().default(false).describe("Also show the next 7 days"),
  }),
  hosts: () => ["geocoding-api.open-meteo.com", "api.open-meteo.com"],
  refresh: "15m",
  async load({ options, fetch }) {
    const place = await geocode(options.location, fetch)
    const q = new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,apparent_temperature,weather_code,is_day",
      hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "auto",
      forecast_days: options.week ? "7" : "2",
      temperature_unit: options.units === "imperial" ? "fahrenheit" : "celsius",
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`)
    if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`)
    const f = await res.json<Forecast>()
    const nowIndex = Math.max(
      0,
      f.hourly.time.findIndex((t) => t >= f.current.time.slice(0, 13)),
    )
    const hours = f.hourly.time.slice(nowIndex, nowIndex + 12).map((t, i) => {
      const j = nowIndex + i
      const h = Number(t.slice(11, 13))
      return {
        label:
          options.hourFormat === "12h"
            ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`
            : `${String(h).padStart(2, "0")}:00`,
        temp: Math.round(f.hourly.temperature_2m[j] ?? 0),
        code: f.hourly.weather_code[j] ?? 0,
        isDay: f.hourly.is_day[j] === 1,
        precip: f.hourly.precipitation_probability[j] ?? 0,
      }
    })
    return {
      place: options.hideLocation ? undefined : [place.name, place.admin1].filter(Boolean).join(", "),
      unit: options.units === "imperial" ? "°F" : "°C",
      temp: Math.round(f.current.temperature_2m),
      feelsLike: Math.round(f.current.apparent_temperature),
      code: f.current.weather_code,
      isDay: f.current.is_day === 1,
      description: describe(f.current.weather_code),
      high: Math.round(f.daily.temperature_2m_max[0] ?? 0),
      low: Math.round(f.daily.temperature_2m_min[0] ?? 0),
      hours,
      weekMin: Math.round(Math.min(...f.daily.temperature_2m_min)),
      weekMax: Math.round(Math.max(...f.daily.temperature_2m_max)),
      days: options.week
        ? f.daily.time.map((date, i) => ({
            label:
              i === 0
                ? "Today"
                : new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }),
            code: f.daily.weather_code[i] ?? 0,
            high: Math.round(f.daily.temperature_2m_max[i] ?? 0),
            low: Math.round(f.daily.temperature_2m_min[i] ?? 0),
            precip: f.daily.precipitation_probability_max[i] ?? 0,
          }))
        : [],
    }
  },
})

interface Forecast {
  current: { time: string; temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number }
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation_probability: number[]
    weather_code: number[]
    is_day: number[]
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

async function geocode(location: string, fetch: PluginContext<unknown, unknown>["fetch"]) {
  const cached = places.get(location)
  if (cached) return cached
  const [name, ...qualifiers] = location.split(",").map((s) => s.trim())
  const q = new URLSearchParams({ name: name ?? location, count: "20", language: "en", format: "json" })
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`)
  if (!res.ok) throw new Error(`Open-Meteo geocoding returned HTTP ${res.status}`)
  const { results = [] } = await res.json<{ results?: Place[] }>()
  const lower = qualifiers.map((s) => s.toLowerCase())
  const match =
    results.find((r) => lower.every((q) => [r.admin1, r.country].some((v) => v?.toLowerCase() === q))) ?? results[0]
  if (!match) throw new Error(`No place found for "${location}"`)
  places.set(location, match)
  return match
}

function describe(code: number): string {
  if (code === 0) return "Clear"
  if (code <= 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code <= 48) return "Fog"
  if (code <= 57) return "Drizzle"
  if (code <= 67) return "Rain"
  if (code <= 77) return "Snow"
  if (code <= 82) return "Showers"
  if (code <= 86) return "Snow showers"
  return "Thunderstorm"
}

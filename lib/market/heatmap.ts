// Canonical gamma-heatmap data shapes. Cells are built from real strike x
// expiration gamma data. Metrics we cannot source per-cell are marked
// unsupported rather than fabricated.

export interface HeatmapCell {
  strike: number
  expiration: string
  callGex: number
  putGex: number
  netGex: number
  callOi: number
  putOi: number
  callVolume: number
  putVolume: number
  iv?: number
  liquidityScore: number
}

export type HeatmapMetric =
  | "netGex"
  | "callGex"
  | "putGex"
  | "oi"
  | "volume"

export interface HeatmapMarker {
  strike: number
  kind: "spot" | "gamma-flip" | "call-wall" | "put-wall"
}

export interface HeatmapGrid {
  symbol: string
  spot: number
  /** Ascending strike prices (Y axis). */
  strikes: number[]
  /** Expirations nearest -> farthest (X axis). */
  expirations: string[]
  cells: HeatmapCell[]
  markers: HeatmapMarker[]
  /** Metrics that have real per-cell data on the current API plan. */
  supportedMetrics: HeatmapMetric[]
  dataTimestamp: string
}

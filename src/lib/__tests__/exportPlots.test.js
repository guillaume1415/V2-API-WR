import { describe, it, expect } from 'vitest'
import { buildAnalyseTraces } from '../analyse/plots.js'

const fakeT = (k) => k

function fakeSeries(n = 20) {
  const xs = Array.from({ length: n }, (_, i) => i * 10)
  const speeds = Array.from({ length: n }, () => 5)
  const cads = Array.from({ length: n }, () => 32)
  return [
    {
      xs,
      speeds,
      cads,
      gaps: speeds.map(() => 0),
      ranks: speeds.map(() => 1),
      dpsArr: speeds.map((s, i) => (s * 60) / cads[i]),
      lane: { DisplayName: 'FRA', Lane: 1, intermediates: [] },
    },
  ]
}

describe('buildAnalyseTraces traceType', () => {
  it('uses scatter when traceType is forced (HTML export path)', () => {
    const traces = buildAnalyseTraces({
      series: fakeSeries(),
      totalLength: 2000,
      colorBy: 'cadence',
      sizeByDps: false,
      cScales: {},
      globalScales: {},
      t: fakeT,
      traceType: 'scatter',
    })
    expect(traces.speed[0].type).toBe('scatter')
    expect(traces.cadence[0].type).toBe('scatter')
    expect(traces.gap[0].type).toBe('scatter')
    expect(traces.dps[0].type).toBe('scatter')
  })
})

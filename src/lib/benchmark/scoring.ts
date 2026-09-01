/**
 * Motor de comparación contra el sector.
 *
 * Todo lo que la vista de auditoría muestra se calcula aquí y se guarda junto al
 * assessment, para que un resultado entregado a un cliente no cambie cuando el
 * benchmark del siguiente periodo se publique.
 */

import { BLOCKS, KPIS, getKpi, type BlockId, type Kpi } from './kpis'
import { PRACTICES, getPractice, type Practice, type PracticeOption } from './practices'

export const SCORING_VERSION = 1

/** Objetivo de referencia: llegar al percentil 75 del sector. */
export const OBJETIVO_PERCENTIL = 75

export type Distribution = {
  kpiSlug: string
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
  sampleSize: number
  sourceNote: string
}

export type Answers = Record<string, number | string | null>

export type Position = 'rezago' | 'promedio' | 'ventaja'

export type KpiComparison = {
  kpiSlug: string
  name: string
  block: BlockId
  unit: Kpi['unit']
  direction: Kpi['direction']
  scored: boolean
  value: number | null
  percentile: number | null
  score: number | null
  position: Position | null
  /** Diferencia contra la mediana, en las unidades del KPI. */
  gapToMedian: number | null
  /** Valor necesario para alcanzar el percentil objetivo. */
  target: number | null
  distribution: Distribution | null
  gapMeaning: string
}

export type PracticeComparison = {
  practiceSlug: string
  block: BlockId
  question: string
  value: string | null
  score: number | null
  optionLabel: string | null
  bestLabel: string
  gapMeaning: string
}

export type BlockResult = {
  blockId: BlockId
  name: string
  weight: number
  score: number | null
  kpis: KpiComparison[]
  practices: PracticeComparison[]
}

export type Priority = {
  kind: 'kpi' | 'practice'
  slug: string
  label: string
  block: BlockId
  score: number
  /** Puntos de puntaje global que se recuperan al llevar este ítem al objetivo. */
  upside: number
  meaning: string
}

export type FunnelStep = { label: string; value: number }

export type FunnelModel = {
  /** Ingreso mensual estimado con los números actuales. */
  ingresoActual: number
  steps: FunnelStep[]
  /** Escenarios de un solo cambio: ese KPI al percentil objetivo, el resto igual. */
  escenarios: { kpiSlug: string; label: string; ingreso: number; delta: number }[]
}

export type Tier = {
  id: 'critico' | 'construccion' | 'solido' | 'referente'
  label: string
  claim: string
}

export type Result = {
  version: number
  period: string
  specialtySlug: string
  segmentSlug: string
  globalScore: number
  tier: Tier
  blocks: BlockResult[]
  /** % de KPIs numéricos que el profesional pudo responder. */
  indiceMedicion: number
  kpisRespondidos: number
  kpisTotales: number
  priorities: Priority[]
  funnel: FunnelModel | null
  computedAt: string
}

const TIERS: Tier[] = [
  {
    id: 'referente',
    label: 'Referente del sector',
    claim: 'Estás en el cuartil alto. El trabajo aquí es defender la posición y escalar sin perder margen.',
  },
  {
    id: 'solido',
    label: 'Sólido',
    claim: 'Por encima del promedio en lo esencial. Hay dos o tres huecos concretos que valen dinero.',
  },
  {
    id: 'construccion',
    label: 'En construcción',
    claim: 'Los fundamentos existen pero no están sistematizados. Es el punto donde más rápido se recupera ingreso.',
  },
  {
    id: 'critico',
    label: 'Zona crítica',
    claim: 'El consultorio está sostenido por el esfuerzo clínico, no por el proceso comercial. Cada mes se está fugando ingreso medible.',
  },
]

export function tierFor(score: number): Tier {
  if (score >= 80) return TIERS[0]
  if (score >= 65) return TIERS[1]
  if (score >= 45) return TIERS[2]
  return TIERS[3]
}

/**
 * Percentil de `value` dentro de la distribución, interpolando linealmente entre
 * los anclajes p10..p90 y extrapolando de forma acotada fuera de ese rango.
 * Devuelve siempre 2..98: nunca afirmamos un extremo absoluto con 5 anclajes.
 */
export function percentileOf(value: number, d: Distribution): number {
  const anchors: [number, number][] = [
    [d.p10, 10],
    [d.p25, 25],
    [d.p50, 50],
    [d.p75, 75],
    [d.p90, 90],
  ]

  if (value <= anchors[0][0]) {
    const span = anchors[0][0]
    const ratio = span > 0 ? Math.max(0, value) / span : 1
    return clamp(2 + 8 * ratio, 2, 10)
  }

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [lowValue, lowPct] = anchors[i]
    const [highValue, highPct] = anchors[i + 1]
    if (value <= highValue) {
      const span = highValue - lowValue
      const ratio = span > 0 ? (value - lowValue) / span : 1
      return clamp(lowPct + ratio * (highPct - lowPct), 2, 98)
    }
  }

  const top = anchors[anchors.length - 1][0]
  const headroom = Math.max(top * 0.5, 1)
  return clamp(90 + 8 * Math.min(1, (value - top) / headroom), 90, 98)
}

/** Valor del KPI que corresponde a un percentil dado (inversa de `percentileOf`). */
export function valueAtPercentile(pct: number, d: Distribution): number {
  const anchors: [number, number][] = [
    [10, d.p10],
    [25, d.p25],
    [50, d.p50],
    [75, d.p75],
    [90, d.p90],
  ]
  if (pct <= 10) return d.p10
  if (pct >= 90) return d.p90
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [lowPct, lowValue] = anchors[i]
    const [highPct, highValue] = anchors[i + 1]
    if (pct <= highPct) {
      const ratio = (pct - lowPct) / (highPct - lowPct)
      return lowValue + ratio * (highValue - lowValue)
    }
  }
  return d.p90
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function positionFor(score: number): Position {
  if (score < 40) return 'rezago'
  if (score < 65) return 'promedio'
  return 'ventaja'
}

function numericAnswer(answers: Answers, slug: string): number | null {
  const raw = answers[slug]
  if (raw === null || raw === undefined || raw === '') return null
  const n = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(n) ? n : null
}

function choiceAnswer(answers: Answers, slug: string): string | null {
  const raw = answers[slug]
  return typeof raw === 'string' && raw !== '' ? raw : null
}

function compareKpi(
  kpi: Kpi,
  answers: Answers,
  distributions: Map<string, Distribution>,
): KpiComparison {
  const value = numericAnswer(answers, kpi.slug)
  const distribution = distributions.get(kpi.slug) ?? null

  let percentile: number | null = null
  let score: number | null = null
  let gapToMedian: number | null = null
  let target: number | null = null

  if (value !== null && distribution) {
    percentile = Math.round(percentileOf(value, distribution))
    score = kpi.direction === 'higher_better' ? percentile : 100 - percentile
    gapToMedian = value - distribution.p50
    const targetPct =
      kpi.direction === 'higher_better' ? OBJETIVO_PERCENTIL : 100 - OBJETIVO_PERCENTIL
    target = valueAtPercentile(targetPct, distribution)
  }

  return {
    kpiSlug: kpi.slug,
    name: kpi.name,
    block: kpi.block,
    unit: kpi.unit,
    direction: kpi.direction,
    scored: kpi.scored,
    value,
    percentile,
    score,
    position: score === null ? null : positionFor(score),
    gapToMedian,
    target,
    distribution,
    gapMeaning: kpi.gapMeaning,
  }
}

function comparePractice(practice: Practice, answers: Answers): PracticeComparison {
  const value = choiceAnswer(answers, practice.slug)
  const option: PracticeOption | undefined = practice.options.find((o) => o.value === value)
  const best = practice.options.reduce((a, b) => (b.score > a.score ? b : a))

  return {
    practiceSlug: practice.slug,
    block: practice.block,
    question: practice.question,
    value,
    score: option ? option.score : null,
    optionLabel: option ? option.label : null,
    bestLabel: best.label,
    gapMeaning: practice.gapMeaning,
  }
}

function weightedMean(items: { score: number; weight: number }[]): number | null {
  const usable = items.filter((i) => i.weight > 0)
  if (usable.length === 0) return null
  const totalWeight = usable.reduce((sum, i) => sum + i.weight, 0)
  if (totalWeight === 0) return null
  return usable.reduce((sum, i) => sum + i.score * i.weight, 0) / totalWeight
}

function buildFunnel(
  kpiResults: Map<string, KpiComparison>,
): FunnelModel | null {
  const required = ['leads-mes', 'lead-a-cita', 'no-show', 'tasa-cierre', 'ticket-promedio']
  const values: Record<string, number> = {}
  for (const slug of required) {
    const value = kpiResults.get(slug)?.value
    if (value === null || value === undefined) return null
    values[slug] = value
  }

  const ingreso = (v: Record<string, number>) =>
    v['leads-mes'] *
    (v['lead-a-cita'] / 100) *
    (1 - v['no-show'] / 100) *
    (v['tasa-cierre'] / 100) *
    v['ticket-promedio']

  const ingresoActual = ingreso(values)

  const citas = values['leads-mes'] * (values['lead-a-cita'] / 100)
  const asistidas = citas * (1 - values['no-show'] / 100)
  const casos = asistidas * (values['tasa-cierre'] / 100)

  const steps: FunnelStep[] = [
    { label: 'Contactos nuevos', value: values['leads-mes'] },
    { label: 'Citas agendadas', value: citas },
    { label: 'Citas asistidas', value: asistidas },
    { label: 'Casos aceptados', value: casos },
  ]

  const escenarios = required
    .filter((slug) => slug !== 'leads-mes')
    .map((slug) => {
      const comparison = kpiResults.get(slug)!
      if (comparison.target === null) return null
      const scenario = { ...values, [slug]: comparison.target }
      const ingresoEscenario = ingreso(scenario)
      return {
        kpiSlug: slug,
        label: getKpi(slug).name,
        ingreso: ingresoEscenario,
        delta: ingresoEscenario - ingresoActual,
      }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null && e.delta > 0)
    .sort((a, b) => b.delta - a.delta)

  return { ingresoActual, steps, escenarios }
}

export type ScoreInput = {
  answers: Answers
  distributions: Distribution[]
  specialtySlug: string
  segmentSlug: string
  period: string
}

export function scoreAssessment(input: ScoreInput): Result {
  const distributions = new Map(input.distributions.map((d) => [d.kpiSlug, d]))

  const kpiResults = new Map<string, KpiComparison>(
    KPIS.map((kpi) => [kpi.slug, compareKpi(kpi, input.answers, distributions)]),
  )
  const practiceResults = new Map<string, PracticeComparison>(
    PRACTICES.map((p) => [p.slug, comparePractice(p, input.answers)]),
  )

  const blocks: BlockResult[] = BLOCKS.map((block) => {
    const kpis = KPIS.filter((k) => k.block === block.id).map((k) => kpiResults.get(k.slug)!)
    const practices = PRACTICES.filter((p) => p.block === block.id).map(
      (p) => practiceResults.get(p.slug)!,
    )

    const items = [
      ...kpis
        .filter((k) => k.scored && k.score !== null)
        .map((k) => ({ score: k.score!, weight: getKpi(k.kpiSlug).weight })),
      ...practices
        .filter((p) => p.score !== null)
        .map((p) => ({ score: p.score!, weight: getPractice(p.practiceSlug).weight })),
    ]

    return {
      blockId: block.id,
      name: block.name,
      weight: block.weight,
      score: weightedMean(items),
      kpis,
      practices,
    }
  })

  const globalScore =
    weightedMean(
      blocks
        .filter((b) => b.score !== null)
        .map((b) => ({ score: b.score!, weight: b.weight })),
    ) ?? 0

  const scorableKpis = KPIS.filter((k) => k.scored)
  const answeredKpis = scorableKpis.filter((k) => kpiResults.get(k.slug)!.score !== null)

  return {
    version: SCORING_VERSION,
    period: input.period,
    specialtySlug: input.specialtySlug,
    segmentSlug: input.segmentSlug,
    globalScore: Math.round(globalScore),
    tier: tierFor(globalScore),
    blocks,
    indiceMedicion: Math.round((answeredKpis.length / scorableKpis.length) * 100),
    kpisRespondidos: answeredKpis.length,
    kpisTotales: scorableKpis.length,
    priorities: buildPriorities(blocks),
    funnel: buildFunnel(kpiResults),
    computedAt: new Date().toISOString(),
  }
}

/**
 * Ordena los huecos por cuántos puntos del puntaje global recupera cerrarlos.
 * Así la prioridad #1 es la que más mueve el resultado, no la más llamativa.
 */
function buildPriorities(blocks: BlockResult[]): Priority[] {
  const candidates: Priority[] = []

  for (const block of blocks) {
    const blockWeightTotal =
      KPIS.filter((k) => k.block === block.blockId && k.scored).reduce(
        (sum, k) => sum + k.weight,
        0,
      ) +
      PRACTICES.filter((p) => p.block === block.blockId).reduce((sum, p) => sum + p.weight, 0)

    if (blockWeightTotal === 0) continue

    for (const kpi of block.kpis) {
      if (!kpi.scored || kpi.score === null || kpi.score >= OBJETIVO_PERCENTIL) continue
      const share = (getKpi(kpi.kpiSlug).weight / blockWeightTotal) * block.weight
      candidates.push({
        kind: 'kpi',
        slug: kpi.kpiSlug,
        label: kpi.name,
        block: block.blockId,
        score: kpi.score,
        upside: (OBJETIVO_PERCENTIL - kpi.score) * share,
        meaning: kpi.gapMeaning,
      })
    }

    for (const practice of block.practices) {
      if (practice.score === null || practice.score >= OBJETIVO_PERCENTIL) continue
      const share = (getPractice(practice.practiceSlug).weight / blockWeightTotal) * block.weight
      candidates.push({
        kind: 'practice',
        slug: practice.practiceSlug,
        label: practice.question,
        block: block.blockId,
        score: practice.score,
        upside: (OBJETIVO_PERCENTIL - practice.score) * share,
        meaning: practice.gapMeaning,
      })
    }
  }

  return candidates.sort((a, b) => b.upside - a.upside).slice(0, 5)
}

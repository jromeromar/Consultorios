import type { Tier } from '@/lib/benchmark/scoring'

const TIER_COLOR: Record<Tier['id'], string> = {
  referente: 'var(--color-good)',
  solido: 'var(--color-series-1)',
  construccion: 'var(--color-warning)',
  critico: 'var(--color-critical)',
}

const TIER_ICON: Record<Tier['id'], string> = {
  referente: '▲',
  solido: '●',
  construccion: '◆',
  critico: '■',
}

/**
 * Medidor del puntaje global. Es una cifra protagonista con un arco de apoyo,
 * no una gráfica: el número es el dato y el color del arco solo repite el nivel,
 * que además va escrito con icono y etiqueta.
 */
export function ScoreDial({ score, tier }: { score: number; tier: Tier }) {
  const radius = 70
  const circumference = Math.PI * radius
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[184px]">
        <svg viewBox="0 0 184 104" className="w-full" role="presentation">
          <path
            d="M 22 92 A 70 70 0 0 1 162 92"
            fill="none"
            stroke="var(--color-surface-2)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 22 92 A 70 70 0 0 1 162 92"
            fill="none"
            stroke={TIER_COLOR[tier.id]}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className="text-[44px] font-semibold leading-none tracking-tight text-[var(--color-ink)]">
            {score}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.09em] text-[var(--color-muted)]">
            de 100
          </div>
        </div>
      </div>
      <p
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-hair)] px-3 py-1 text-[13px] font-medium"
        style={{ color: TIER_COLOR[tier.id] }}
      >
        <span aria-hidden>{TIER_ICON[tier.id]}</span>
        {tier.label}
      </p>
    </div>
  )
}

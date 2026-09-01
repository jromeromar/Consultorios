import 'server-only'

import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'

import { PERIOD_ACTUAL, SPECIALTIES, getSpecialty } from '@/lib/benchmark/taxonomy'

const DIR = path.join(process.cwd(), 'content/estudios')

export type Study = {
  slug: string
  title: string
  specialtySlug: string
  period: string
  summary: string
  published: string
  /** Cuerpo editorial ya convertido a HTML. */
  html: string
}

type Frontmatter = {
  title?: string
  specialty?: string
  period?: string
  summary?: string
  published?: string
}

/**
 * Los estudios viven como Markdown con frontmatter en content/estudios, para
 * que la parte editorial pueda pasar a un CMS de git (Decap) sin tocar código:
 * el panel escribe estos mismos archivos. Las cifras nunca vienen de aquí —
 * salen de `benchmark_stats`.
 */
export async function getStudies(): Promise<Study[]> {
  let files: string[] = []
  try {
    files = (await readdir(DIR)).filter((f) => f.endsWith('.md'))
  } catch {
    return []
  }

  const studies = await Promise.all(files.map((file) => readStudy(file)))
  return studies
    .filter((s): s is Study => s !== null)
    .sort((a, b) => a.title.localeCompare(b.title, 'es'))
}

async function readStudy(file: string): Promise<Study | null> {
  const raw = await readFile(path.join(DIR, file), 'utf8')
  const { data, content } = matter(raw)
  const front = data as Frontmatter
  const specialtySlug = front.specialty ?? ''
  if (!getSpecialty(specialtySlug)) return null

  return {
    slug: file.replace(/\.md$/, ''),
    title: front.title ?? getSpecialty(specialtySlug)!.name,
    specialtySlug,
    period: front.period ?? PERIOD_ACTUAL,
    summary: front.summary ?? '',
    published: front.published ?? '',
    html: await marked.parse(content.trim()),
  }
}

export async function getStudy(slug: string): Promise<Study | null> {
  const studies = await getStudies()
  return studies.find((s) => s.slug === slug) ?? null
}

/** Especialidades que aún no tienen archivo editorial publicado. */
export async function getSpecialtiesWithoutStudy(): Promise<string[]> {
  const studies = await getStudies()
  const covered = new Set(studies.map((s) => s.specialtySlug))
  return SPECIALTIES.filter((s) => !covered.has(s.slug)).map((s) => s.name)
}

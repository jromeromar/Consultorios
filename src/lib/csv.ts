/**
 * Lector de CSV mínimo pero correcto (RFC 4180): comillas, comas dentro de
 * comillas, comillas escapadas y saltos de línea dentro de campos.
 *
 * Sin dependencia: los CSV del benchmark son archivos que edita una persona en
 * una hoja de cálculo, no un formato exótico.
 */

export type CsvRow = Record<string, string>

export function parseCsv(text: string): CsvRow[] {
  const rows = parseRows(text.replace(/^﻿/, ''))
  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    // Una hoja de cálculo suele dejar filas vacías al final.
    .filter((cells) => cells.some((c) => c.trim() !== ''))
    .map((cells) => {
      const row: CsvRow = {}
      headers.forEach((header, i) => {
        row[header] = (cells[i] ?? '').trim()
      })
      return row
    })
}

function parseRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',' || char === ';') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/**
 * Convierte a número tolerando lo que sale de una hoja de cálculo en español:
 * separador de miles con punto, decimal con coma, símbolo de moneda, % y espacios
 * (incluido el espacio duro que mete Excel).
 *
 * Devuelve null para vacío, «n/a», «no lo mide» y demás marcas de ausencia: en el
 * benchmark eso no es un cero, es un dato que no existe.
 */
export function parseNumber(raw: string): number | null {
  const value = raw.trim().toLowerCase()
  if (value === '') return null
  if (['n/a', 'na', 'nd', 'n.d.', '-', '--', 'null', 'no lo mide', 'no mide', 'sin dato'].includes(value)) {
    return null
  }

  let cleaned = value
    .replace(/[\s ]/g, '')
    .replace(/[$€£]/g, '')
    .replace(/%/g, '')

  // 1.234.567,89 -> 1234567.89   |   1,234,567.89 -> 1234567.89
  const comas = (cleaned.match(/,/g) ?? []).length
  const puntos = (cleaned.match(/\./g) ?? []).length
  if (comas > 0 && puntos > 0) {
    cleaned = cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
      ? cleaned.replace(/\./g, '').replace(',', '.')
      : cleaned.replace(/,/g, '')
  } else if (comas > 1) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (comas === 1) {
    // Una sola coma: decimal si deja 1-2 dígitos detrás, miles si deja 3.
    const [, decimales = ''] = cleaned.split(',')
    cleaned = decimales.length === 3
      ? cleaned.replace(',', '')
      : cleaned.replace(',', '.')
  } else if (puntos > 1) {
    cleaned = cleaned.replace(/\./g, '')
  }

  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

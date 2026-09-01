/**
 * Gemelo tabular de una gráfica. Va siempre: ninguna cifra debe quedar
 * accesible solo por color o por hover.
 */
export function TableView({
  caption,
  headers,
  rows,
  label = 'Ver los datos en tabla',
}: {
  caption: string
  headers: string[]
  rows: (string | number)[][]
  label?: string
}) {
  return (
    <details className="mt-5 border-t border-[var(--color-hair)] pt-3">
      <summary className="cursor-pointer text-[12px] text-[var(--color-accent)]">{label}</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--color-hair)] text-left text-[var(--color-muted)]">
              {headers.map((header, i) => (
                <th
                  key={header}
                  scope="col"
                  className={`py-2 pr-4 font-medium ${i === 0 ? '' : 'text-right'}`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[var(--color-hair)] last:border-0">
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={`py-2 pr-4 ${i === 0 ? 'font-normal not-italic text-[var(--color-ink)]' : 'text-right text-[var(--color-ink-2)]'}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

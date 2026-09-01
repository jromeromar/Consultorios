# Datos del benchmark

Las cifras entran al sistema por un solo camino: la tabla `benchmark_stats`.
Ninguna vista, ningún cálculo y ningún estudio leen números de otro lugar. Eso
hace que sustituir los datos sintéticos de demostración por muestra real sea una
importación, no una refactorización.

```bash
npm run db:import -- data/observaciones-2026-s1.csv --nota "Muestra de campo, 214 consultorios, marzo 2026"
```

| Opción | Qué hace |
|---|---|
| `--nota "..."` | Procedencia de las cifras. Obligatoria para observaciones; queda guardada por celda y es lo que la interfaz muestra como ficha técnica. |
| `--dry-run` | Valida e informa sin escribir nada. Úsalo siempre la primera vez. |
| `--reemplazar` | Borra las celdas previas de los periodos y países que trae el archivo antes de insertar. Es la forma de eliminar los datos sintéticos. |

El importador **no escribe nada si encuentra un solo problema**. Los avisos
(columnas ignoradas, celdas con muestra corta) no bloquean; los problemas
(especialidad desconocida, percentiles desordenados, valores fuera de rango) sí.

## Dos formas de archivo

El importador detecta la forma por las columnas: si hay una columna `p50` la
trata como percentiles, si no, como observaciones.

### 1. Observaciones — una fila por consultorio

Es la forma natural del trabajo de campo: la hoja que llenas encuestando. El
importador calcula los percentiles, así que **no tienes que hacer estadística en
Excel**.

Plantilla: [`plantillas/observaciones.csv`](plantillas/observaciones.csv)

Columnas de identificación:

| Columna | Obligatoria | Notas |
|---|---|---|
| `especialidad` | sí | Uno de los slugs de la tabla de abajo. |
| `segmento` | no | `solo`, `clinica-pequena`, `clinica-multiple`. Si falta, la fila cuenta solo para el agregado de la especialidad. |
| `periodo` | no | `2026-S1`. Si falta, el periodo actual. |
| `pais` | no | `CO`. Si falta, `CO`. |
| `id`, `ciudad`, `notas` | no | Para tu control. No se guardan. |

Luego **una columna por KPI**, con el slug exacto como encabezado. Puedes incluir
solo los que tengas:

`tasa-cierre`, `ticket-promedio`, `lead-a-cita`, `no-show`, `leads-mes`,
`costo-por-lead`, `cac`, `tiempo-respuesta`, `precio-ancla`, `margen-bruto`,
`descuento-promedio`, `ocupacion-agenda`, `ingreso-por-unidad`, `tasa-retorno`

Una celda vacía —o con `n/a`, `nd`, `-`, `no lo mide`— **no es un cero**: esa
observación simplemente no entra en la distribución de ese KPI. Cada KPI se
agrega con las observaciones que sí lo tienen, así que un archivo con huecos es
perfectamente válido.

Los números se leen tolerando lo que sale de una hoja en español:
`4.200.000`, `4200000`, `$ 4.200.000` y `46,5` funcionan igual.

### 2. Percentiles — una fila por celda ya agregada

Para cuando las cifras vienen calculadas de fuera (un estudio publicado, otro
proveedor, tu propio análisis).

Plantilla: [`plantillas/percentiles.csv`](plantillas/percentiles.csv)

Columnas: `especialidad`, `segmento`, `periodo`, `pais`, `kpi`, `p10`, `p25`,
`p50`, `p75`, `p90`, `n`, y `fuente` (o `--nota` en la línea de comandos).

**Los percentiles van siempre de menor a mayor valor**, no de peor a mejor. Para
el no-show, `p10` es el 4 % (el mejor) y `p90` el 32 % (el peor); la dirección
la resuelve el catálogo de KPIs, no el orden del archivo. El importador rechaza
una fila desordenada.

## La muestra mínima

Una celda con menos de **12 observaciones no se publica**. Por dos razones a la
vez:

1. Con menos, los percentiles no significan nada.
2. Con muy pocas, un profesional podría deducir la cifra de un competidor
   concreto.

Cuando el corte específico no alcanza el mínimo, la consulta cae automáticamente
al agregado de la especialidad completa (segmento `all`), que el importador
calcula solo juntando todos los segmentos. Por eso conviene cargar todo lo que
tengas aunque los segmentos queden cortos: el agregado sí va a servir.

## Slugs válidos

Especialidades: `ortodoncia`, `odontologia-estetica`, `odontologia-general`,
`medicina-estetica`, `medicina-especialidad`, `nutricion-bienestar`

Segmentos: `all`, `solo`, `clinica-pequena`, `clinica-multiple`

Los slugs y la definición operativa de cada KPI viven en
`src/lib/benchmark/kpis.ts` y `src/lib/benchmark/taxonomy.ts`. Si necesitas un
KPI o una especialidad nueva, se añade ahí y aparece sola en el assessment, en
los estudios y en la auditoría.

## Qué NO va en estos archivos

Datos individuales identificables. El sistema guarda percentiles, nunca las
filas: las observaciones se agregan en el importador y se descartan. Si tu hoja
tiene nombres de consultorio, déjalos en tu copia y no los subas al repositorio
—`data/*.csv` está en `.gitignore` por eso, y solo se versionan las plantillas.

# Arquitectura

## La decisión de fondo

El producto no es un sitio con estudios: es un **ciclo de datos**. Un profesional responde un
assessment, se compara contra el sector, y su respuesta —anónima— alimenta el agregado que hace
posible la siguiente comparación. Eso obliga a tres cosas desde el primer día: base de datos
real, sesiones reales por usuario, y una separación estricta entre *cifras* y *narrativa*.

De ahí sale todo lo demás.

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | Render en servidor por defecto: las cifras del sector y el resultado de una auditoría nunca viajan al cliente sin pasar por la comprobación de sesión. Server Actions evitan una capa de API para tres formularios. |
| Estilos | Tailwind v4 con tokens CSS | Los tokens de color son los mismos que consumen las gráficas, así que la paleta se define una vez. |
| Base de datos | Postgres vía Drizzle ORM | Esquema tipado y migraciones versionadas en SQL. |
| Driver local | PGlite (Postgres en WASM) | Clonar y correr sin instalar nada, con el mismo dialecto que producción. |
| Autenticación | Propia: bcrypt + JWT en cookie httpOnly (`jose`) | Correo y contraseña es lo que el negocio necesita hoy; no vale traer un proveedor externo por eso. |
| Gráficas | Componentes propios en HTML/SVG | Sin librería: cuatro formas de gráfica, todas responsivas y con gemelo tabular. Pesan menos que cualquier dependencia. |
| Contenido editorial | Markdown en `content/estudios` + Decap CMS | La narrativa la escribe una persona; las cifras no se escriben a mano nunca. |

### Un esquema, dos drivers

`src/lib/db/connect.ts` decide por presencia de `DATABASE_URL`:

- **definido** → `postgres-js` contra Neon / Supabase / Vercel Postgres.
- **vacío** → PGlite en `.data/pglite`.

`src/lib/db/index.ts` envuelve eso en un singleton cacheado en `globalThis`, para que los
recargos en caliente de `next dev` no abran una conexión nueva por edición. Los scripts de CLI
usan `connect()` directo, porque `index.ts` está marcado `server-only`.

## Modelo de datos

Tres tablas. `drizzle/0000_inicial.sql` es la migración.

### `benchmark_stats` — el agregado del sector

Guarda **percentiles, no filas individuales**: `p10, p25, p50, p75, p90`, más `sample_size` y
`source_note`. La clave única es
`(kpi_slug, specialty_slug, segment_slug, period, country)`.

Es la decisión más importante del esquema, y es deliberada por dos razones:

1. **Privacidad.** No almacenamos las cifras de un tercero para poder mostrar la mediana del
   sector. Un profesional que responde el assessment aporta a un agregado, no a un expediente
   consultable.
2. **Estabilidad.** Los percentiles son exactamente lo que la auditoría necesita. Recalcular
   una distribución en cada visita, sobre una muestra que crece, haría que el mismo resultado
   cambiara entre dos cargas de la misma página.

El corte por segmento cae a `'all'` cuando la celda específica no existe
(`getDistributions`, en `src/lib/benchmark/queries.ts`): un segmento sin muestra suficiente se
compara contra su especialidad completa antes que no compararse.

### `assessments` — la respuesta y su resultado

Guarda `answers` (crudas) **y** `result` (calculado) como JSONB. Duplicar información así es
intencional: un resultado ya entregado a un cliente no puede cambiar porque se publicó el
benchmark del periodo siguiente o porque se ajustó una ponderación. `result.version` marca con
qué versión del motor se calculó.

`user_id` es nullable: el assessment **nace anónimo** (es el lead magnet) y se reclama al
registrarse con el mismo correo (`registrarse`, en `src/lib/auth/actions.ts`).

### `users`

Correo único, hash bcrypt (12 rondas), especialidad y segmento —que son el corte por defecto
de sus comparaciones— y `role` (`pro` | `admin`) para que el staff de la agencia pueda abrir
cualquier auditoría.

## El motor de scoring

Todo en `src/lib/benchmark/scoring.ts`, sin dependencias y sin acceso a base de datos: recibe
respuestas y distribuciones, devuelve un resultado. Eso lo hace verificable de forma aislada.

### De un valor a un puntaje

1. **Percentil por interpolación.** `percentileOf` interpola linealmente entre los anclajes
   p10–p90 y extrapola de forma acotada fuera de ese rango. Nunca devuelve menos de 2 ni más
   de 98: con cinco anclajes no se puede afirmar un extremo absoluto.
2. **Dirección.** `higher_better` → puntaje = percentil. `lower_better` (no-show, CAC,
   descuento, tiempo de respuesta) → puntaje = 100 − percentil. Las series de la base están
   siempre ordenadas por valor, no por calidad; la dirección la resuelve el KPI.
3. **Bloque.** Media ponderada de los ítems *respondidos*. No responder no penaliza: excluye.
4. **Global.** Media ponderada de los bloques con datos: comercial 35 %, captación 25 %, precio
   y margen 20 %, operación 20 %.

50 es, por construcción, la mediana de la especialidad.

### El índice de medición

`indiceMedicion` = qué porcentaje de los 13 indicadores puntuables pudo responder. Es un
resultado en sí mismo, no un dato de calidad de la muestra: en varias especialidades el hueco
real no es una tasa mala, es que nadie la mide. Por eso "No lo mido" es un botón visible en
cada pregunta numérica, no un campo vacío.

### Prioridades por impacto, no por gravedad

`buildPriorities` ordena los huecos por **cuántos puntos del puntaje global recupera** llevar
cada uno al percentil 75:

```
upside = (75 − puntaje_actual) × (peso_del_ítem / peso_total_del_bloque) × peso_del_bloque
```

Así la prioridad #1 es la que más mueve el resultado, no la más llamativa.

### El modelo de embudo

`buildFunnel` reconstruye el mes con las respuestas del propio profesional:

```
ingreso = contactos × (contacto→cita) × (1 − no-show) × cierre × ticket
```

Y calcula escenarios de **un solo cambio**: ese indicador al percentil 75, todo lo demás igual.
No se suman entre sí, y la interfaz lo dice. Si falta cualquiera de los cinco insumos, el
módulo entero no se muestra: es preferible a rellenar un hueco con un supuesto.

## Autenticación

- Contraseña con bcrypt, 12 rondas (`src/lib/auth/password.ts`).
- Sesión en JWT HS256 dentro de una cookie `httpOnly`, `sameSite=lax`, `secure` en producción,
  30 días (`src/lib/auth/session.ts`).
- `AUTH_SECRET` **debe** estar definido y tener 32+ caracteres en producción: si falta, el
  arranque de una sesión falla en voz alta en lugar de firmar con una constante.
- `getSessionUser()` nunca lanza por un token inválido o vencido: devuelve `null`.
- La guardia autoritativa es `src/app/plataforma/layout.tsx` (`requireUser`). Todas las páginas
  bajo `/plataforma` se renderizan en servidor, así que ninguna se ejecuta sin sesión. No hay
  middleware: sería una segunda fuente de verdad para la misma regla.
- El parámetro `?siguiente=` solo acepta rutas internas (`/^\/(?!\/)/`), para que no sirva como
  redirección abierta.
- Login con correo inexistente y contraseña incorrecta devuelven el **mismo** mensaje.

## Las gráficas

Cuatro formas, todas construidas a mano en HTML posicionado en porcentajes (responsivas sin
media queries y sin deformar texto) o SVG:

| Componente | Para qué |
|---|---|
| `PercentileBullet` | La forma central: banda p25–p75, marca de mediana y punto del profesional. Dos modos: comparativa (con marca propia) y sector (sin ella). |
| `ScoreDial` | El puntaje global. Cifra protagonista con arco de apoyo. |
| `ScoreBars` | Puntaje por bloque, con marca del objetivo p75. |
| `FunnelBars` | Etapas del embudo, rampa ordinal de un solo tono. |
| `SpecialtyBars` | Un indicador a través de las especialidades. |

Reglas que se siguieron y por qué se notan:

- **Una serie, un color.** Ninguna gráfica colorea las barras por magnitud: la longitud ya lo
  dice. La especialidad del usuario se destaca con peso de texto y fondo, nunca repintando las
  demás.
- **Ningún valor depende del hover.** Cada barra lleva su cifra rotulada y cada bloque tiene
  gemelo tabular (`TableView`).
- **Escala logarítmica donde hace falta.** `tiempo-respuesta` va de 3 minutos a más de un día;
  en escala lineal la mitad central se aplasta contra el borde izquierdo. El eje lo declara.
- **Paleta validada.** Los colores salen de una paleta verificada para daltonismo; los tonos de
  estado (`good`/`warning`/`critical`) siempre van acompañados de icono y etiqueta.

## Catálogo único de indicadores

`src/lib/benchmark/kpis.ts` define cada KPI **una sola vez**, y de ahí salen tres cosas: la
pregunta del assessment, la fila del benchmark y la barra de la auditoría. Cada uno lleva su
`help` (definición operativa, para que todos respondan lo mismo) y su `gapMeaning` (qué
significa estar por debajo de la mediana), así que la interpretación no vive dispersa en las
plantillas. `src/lib/benchmark/practices.ts` hace lo propio con las seis preguntas de madurez.

## Panel editorial

`content/estudios/*.md` con frontmatter; `src/lib/content/studies.ts` lo lee y convierte a
HTML. `public/admin/` trae la configuración de Decap CMS apuntando a esa carpeta.

Alcance deliberado: **el CMS solo edita narrativa**. Un editor no debería poder mover un
percentil desde un formulario.

Falta para que el panel funcione: Decap con backend `github` necesita un proxy OAuth (o
Netlify Identity con `git-gateway`). Hasta entonces `/admin` carga pero no autentica, y los
archivos se editan por pull request como cualquier otro cambio.

## Despliegue

1. Postgres gestionado (Neon, Supabase o Vercel Postgres) → `DATABASE_URL`.
2. `AUTH_SECRET` con `openssl rand -base64 48`.
3. `npm run db:migrate && npm run db:seed` contra esa base.
4. `npm run build`.

PGlite escribe en disco local: sirve para desarrollo, no para serverless. En producción
`DATABASE_URL` es obligatorio de facto.

## Lo que falta

En orden de lo que más mueve el producto:

1. **Muestra real.** Sustituir `reference-data.ts` por captura de campo. Con el ciclo ya
   cerrado, la fuente natural es el propio assessment: agregar respuestas a percentiles por
   celda cuando haya un mínimo por segmento (y no publicar la celda por debajo de ese mínimo).
2. **Vista de agencia.** El rol `admin` existe y puede abrir cualquier auditoría, pero no tiene
   panel: falta el listado de leads con puntaje y prioridad, que es la herramienta comercial.
3. **Entrega por correo.** Hoy el resultado vive en un enlace. Falta el envío del PDF/resumen y
   la secuencia de seguimiento.
4. **Comparación entre periodos.** El esquema ya lleva `period` en todas las tablas; falta la
   vista de evolución del mismo consultorio.
5. **Recuperación de contraseña.** Requiere transporte de correo, igual que el punto 3.
6. **Pruebas automatizadas.** El motor de scoring es puro y sin dependencias: es el candidato
   evidente para una primera batería de pruebas unitarias.

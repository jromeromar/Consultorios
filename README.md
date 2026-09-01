# Consultorios · Plataforma de Estudios de Benchmark

Plataforma de benchmark comercial para consultorios y clínicas: ortodoncia, odontología
estética y general, medicina estética, medicina de especialidad y nutrición.

El sitio institucional de la agencia todavía no existe: por ahora la raíz es una portada
mínima cuyo único trabajo es llevar a **Estudios**, que es lo que sí está construido.

## En vivo

**https://consultorios-brown.vercel.app** — corre en modo demostración (ver abajo), así que las
cuentas y los assessments que se creen ahí se borran solos. Cuenta lista para probar:
`demo@consultorios.co` / `consultorios123`.

El proyecto de Vercel está enlazado a este repositorio y despliega en cada push a `main`.
`vercel.json` declara el framework explícitamente: el proyecto se creó cuando el repositorio
todavía estaba vacío, así que la autodetección no encontró nada y sin esa declaración Vercel
publica solo `public/` como sitio estático (síntoma: 404 en todas las rutas menos `/admin/`).

## El ciclo del producto

```
Estudio del sector  →  Assessment (lead-gen)  →  Vista previa  →  Cuenta  →  Auditoría completa
   (público)            20 preguntas             recortada        real       vs. sector
```

1. **`/estudios`** — índice de estudios y comparativa entre especialidades.
2. **`/estudios/[slug]`** — distribución del sector para una especialidad, con corte por
   tamaño de consultorio. Público.
3. **`/assessment`** — 14 indicadores numéricos + 6 preguntas de práctica. Quien no mide un
   indicador lo marca: el *índice de medición* es parte del resultado.
4. **`/assessment/[id]`** — vista previa del resultado (puntaje, bloques, primera prioridad).
5. **`/registro`** — al crear la cuenta con el mismo correo, el assessment anónimo queda
   reclamado automáticamente.
6. **`/plataforma/auditoria/[id]`** — auditoría completa: posición en la distribución de cada
   indicador, embudo mensual reconstruido y valor en pesos de cerrar cada hueco.

## Arrancar en local

```bash
npm install
cp .env.example .env.local        # AUTH_SECRET es obligatorio fuera de desarrollo
mkdir -p .data                    # solo la primera vez
npm run db:migrate                # crea el esquema
npm run db:seed                   # carga el benchmark y dos cuentas de prueba
npm run dev
```

Sin `DATABASE_URL` la app usa **PGlite** (Postgres compilado a WASM) en `.data/pglite`: no
hace falta instalar nada. Con `DATABASE_URL` apunta a un Postgres real (Neon, Supabase,
Vercel Postgres) usando el mismo esquema y las mismas consultas.

### Modo demostración

Con `DEMO_MODE=1` —o al desplegar en Vercel sin `DATABASE_URL`— la app arranca un Postgres
**en memoria**, lo migra y lo siembra en cada arranque en frío. Sirve para publicar una versión
navegable sin infraestructura, a cambio de que las cuentas y los assessments se borren cuando
la instancia se enfría. La cabecera lo advierte en todas las páginas.

La presencia de `DATABASE_URL` descarta el modo siempre: una instalación real no puede
convertirse en demo por accidente.

Cuentas del seed: `demo@consultorios.co` y `agencia@consultorios.co` (rol `admin`), ambas con
contraseña `consultorios123`.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `start` | Build y servidor de producción |
| `npm run typecheck` / `lint` | TypeScript estricto y ESLint |
| `npm run db:generate` | Genera la migración SQL a partir del esquema Drizzle |
| `npm run db:migrate` | Aplica las migraciones al driver activo |
| `npm run db:seed` | Carga/actualiza el benchmark sintético (idempotente) |
| `npm run db:import -- <csv>` | Importa el benchmark desde CSV (ver [`data/README.md`](data/README.md)) |
| `npm run db:reset` | Borra el PGlite local y vuelve a migrar y sembrar |

## Mercado

Colombia: `es-CO`, pesos colombianos, país `CO`. Ambos configurables en `.env`
(`NEXT_PUBLIC_LOCALE`, `NEXT_PUBLIC_CURRENCY`) y el país por celda del benchmark vive en la
propia tabla, así que abrir otro mercado es cargar celdas nuevas, no tocar código.

## Los datos del periodo cargado son sintéticos

`src/lib/benchmark/reference-data.ts` genera distribuciones **plausibles pero inventadas**,
denominadas en pesos colombianos.
Existen para que la plataforma funcione de punta a punta antes de tener muestra de campo, y
la interfaz lo declara en cada vista donde aparece una cifra.

Cuando llegue la primera muestra real solo se sustituye el contenido de la tabla
`benchmark_stats`: ninguna otra parte del sistema lee números de otro lugar.

```bash
# Valida e informa sin escribir
npm run db:import -- data/campo-2026-s1.csv --nota "Muestra de campo, 214 consultorios" --dry-run
# Escribe y borra las celdas sintéticas del periodo
npm run db:import -- data/campo-2026-s1.csv --nota "Muestra de campo, 214 consultorios" --reemplazar
```

El importador acepta **observaciones** (una fila por consultorio, una columna por KPI — calcula
él los percentiles) o **percentiles ya agregados**. La interfaz deja de mostrar el aviso de
demostración por sí sola: la advertencia depende de la procedencia guardada en cada celda, no de
una bandera que alguien tenga que acordarse de apagar. Ver [`data/README.md`](data/README.md).

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — decisiones, modelo de datos, motor de
  scoring, autenticación, despliegue y lo que falta.

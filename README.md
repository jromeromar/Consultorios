# Consultorios · Plataforma de Estudios de Benchmark

Plataforma de benchmark comercial para consultorios y clínicas: ortodoncia, odontología
estética y general, medicina estética, medicina de especialidad y nutrición.

El sitio institucional de la agencia todavía no existe: por ahora la raíz es una portada
mínima cuyo único trabajo es llevar a **Estudios**, que es lo que sí está construido.

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
| `npm run db:seed` | Carga/actualiza el benchmark (idempotente) |
| `npm run db:reset` | Borra el PGlite local y vuelve a migrar y sembrar |

## Los datos del periodo cargado son sintéticos

`src/lib/benchmark/reference-data.ts` genera distribuciones **plausibles pero inventadas**.
Existen para que la plataforma funcione de punta a punta antes de tener muestra de campo, y
la interfaz lo declara en cada vista donde aparece una cifra.

Cuando llegue la primera muestra real solo se sustituye el contenido de la tabla
`benchmark_stats`: ninguna otra parte del sistema lee números de otro lugar.

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — decisiones, modelo de datos, motor de
  scoring, autenticación, despliegue y lo que falta.

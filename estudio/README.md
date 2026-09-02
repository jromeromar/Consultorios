# Generador de los documentos del censo

Convierte los CSV del censo de ortodoncia en dos documentos publicables. **No es
una aplicación ni un servicio**: corre en un portátil, unas pocas veces, y su
resultado se imprime y se publica.

```bash
python3 calcular.py         --edicion 2026-09 --datos ./datos
python3 render_agregado.py  --edicion 2026-09
python3 render_auditoria.py --edicion 2026-09 --consultorio TODOS
python3 cumplimiento.py     --edicion 2026-09     # antes de publicar
```

## La restricción central

**El percentil que ve un profesional en su auditoría sale exactamente de la
distribución que el informe agregado publica.** Los dos documentos leen el mismo
JSON y nadie más calcula: si una plantilla necesita un número que no está en el
JSON, el número falta en el motor y se agrega allá. Si fueran dos cálculos, un
día discreparían y alguien lo notaría en público.

`calcular.py` es el único archivo que hace aritmética.

## Archivos

| Archivo | Qué es |
|---|---|
| `formula.yaml` | Pesos, anclas, mínimos, cortes y denominadores admitidos. Versionado. |
| `marca.json` | **Toda** la identidad: nombre, colores, tipografías, logo. Hoy con marcadores. |
| `textos.yaml` | Títulos, prosa y las líneas de «qué no dice». Ningún número. |
| `calcular.py` | Lee los CSV, puntúa, saca percentiles, escribe el JSON de la edición. |
| `render_agregado.py` | Una página desde el JSON. Solo el lector anónimo. |
| `render_auditoria.py` | N páginas y N PDF. Lector identificado. |
| `cumplimiento.py` | Revisión previa a publicar. Falla si encuentra un nombre en el agregado, una cifra proyectada, una estadística sin `n` o un color fuera de `marca.json`. |
| `svg.py` | Geometría de los gráficos. Compartida por los dos renderizadores para que ninguna plantilla convierta un valor en una coordenada. |
| `estilo.py` | Traduce `marca.json` a variables CSS y `@font-face`. Es lo que hace cumplible que no haya un color escrito a mano. |
| `plantilla.py` | Relleno de huecos `{{clave}}`. Un hueco sin valor revienta: un documento que va a imprenta no puede llevar un blanco donde iba una cifra. |
| `lectura.py` | Los dos lectores, anónimo e identificado. |

## Puntaje absoluto, percentil relativo

Cada indicador se lleva a 0–100 con **anclas fijas de `formula.yaml`**, no con el
rango de la muestra. Un puntaje normalizado contra la propia muestra sube cuando
a los demás les va peor y no se puede comparar entre ediciones. El puntaje es
absoluto y comparable en el tiempo; el **percentil** se calcula contra la
distribución de la edición y es relativo por definición. Los dos se publican
juntos: *puntaje 41 de 100 · percentil 28*.

## Los dos denominadores

El sistema maneja varios y confundirlos es el error más fácil de cometer y el más
difícil de detectar. Ninguna estadística se emite sin `n` y sin denominador
declarado, y el enum está cerrado en `formula.yaml`. En el fixture actual:

| Denominador | n |
|---|---|
| universo | 200 |
| medidos | 169 |
| respondieron | 133 |
| con_ficha | 200 |
| con_sitio_rastreado | 131 |
| con_instagram | 118 |
| declararon | 59 |

## Qué se publica y qué no

`publicable` es falso cuando el n del corte queda bajo `minimos.publicable`. Una
estadística no publicable **no se renderiza**: el bloque imprime «no medido en
esta edición» y sigue. No se estima, no se interpola, no se deja en blanco.

Con el fixture actual, y con el mínimo en 30:

| Corte | Estado |
|---|---|
| nacional | se publica |
| tipo de ciudad | se publica · 52 / 84 / 64, y también sobre `respondieron` |
| franja horaria | se publica · 56 / 57 / 56 |
| **franja × tipo de ciudad** | **no se publica** · mayor grupo 24 de 30 |
| **por municipio** | **prohibido por regla**, y tampoco llegaría: mayor ciudad 26 |

El cruce de segundo nivel está declarado a propósito para que el documento
responda «no medido» a una pregunta razonable en vez de callarla.

## Datos de prueba

```bash
python3 tests/generar_fixtures.py     # regenera; su salida está versionada
python3 tests/auditar_fixture.py datos tests/fixtures/minimo
```

Los CSV son estáticos a propósito: generarlos en cada prueba haría frágil la
comprobación de reproducibilidad byte a byte y esconderia los valores conocidos
que las pruebas de aritmética afirman. `C-0001` tiene todos los indicadores en la
ancla de 100 y `C-0002` en la de 0.

`tests/fixtures/minimo/` son treinta consultorios donde casi nada pasa el
mínimo: existe para ejercitar el camino de «no medido», que en el fixture grande
casi no se ve.

Dos factores latentes independientes gobiernan los indicadores sintéticos:
`presencia` y `reloj`. Que sean independientes es deliberado — es lo que hace que
el contra-hallazgo del hallazgo 07 exista y el motor tenga algo que encontrar.
Eso prueba la maquinaria, no describe el mercado.

## Reglas duras

- **Ninguna cifra proyectada, en ningún documento.** Los documentos describen
  posición y distancia dentro de una distribución. `cumplimiento.py` falla si
  encuentra lenguaje de proyección.
- **Ausencia de observación nunca es un cero ni un no.** `no_observado` sale del
  numerador y del denominador. Un consultorio que no respondió no cuenta como
  uno que no ofreció agendar.
- **Anonimato por construcción.** El lector anónimo no parsea nombre, dirección,
  teléfono ni dominio: el objeto no tiene el atributo, así que un acceso revienta
  en ejecución. No es convención, es ausencia. Las ciudades sí van con nombre.
- **La marca no está decidida.** Ningún color ni tipografía escrito a mano en las
  plantillas. Cuando la identidad se apruebe, cambiar `marca.json` basta.
- **Cada salida se estampa** con `edicion_id`, `version_formula`, `fecha_calculo`
  y la huella de los archivos de entrada.
- **No se inventa nada.** Si falta un dato, se imprime «no medido».

## Las plantillas no calculan

Una plantilla es HTML con huecos `{{clave}}` y nada más: ni bucles, ni
condicionales, ni aritmética, ni scripts. Lo que se repite —los cinco bloques,
las filas de una tabla— lo arma el renderizador con una plantilla parcial y lo
inyecta ya hecho. La geometría de los gráficos vive en `svg.py`, compartida por
los dos documentos y probada, así que ninguna plantilla convierte un valor en una
coordenada.

Las cifras publicadas van estampadas con `data-stat` en el HTML. Es lo que
permite que la prueba de consistencia compare **los dos documentos generados** y
no el JSON contra sí mismo, que sería una tautología.

## PDF

Chromium imprimiendo el mismo HTML, para que el impreso sea idéntico a la
pantalla. El HTML del PDF se genera en modo claro: un impreso no tiene modo
oscuro y heredar el del sistema daría una hoja negra.

```bash
python3 render_auditoria.py --edicion 2026-09 --consultorio TODOS
python3 render_auditoria.py --edicion 2026-09 --consultorio TODOS --sin-pdf
python3 render_auditoria.py --edicion 2026-09 --consultorio TODOS --chromium /ruta/al/navegador
```

Cada auditoría sale como un archivo nombrado por `consultorio_id`, **nunca por
el nombre del establecimiento**, y se entrega solo al consultorio medido.

## Pruebas

```bash
python3 -m pytest tests/ -q
```

## La prueba que sostiene el encargo

El percentil que un profesional ve en su auditoría tiene que salir exactamente de
la distribución que el informe publica. Se comprueba sobre **los dos HTML
generados**, no sobre el JSON contra sí mismo, que sería una tautología:

- El informe estampa la mediana de cada bloque en su ficha de método con
  `data-stat="bloque.X.mediana" data-valor="…"`.
- La auditoría estampa la que dibuja en la curva con `data-mediana="…"`.
- `cumplimiento.py` y `tests/test_consistencia.py` comparan las dos cadenas
  exactas, y hay dos pruebas de mutación que alteran una mediana a propósito
  para comprobar que la comparación lo caza.

## La compuerta antes de publicar

```bash
python3 cumplimiento.py --edicion 2026-09
```

36 controles sobre los HTML ya generados, porque lo que importa es lo que va a
salir impreso. Falla —y dice qué regla rompió y dónde— si encuentra:

- un nombre de consultorio en el informe agregado, o un identificador
- lenguaje de proyección en cualquiera de los dos documentos
- segunda persona sobre un profesional en el agregado
- una estadística publicada sin su `n` visible
- un color escrito a mano fuera de `marca.json`
- una mediana que discrepa entre los dos documentos
- un documento que no viene del último cálculo
- la falta del aviso cuando la edición declara datos no de campo
- las palabras «estimado», «aproximado», «extrapolado» o «proyectado»

Cada control tiene su prueba de mutación: una revisión que no falla nunca no
revisa nada.

Un efecto que no busqué y que resultó valioso: **la compuerta detecta documentos
viejos.** La primera vez que la corrí encontró que los HTML en disco no venían
del último cálculo, porque solo había vuelto a renderizar uno.

## Una corrida completa

```bash
python3 calcular.py          --edicion 2026-09 --datos ./datos
python3 render_agregado.py   --edicion 2026-09
python3 render_auditoria.py  --edicion 2026-09 --consultorio TODOS
python3 cumplimiento.py      --edicion 2026-09
```

## Estado

Los cinco pasos hechos. 163 pruebas.

Lo que queda para una edición real, en orden: sustituir `datos/` por el
levantamiento de campo, revisar los pesos y las anclas de `formula.yaml` —los de
ahora son una propuesta mía—, y decidir la identidad para poner `marca.json` y
apagar el cintillo provisional.

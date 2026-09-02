"""Informe de composición de un fixture: qué denominador da cada fuente y qué
cortes pasan el mínimo. Es el que prueba que los datos de prueba sirven para
mostrar los dos caminos: el publicable y el de «no medido»."""
import csv, sys
from pathlib import Path

MIN = 30

def leer(d, n):
    p = Path(d) / n
    return list(csv.DictReader(open(p, encoding="utf-8"))) if p.exists() else []

def auditar(d):
    print(f"\n{'='*72}\n{d}\n{'='*72}")
    cons = leer(d, "consultorio.csv")
    universo = [c for c in cons if c["es_ortodoncia"] == "true" and c["estado_registro"] == "activo"]
    ids = {c["consultorio_id"] for c in universo}
    fichas = [f for f in leer(d, "consultorio_snapshot.csv") if f["consultorio_id"] in ids]
    sitios = [s for s in leer(d, "sitio_snapshot.csv") if s["consultorio_id"] in ids]
    igs = [i for i in leer(d, "instagram_snapshot.csv") if i["consultorio_id"] in ids]
    camp = [c for c in leer(d, "contacto_campo.csv")
            if c["consultorio_id"] in ids and c["excluido_del_analisis"] != "true"]
    serp = [s for s in leer(d, "serp_local.csv") if s["consultorio_id"] in ids]
    decl = {x["consultorio_id"] for x in leer(d, "dato_declarado.csv") if x["consultorio_id"] in ids}
    muni = {m["municipio_id"]: m["categoria_ciudad"] for m in leer(d, "municipio.csv")}
    munis_con_serp = {s["municipio_id"] for s in serp}

    dens = {
        "universo": len(universo),
        "medidos": len(camp),
        "respondieron": sum(1 for c in camp if c["hubo_respuesta"] == "true"),
        "con_ficha": len(fichas),
        "con_sitio_rastreado": sum(1 for s in sitios if s["estado_rastreo"] == "ok"),
        "con_instagram": len(igs),
        "con_serp_medido": sum(1 for f in fichas if f["municipio_id"] in munis_con_serp),
        "declararon": len(decl),
    }
    print("\nDENOMINADORES")
    for k, v in dens.items():
        print(f"  {'ok ' if v >= MIN else '<<<'} {k:22} {v:>4}")

    print(f"\nCORTE POR categoria_ciudad (mínimo {MIN} por grupo)")
    cat_de = {f["consultorio_id"]: muni.get(f["municipio_id"], "?") for f in fichas}
    grupos = {}
    for cid, cat in cat_de.items(): grupos[cat] = grupos.get(cat, 0) + 1
    pasan = all(n >= MIN for n in grupos.values())
    for cat, n in sorted(grupos.items()):
        print(f"  {'ok ' if n >= MIN else '<<<'} {cat:24} {n:>4}")
    print(f"  -> el corte {'SE PUBLICA' if pasan else 'NO SE PUBLICA: hay un grupo bajo el mínimo'}")

    print("\nCORTE POR municipio (prohibido por regla, sin importar el n)")
    por_mun = {}
    for f in fichas: por_mun[f["municipio_id"]] = por_mun.get(f["municipio_id"], 0) + 1
    print(f"  mayor ciudad: {max(por_mun.values())} · " +
          ("ninguna llegaría al mínimo igualmente" if max(por_mun.values()) < MIN
           else "alguna llegaría, pero la regla lo prohíbe"))

    print(f"\nCORTE POR franja horaria (mínimo {MIN})")
    fr = {}
    for c in camp: fr[c["franja_horaria"]] = fr.get(c["franja_horaria"], 0) + 1
    for k, v in sorted(fr.items()):
        prim = sum(1 for c in camp if c["franja_horaria"] == k and c["hubo_respuesta"] == "true"
                   and c["minutos_primera_respuesta"] and int(c["minutos_primera_respuesta"]) <= 60)
        print(f"  {'ok ' if v >= MIN else '<<<'} {k:12} n={v:>3} · respondió en 1ª hora: {prim:>3} ({prim/v*100:4.1f} %)")

    resp = [c for c in camp if c["hubo_respuesta"] == "true"]
    print("\nno_observado (sale del numerador y del denominador)")
    for campo in ("ofrecio_agendar", "dio_precio", "hubo_seguimiento_espontaneo"):
        no = sum(1 for c in resp if c[campo] == "no_observado")
        vac = sum(1 for c in camp if c["hubo_respuesta"] != "true" and c[campo] == "")
        print(f"  {campo:28} n útil={len(resp)-no:>3} · no_observado={no:>3} · nulos por no responder={vac:>3}")

    mins = [int(c["minutos_primera_respuesta"]) for c in resp if c["minutos_primera_respuesta"]]
    mins.sort()
    if mins:
        print(f"\nminutos hasta la 1ª respuesta · mediana {mins[len(mins)//2]} · "
              f"p10 {mins[len(mins)//10]} · p90 {mins[len(mins)*9//10]} · bajo 5 min {sum(1 for m in mins if m<5)}")
    print(f"excluidos del universo: {len(cons)-len(universo)} · excluidos del análisis de campo: "
          f"{sum(1 for c in leer(d,'contacto_campo.csv') if c['excluido_del_analisis']=='true')}")

for d in sys.argv[1:]:
    auditar(d)

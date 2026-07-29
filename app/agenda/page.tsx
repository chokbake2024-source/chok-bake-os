"use client";

import { useEffect, useMemo, useState } from "react";
import Protegido from "../lib/Protegido";
import { fmt } from "../lib/negocio";
import {
  cargarPedidos,
  fechaLarga,
  hoyISO,
  ESTADO_LABEL,
  TIPO_LABEL,
  type Pedido,
} from "../lib/gestion";
import { Regla, Rotulo } from "../lib/ui";

function Contenido() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarPedidos({ desde: hoyISO() }).then((r) => {
      setPedidos(r.pedidos);
      setErr(r.error);
      setCargando(false);
    });
  }, []);

  /** Agrupado por día de entrega: es la vista de producción. */
  const dias = useMemo(() => {
    const mapa = new Map<string, Pedido[]>();
    for (const p of pedidos) {
      if (p.estado === "cancelado") continue;
      const lista = mapa.get(p.fecha_entrega) ?? [];
      lista.push(p);
      mapa.set(p.fecha_entrega, lista);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [pedidos]);

  const hoy = hoyISO();

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Agenda de producción</Rotulo>
        <Rotulo tono="carbon">De hoy en adelante</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      {err && (
        <p className="mt-5 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {err}
        </p>
      )}

      {cargando ? (
        <p className="mt-6 text-[0.82rem] text-carbon/50">Cargando…</p>
      ) : dias.length === 0 ? (
        <p className="mt-6 border border-carbon/15 bg-perga/60 px-4 py-4 text-[0.82rem] leading-relaxed text-carbon/60">
          No hay nada agendado. Cuando entre un pedido con fecha de hoy o más
          adelante, aparece acá agrupado por día.
        </p>
      ) : (
        dias.map(([fecha, lista]) => {
          const unidades = lista.reduce(
            (s, p) => s + p.pedido_items.reduce((t, i) => t + i.cantidad, 0),
            0
          );
          return (
            <section key={fecha} className="mt-8">
              <div className="flex items-baseline justify-between">
                <span
                  className={`font-display text-xl leading-none ${
                    fecha === hoy ? "text-vino" : "text-carbon/75"
                  }`}
                >
                  {fechaLarga(fecha)}
                  {fecha === hoy && (
                    <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-laton">
                      hoy
                    </span>
                  )}
                </span>
                <Rotulo tono="carbon">{unidades} unid.</Rotulo>
              </div>
              <div className="mt-2">
                <Regla suave />
              </div>

              {lista.map((p) => (
                <div key={p.id} className="border-b border-carbon/10 py-3.5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono w-14 shrink-0 text-[0.66rem] text-laton">
                      {p.hora_entrega ?? "—"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.85rem] text-carbon">
                        {p.cliente}
                        <span className="ml-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-carbon/40">
                          {TIPO_LABEL[p.tipo]}
                        </span>
                      </span>
                      <span className="mt-1 block text-[0.74rem] leading-snug text-carbon/60">
                        {p.pedido_items
                          .map(
                            (i) =>
                              `${i.cantidad}× ${i.nombre}` +
                              (i.extras?.length ? ` (${i.extras.join(", ")})` : "")
                          )
                          .join(" · ")}
                      </span>
                      <span className="mt-1 block font-mono text-[0.64rem] uppercase tracking-[0.14em] text-carbon/40">
                        {p.entrega === "domicilio" ? "Domicilio" : "Recoge"} ·{" "}
                        {ESTADO_LABEL[p.estado]}
                      </span>
                    </span>
                    <span className="font-mono shrink-0 text-[0.76rem] text-vino-m">
                      {fmt(Number(p.valor))}
                    </span>
                  </div>
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}

export default function Agenda() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

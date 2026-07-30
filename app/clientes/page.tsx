"use client";

import { useEffect, useState } from "react";
import Protegido from "../lib/Protegido";
import { fmt } from "../lib/negocio";
import {
  buscarClientes,
  ESTADO_LABEL,
  fechaLarga,
  linkClienteWA,
  TIPO_LABEL,
  type Cliente,
} from "../lib/gestion";
import { Regla, Rotulo, inputCls } from "../lib/ui";

function Ficha({ c }: { c: Cliente }) {
  const [abierto, setAbierto] = useState(false);
  const vivos = c.pedidos.filter((p) => p.estado !== "cancelado");

  return (
    <div className="border-t border-carbon/15 py-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-baseline gap-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem] text-vino">{c.nombre}</span>
          <span className="mt-0.5 block font-mono text-[0.7rem] tracking-wide text-carbon/55">
            {c.telefono}
          </span>
          <span className="mt-1 block text-[0.72rem] text-carbon/50">
            {vivos.length} pedido{vivos.length === 1 ? "" : "s"} · último{" "}
            {fechaLarga(c.ultimo)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="font-display block text-lg leading-none text-vino-m">
            {fmt(c.total)}
          </span>
          <span className="mt-1 block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-carbon/35">
            histórico
          </span>
        </span>
        <span className="shrink-0 font-mono text-[0.7rem] text-carbon/30">
          {abierto ? "−" : "+"}
        </span>
      </button>

      {abierto && (
        <div className="mt-4 border-l border-laton/40 pl-4">
          <a
            href={linkClienteWA(c.pedidos[0])}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block border border-vino/40 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-vino transition hover:bg-vino hover:text-hueso"
          >
            WhatsApp
          </a>

          <div className="mt-4 flex flex-col gap-3">
            {c.pedidos.map((p) => (
              <div key={p.id} className="border-b border-carbon/10 pb-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[0.66rem] text-laton">{p.id}</span>
                  <span className="text-[0.76rem] text-carbon/70">
                    {p.fecha_entrega} · {TIPO_LABEL[p.tipo]}
                  </span>
                  <span className="ml-auto font-mono text-[0.74rem] text-vino-m">
                    {fmt(Number(p.valor))}
                  </span>
                </div>
                <div className="mt-1 text-[0.74rem] leading-snug text-carbon/60">
                  {p.pedido_items
                    .map(
                      (i) =>
                        `${i.cantidad}× ${i.nombre}` +
                        (i.extras?.length ? ` (${i.extras.join(", ")})` : "")
                    )
                    .join(" · ")}
                </div>
                <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-carbon/35">
                  {ESTADO_LABEL[p.estado]}
                  {Number(p.saldo) > 0 && ` · saldo ${fmt(Number(p.saldo))}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Contenido() {
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setCargando(true);
      buscarClientes(q).then((r) => {
        setClientes(r.clientes);
        setErr(r.error);
        setCargando(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Clientes</Rotulo>
        <Rotulo tono="carbon">Agrupados por teléfono</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      <input
        className={`${inputCls} mt-5`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, teléfono o número de pedido"
      />

      {err && (
        <p className="mt-4 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {err}
        </p>
      )}

      <div className="mt-5 flex items-baseline justify-between">
        <Rotulo tono="carbon">
          {clientes.length} cliente{clientes.length === 1 ? "" : "s"}
        </Rotulo>
      </div>

      <div className="mt-3">
        {cargando ? (
          <p className="border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
            Buscando…
          </p>
        ) : clientes.length === 0 ? (
          <p className="border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
            {q ? "Nadie con ese dato." : "Todavía no hay clientes registrados."}
          </p>
        ) : (
          clientes.map((c) => <Ficha key={c.telefono} c={c} />)
        )}
      </div>
    </div>
  );
}

export default function Clientes() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

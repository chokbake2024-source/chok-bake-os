"use client";

import { useEffect, useMemo, useState } from "react";
import Protegido from "../lib/Protegido";
import { fmt } from "../lib/negocio";
import {
  cambiarEstado,
  cargarPedidos,
  ESTADOS,
  ESTADO_LABEL,
  fechaLarga,
  linkClienteWA,
  TIPO_LABEL,
  type Pedido,
} from "../lib/gestion";
import { Regla, Rotulo, inputCls } from "../lib/ui";

const FILTROS = ["activos", ...ESTADOS, "todos"] as const;

const FILTRO_LABEL: Record<string, string> = {
  activos: "Activos",
  todos: "Todos",
  ...ESTADO_LABEL,
};

function Tarjeta({ p, onCambio }: { p: Pedido; onCambio: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");

  async function cambiar(estado: string) {
    setErr("");
    setGuardando(true);
    try {
      await cambiarEstado(p.id, estado);
      onCambio();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="border-t border-carbon/15 py-4">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-baseline gap-3 text-left"
      >
        <span className="font-mono w-20 shrink-0 text-[0.68rem] tracking-wide text-laton">
          {p.id}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.88rem] text-vino">{p.cliente}</span>
          <span className="mt-0.5 block text-[0.7rem] text-carbon/55">
            {TIPO_LABEL[p.tipo]} · {p.fecha_entrega}
            {p.hora_entrega ? ` ${p.hora_entrega}` : ""} · {ESTADO_LABEL[p.estado]}
          </span>
        </span>
        <span className="font-mono shrink-0 text-[0.8rem] text-vino-m">{fmt(p.valor)}</span>
        <span className="shrink-0 font-mono text-[0.7rem] text-carbon/30">
          {abierto ? "−" : "+"}
        </span>
      </button>

      {abierto && (
        <div className="mt-4 border-l border-laton/40 pl-4">
          <Rotulo>Productos</Rotulo>
          <div className="mt-2 flex flex-col gap-1.5">
            {p.pedido_items.map((it) => (
              <div key={it.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 text-[0.8rem] leading-snug text-carbon">
                  {it.nombre}
                  {it.cantidad > 1 && ` ×${it.cantidad}`}
                  {it.extras?.length > 0 && (
                    <span className="block text-[0.7rem] text-carbon/50">
                      {it.extras.join(", ")}
                    </span>
                  )}
                </span>
                <span className="font-mono shrink-0 text-[0.74rem] text-vino-m">
                  {fmt(Number(it.subtotal))}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-1.5">
            {[
              ["Teléfono", p.telefono],
              ["Entrega", p.entrega === "domicilio" ? "Domicilio" : "Recoge en punto"],
              ...(p.direccion ? [["Dirección", p.direccion]] : []),
              ["Pago", p.metodo_pago ?? "—"],
              ["Anticipo", fmt(Number(p.anticipo))],
              ["Saldo", fmt(Number(p.saldo))],
              ...(p.notas ? [["Notas", p.notas]] : []),
            ].map(([k, v]) => (
              <span key={k} className="flex items-baseline justify-between gap-3">
                <Rotulo tono="carbon">{k}</Rotulo>
                <span className="text-right text-[0.78rem] text-carbon">{v}</span>
              </span>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={linkClienteWA(p)}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-vino/40 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-vino transition hover:bg-vino hover:text-hueso"
            >
              WhatsApp
            </a>
            {p.comprobante_url && (
              <a
                href={p.comprobante_url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-carbon/25 px-3 py-1.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-carbon/70 transition hover:border-vino hover:text-vino"
              >
                Comprobante
              </a>
            )}
          </div>

          <label className="mt-4 block">
            <Rotulo>Estado</Rotulo>
            <select
              className={`${inputCls} mt-1.5`}
              value={p.estado}
              disabled={guardando}
              onChange={(e) => cambiar(e.target.value)}
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABEL[e]}
                </option>
              ))}
            </select>
          </label>

          {err && <p className="mt-2 text-[0.76rem] text-vino">{err}</p>}
        </div>
      )}
    </div>
  );
}

function Contenido() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<string>("activos");

  function recargar() {
    return cargarPedidos().then((r) => {
      setPedidos(r.pedidos);
      setErr(r.error);
      setCargando(false);
    });
  }

  useEffect(() => {
    recargar();
  }, []);

  const visibles = useMemo(() => {
    if (filtro === "todos") return pedidos;
    if (filtro === "activos")
      return pedidos.filter((p) => !["entregado", "cancelado"].includes(p.estado));
    return pedidos.filter((p) => p.estado === filtro);
  }, [pedidos, filtro]);

  const total = visibles
    .filter((p) => p.estado !== "cancelado")
    .reduce((s, p) => s + Number(p.valor), 0);

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Pedidos</Rotulo>
        <Rotulo tono="carbon">{fechaLarga(new Date().toISOString().slice(0, 10))}</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`border px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] transition ${
              filtro === f
                ? "border-vino bg-vino text-hueso"
                : "border-carbon/20 text-carbon/55 hover:border-vino/50 hover:text-vino"
            }`}
          >
            {FILTRO_LABEL[f]}
          </button>
        ))}
      </div>

      {err && (
        <p className="mt-5 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {err}
        </p>
      )}

      <div className="mt-5 flex items-baseline justify-between">
        <Rotulo tono="carbon">
          {visibles.length} pedido{visibles.length === 1 ? "" : "s"}
        </Rotulo>
        <span className="font-display text-lg text-vino">{fmt(total)}</span>
      </div>

      <div className="mt-3">
        {cargando ? (
          <p className="border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
            Cargando…
          </p>
        ) : visibles.length === 0 ? (
          <p className="border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
            No hay pedidos en este filtro.
          </p>
        ) : (
          visibles.map((p) => <Tarjeta key={p.id} p={p} onCambio={recargar} />)
        )}
      </div>
    </div>
  );
}

export default function Pedidos() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

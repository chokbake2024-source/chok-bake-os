"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Protegido from "../lib/Protegido";
import { fmt } from "../lib/negocio";
import {
  cargarPedidos,
  fechaLarga,
  hoyISO,
  diasDesdeHoy,
  ESTADO_LABEL,
  TIPO_LABEL,
  type Pedido,
} from "../lib/gestion";
import { Regla, Rotulo } from "../lib/ui";

function Cifra({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="border border-carbon/15 bg-perga/60 px-4 py-4">
      <Rotulo>{rotulo}</Rotulo>
      <div className="font-display mt-2 text-[1.75rem] leading-none text-vino">{valor}</div>
      {nota && <div className="mt-1.5 text-[0.72rem] text-carbon/55">{nota}</div>}
    </div>
  );
}

function Fila({ p }: { p: Pedido }) {
  return (
    <Link
      href="/pedidos"
      className="flex items-baseline gap-3 border-t border-carbon/12 py-3 transition hover:bg-perga/60"
    >
      <span className="font-mono w-20 shrink-0 text-[0.68rem] tracking-wide text-laton">
        {p.id}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.85rem] text-carbon">{p.cliente}</span>
        <span className="mt-0.5 block text-[0.7rem] text-carbon/50">
          {TIPO_LABEL[p.tipo]} · {p.hora_entrega ?? "sin hora"} ·{" "}
          {ESTADO_LABEL[p.estado]}
        </span>
      </span>
      <span className="font-mono shrink-0 text-[0.78rem] text-vino-m">{fmt(p.valor)}</span>
    </Link>
  );
}

function Contenido() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarPedidos().then((r) => {
      setPedidos(r.pedidos);
      setErr(r.error);
      setCargando(false);
    });
  }, []);

  const hoy = hoyISO();
  const mes = hoy.slice(0, 7);

  const m = useMemo(() => {
    const vivos = pedidos.filter((p) => p.estado !== "cancelado");
    return {
      ventasMes: vivos
        .filter((p) => p.fecha_entrega.startsWith(mes))
        .reduce((s, p) => s + Number(p.valor), 0),
      porConfirmar: pedidos.filter((p) => p.estado === "nuevo"),
      hoy: vivos.filter((p) => p.fecha_entrega === hoy),
      semana: vivos.filter(
        (p) => p.fecha_entrega > hoy && p.fecha_entrega <= diasDesdeHoy(7)
      ),
      saldos: vivos
        .filter((p) => p.estado !== "entregado")
        .reduce((s, p) => s + Number(p.saldo), 0),
    };
  }, [pedidos, hoy, mes]);

  if (cargando)
    return (
      <div className="px-7 py-16">
        <Rotulo>Cargando…</Rotulo>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Panel</Rotulo>
        <Rotulo tono="carbon">{fechaLarga(hoy)}</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      {err && (
        <p className="mt-5 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {err}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Cifra
          rotulo="Ventas del mes"
          valor={fmt(m.ventasMes)}
          nota={`${pedidos.filter((p) => p.fecha_entrega.startsWith(mes) && p.estado !== "cancelado").length} pedidos`}
        />
        <Cifra
          rotulo="Por confirmar"
          valor={String(m.porConfirmar.length)}
          nota={m.porConfirmar.length ? "Requieren revisión" : "Todo al día"}
        />
        <Cifra rotulo="Entregas hoy" valor={String(m.hoy.length)} />
        <Cifra rotulo="Saldo por cobrar" valor={fmt(m.saldos)} nota="Pedidos sin entregar" />
      </div>

      <Rotulo className="mt-9 block">Entregas de hoy</Rotulo>
      {m.hoy.length === 0 ? (
        <p className="mt-3 border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
          No hay entregas para hoy.
        </p>
      ) : (
        <div className="mt-3">
          {m.hoy.map((p) => (
            <Fila key={p.id} p={p} />
          ))}
        </div>
      )}

      <Rotulo className="mt-9 block">Próximos 7 días</Rotulo>
      {m.semana.length === 0 ? (
        <p className="mt-3 border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
          Nada agendado esta semana.
        </p>
      ) : (
        <div className="mt-3">
          {m.semana.map((p) => (
            <Fila key={p.id} p={p} />
          ))}
        </div>
      )}

      {pedidos.length === 0 && !err && (
        <p className="mt-9 border border-carbon/15 bg-perga/60 px-4 py-4 text-[0.82rem] leading-relaxed text-carbon/60">
          Todavía no hay pedidos. Cuando entre el primero desde la web, aparece acá.
        </p>
      )}
    </div>
  );
}

export default function Panel() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

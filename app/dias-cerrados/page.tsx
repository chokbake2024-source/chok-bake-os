"use client";

import { useEffect, useState } from "react";
import Protegido from "../lib/Protegido";
import {
  bloquearDia,
  cargarDiasBloqueados,
  desbloquearDia,
  fechaLarga,
  hoyISO,
  TIPO_LABEL,
  type DiaBloqueado,
} from "../lib/gestion";
import { Campo, Opcion, Regla, Rotulo, inputCls } from "../lib/ui";

const ALCANCES = [
  { id: "", nombre: "Todo" },
  { id: "cuchareable", nombre: "Cuchareables" },
  { id: "mesa_fria", nombre: "Mesas frías" },
  { id: "torta", nombre: "Tortas" },
] as const;

function Contenido() {
  const [dias, setDias] = useState<DiaBloqueado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fecha, setFecha] = useState("");
  const [tipo, setTipo] = useState<string>("");
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState("");

  function recargar() {
    return cargarDiasBloqueados().then((r) => {
      setDias(r.dias);
      if (r.error) setErr(r.error);
      setCargando(false);
    });
  }

  useEffect(() => {
    recargar();
  }, []);

  async function cerrar() {
    setErr("");
    if (!fecha) return setErr("Elegí la fecha que querés cerrar.");
    try {
      await bloquearDia(fecha, tipo || null, motivo);
      setFecha("");
      setMotivo("");
      setTipo("");
      await recargar();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function reabrir(id: number) {
    setErr("");
    try {
      await desbloquearDia(id);
      await recargar();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Días cerrados</Rotulo>
        <Rotulo tono="carbon">Vacaciones y festivos</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      <p className="mt-4 text-[0.8rem] leading-relaxed text-carbon/60">
        Un día cerrado desaparece para los clientes: el formulario público los
        frena antes de que llenen el pedido. Vos podés seguir cargando pedidos a
        mano para ese día desde <span className="font-mono">+ Nuevo</span>.
      </p>

      <Rotulo className="mt-7 block">Cerrar un día</Rotulo>
      <Campo label="Fecha">
        <input
          className={inputCls}
          type="date"
          min={hoyISO()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </Campo>

      <Rotulo className="mt-5 block">¿Qué se cierra?</Rotulo>
      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {ALCANCES.map((a) => (
          <Opcion key={a.id} sel={tipo === a.id} onClick={() => setTipo(a.id)} titulo={a.nombre} />
        ))}
      </div>

      <Campo label="Motivo" hint="Se le muestra al cliente. Ej: vacaciones, festivo, sin producción.">
        <input
          className={inputCls}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Vacaciones"
        />
      </Campo>

      <button
        type="button"
        onClick={cerrar}
        className="mt-4 w-full border border-vino px-5 py-3 text-[0.86rem] font-medium text-vino transition hover:bg-vino hover:text-hueso"
      >
        Cerrar este día
      </button>

      {err && (
        <p className="mt-4 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          {err}
        </p>
      )}

      <div className="mt-10">
        <Regla />
      </div>
      <Rotulo className="mt-5 block">Cerrados de acá en adelante</Rotulo>

      {cargando ? (
        <p className="mt-3 text-[0.82rem] text-carbon/50">Cargando…</p>
      ) : dias.length === 0 ? (
        <p className="mt-3 border-t border-carbon/12 pt-3 text-[0.82rem] text-carbon/50">
          No hay días cerrados. Todo abierto.
        </p>
      ) : (
        <div className="mt-3">
          {dias.map((d, i) => (
            <div
              key={d.id}
              className={`flex items-baseline gap-3 py-3.5 ${
                i > 0 ? "border-t border-carbon/12" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.86rem] text-vino">{fechaLarga(d.fecha)}</span>
                <span className="mt-0.5 block text-[0.72rem] text-carbon/55">
                  {d.tipo ? TIPO_LABEL[d.tipo] : "Todos los servicios"}
                  {d.motivo ? ` · ${d.motivo}` : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => reabrir(d.id)}
                className="shrink-0 border border-carbon/25 px-2.5 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-carbon/60 transition hover:border-vino hover:text-vino"
              >
                Reabrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiasCerrados() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

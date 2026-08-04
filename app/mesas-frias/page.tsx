"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, PAGO, PUNTO_RECOGIDA } from "../lib/negocio";
import {
  cargarCatalogo,
  consultarDisponibilidad,
  crearPedido,
  fechaMinimaISO,
  linkWhatsApp,
  subirComprobante,
  totalCarrito,
  totalUnidades,
  type DatosEntrega,
  type Disponibilidad,
} from "../lib/pedido";
import type { Extra, Linea, Producto, Reglas, Entrega } from "../lib/tipos";
import {
  AvisoFecha,
  Cabecera,
  Campo,
  Exito,
  Opcion,
  Regla,
  Rotulo,
  Titulo,
  inputCls,
} from "../lib/ui";

export default function MesasFrias() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [cargaErr, setCargaErr] = useState<string | null>(null);

  const [cant, setCant] = useState<Record<string, number>>({});
  /** Opciones elegidas por producto: { 'MF-SHOTS': ['SH-LIMON', …] } */
  const [opciones, setOpciones] = useState<Record<string, string[]>>({});
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [entrega, setEntrega] = useState<Entrega | "">("");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [notas, setNotas] = useState("");
  const [comprobante, setComprobante] = useState<File | null>(null);

  const [dispo, setDispo] = useState<Disponibilidad | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<{ id: string; href: string } | null>(null);

  useEffect(() => {
    cargarCatalogo("mesa_fria").then((c) => {
      setProductos(c.productos);
      setExtras(c.extras);
      setReglas(c.reglas);
      setCargaErr(c.error);
    });
  }, []);

  const MINIMO = reglas?.minimo_unidades ?? 16;

  useEffect(() => {
    if (reglas && !fecha) setFecha(fechaMinimaISO(reglas.anticipacion_minutos));
  }, [reglas, fecha]);

  useEffect(() => {
    if (!fecha) return setDispo(null);
    consultarDisponibilidad(fecha, "mesa_fria").then(setDispo);
  }, [fecha]);

  const lineas: Linea[] = useMemo(
    () =>
      productos
        .filter((p) => (cant[p.id] ?? 0) > 0)
        .map((p) => ({
          key: p.id,
          producto: p,
          // Los sabores no cambian el precio; viajan para que la cocina
          // sepa qué preparar.
          extras: (opciones[p.id] ?? [])
            .map((id) => extras.find((e) => e.id === id))
            .filter((e): e is Extra => !!e),
          cantidad: cant[p.id],
          precioUnit: p.precio,
        })),
    [productos, cant, opciones, extras]
  );

  const total = totalCarrito(lineas);
  const anticipo = Math.round((total * (reglas?.porcentaje_anticipo ?? 50)) / 100);
  const bajoMinimo = lineas.filter((l) => l.cantidad < MINIMO);

  const unidadesPedidas = totalUnidades(lineas);
  const fechaSirve =
    !dispo ||
    (!dispo.bloqueado &&
      (dispo.cupos === null || dispo.cupos > 0) &&
      (dispo.unidades === null || unidadesPedidas <= dispo.unidades));

  function ajustar(id: string, delta: number) {
    setCant((c) => {
      const actual = c[id] ?? 0;
      const nuevo = actual === 0 && delta > 0 ? MINIMO : actual + delta;
      if (nuevo <= 0) {
        const { [id]: _quitado, ...resto } = c;
        setOpciones((o) => {
          const { [id]: _sinOpciones, ...restoOp } = o;
          return restoOp;
        });
        return resto;
      }
      return { ...c, [id]: Math.min(nuevo, 500) };
    });
  }

  function toggleOpcion(productoId: string, extraId: string) {
    setOpciones((o) => {
      const actual = o[productoId] ?? [];
      return {
        ...o,
        [productoId]: actual.includes(extraId)
          ? actual.filter((x) => x !== extraId)
          : [...actual, extraId],
      };
    });
  }

  /** Productos que ofrecen opciones y todavía no tienen ninguna marcada. */
  const sinOpciones = lineas.filter(
    (l) => l.producto.grupo_extras && l.extras.length === 0
  );

  async function enviar() {
    setErr("");
    if (!lineas.length) return setErr("Elegí al menos un producto.");
    if (bajoMinimo.length)
      return setErr(
        `Mínimo ${MINIMO} unidades por producto. Ajustá: ${bajoMinimo
          .map((l) => l.producto.nombre)
          .join(", ")}.`
      );
    if (sinOpciones.length)
      return setErr(
        `Elegí el sabor de: ${sinOpciones.map((l) => l.producto.nombre).join(", ")}.`
      );
    if (!entrega) return setErr("Indicá si es domicilio o si recogés.");
    if (!cliente.trim()) return setErr("Escribí tu nombre.");
    if (!telefono.trim()) return setErr("Escribí tu teléfono.");
    if (entrega === "domicilio" && !direccion.trim()) return setErr("Escribí la dirección.");
    if (!fecha) return setErr("Elegí la fecha del evento.");
    if (!metodoPago) return setErr("Elegí el método de pago.");
    if (!comprobante) return setErr("Subí el comprobante del anticipo.");

    setEnviando(true);
    try {
      const comprobanteUrl = await subirComprobante(comprobante);
      const datos: DatosEntrega = {
        tipo: "mesa_fria",
        cliente,
        telefono,
        entrega,
        direccion,
        fecha,
        hora,
        metodoPago,
        notas,
        comprobanteUrl,
      };
      const id = await crearPedido(datos, lineas);
      setOk({ id, href: linkWhatsApp(id, "MESA FRÍA", datos, lineas) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (ok)
    return (
      <Exito
        id={ok.id}
        href={ok.href}
        nota="El saldo restante se paga al momento de la entrega. El transporte se coordina y se cobra aparte."
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-7 pb-16">
      <Cabecera seccion="II. Mesas frías" />
      <Titulo bajada="Armá tu mesa porción por porción.">MESAS FRÍAS</Titulo>

      {cargaErr && (
        <p className="mb-5 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          No se pudo cargar el catálogo: {cargaErr}
        </p>
      )}

      <Regla />
      <div className="mt-4 flex items-baseline justify-between">
        <Rotulo>Productos</Rotulo>
        <span className="text-[0.72rem] text-carbon/55">
          Mínimo {MINIMO} unidades de cada uno
        </span>
      </div>

      <div className="mt-3 flex flex-col">
        {productos.map((p, i) => {
          const n = cant[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className={`py-4 ${i > 0 ? "border-t border-carbon/12" : ""} ${
                n > 0 ? "bg-vino/[0.03]" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.88rem] leading-snug text-carbon">
                    {p.nombre}
                  </span>
                  <span className="font-mono mt-1 block text-[0.7rem] tracking-wide text-vino-m">
                    {fmt(p.precio)} · porción
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ajustar(p.id, -1)}
                    disabled={n === 0}
                    className="h-8 w-8 border border-carbon/20 text-vino transition hover:border-vino disabled:opacity-25"
                  >
                    −
                  </button>
                  <span
                    className={`font-display w-9 text-center text-lg ${
                      n > 0 ? "text-vino" : "text-carbon/25"
                    }`}
                  >
                    {n || "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => ajustar(p.id, 1)}
                    className="h-8 w-8 border border-carbon/20 text-vino transition hover:border-vino"
                  >
                    +
                  </button>
                </span>
              </div>

              {n > 0 && (
                <div className="mt-2 flex items-baseline justify-between">
                  <span
                    className={`text-[0.72rem] ${
                      n < MINIMO ? "text-vino" : "text-carbon/45"
                    }`}
                  >
                    {n < MINIMO ? `Faltan ${MINIMO - n} para el mínimo` : `${n} porciones`}
                  </span>
                  <span className="font-mono text-[0.78rem] text-vino-m">
                    {fmt(p.precio * n)}
                  </span>
                </div>
              )}

              {n > 0 && p.grupo_extras && (
                <div className="mt-3 border-l border-laton/40 pl-3">
                  <span className="rotulo block">
                    Sabores · elegí uno o varios
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {extras
                      .filter((e) => e.grupo === p.grupo_extras)
                      .map((e) => {
                        const sel = (opciones[p.id] ?? []).includes(e.id);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => toggleOpcion(p.id, e.id)}
                            className={`border px-2.5 py-1.5 text-[0.74rem] transition ${
                              sel
                                ? "border-vino bg-vino/[0.07] text-vino"
                                : "border-carbon/15 bg-perga/60 text-carbon hover:border-vino/40"
                            }`}
                          >
                            {e.nombre}
                          </button>
                        );
                      })}
                  </div>
                  {(opciones[p.id] ?? []).length === 0 && (
                    <span className="mt-2 block text-[0.7rem] text-vino">
                      Elegí al menos un sabor.
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lineas.length > 0 && (
        <>
          <div className="mt-2 border-t border-carbon/25 pt-4">
            <div className="flex items-baseline justify-between">
              <Rotulo>Total</Rotulo>
              <span className="font-display text-2xl text-vino">{fmt(total)}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <Rotulo tono="carbon">Anticipo {reglas?.porcentaje_anticipo ?? 50}%</Rotulo>
              <span className="font-mono text-[0.86rem] text-vino-m">{fmt(anticipo)}</span>
            </div>
          </div>

          {/* ── pago ── */}
          <div className="mt-8">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Anticipo</Rotulo>
          <div className="mt-3 border border-carbon/15 bg-perga/60 px-4 py-4">
            <p className="text-[0.84rem] leading-relaxed text-carbon">
              Transferí <b className="text-vino">{fmt(anticipo)}</b> y subí el comprobante.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {[
                ["Bancolombia · Ahorros", PAGO.bancolombia],
                ["Nequi", PAGO.nequi],
                ["Llave", PAGO.llave],
                ["Titular", PAGO.titular],
              ].map(([k, v]) => (
                <span key={k} className="flex items-baseline justify-between gap-3">
                  <Rotulo tono="carbon">{k}</Rotulo>
                  <span className="font-mono text-[0.8rem] text-vino">{v}</span>
                </span>
              ))}
            </div>
          </div>

          <Campo label="Comprobante del anticipo">
            <input
              className={inputCls}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
            />
          </Campo>

          {/* ── datos ── */}
          <div className="mt-8">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Datos del evento</Rotulo>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Opcion
              sel={entrega === "domicilio"}
              onClick={() => setEntrega("domicilio")}
              titulo="Domicilio"
              detalle="Transporte aparte"
            />
            <Opcion
              sel={entrega === "recoge"}
              onClick={() => setEntrega("recoge")}
              titulo="Recoge"
              detalle="Bella Vista"
            />
          </div>

          {entrega === "recoge" && (
            <p className="mt-2 text-[0.72rem] leading-snug text-carbon/55">{PUNTO_RECOGIDA}</p>
          )}

          <Campo label="Nombre completo">
            <input className={inputCls} value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </Campo>
          <Campo label="Teléfono">
            <input
              className={inputCls}
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="300 000 0000"
            />
          </Campo>
          {entrega === "domicilio" && (
            <Campo label="Dirección del evento" hint="El transporte se cotiza según el lugar.">
              <input
                className={inputCls}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, barrio, salón"
              />
            </Campo>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Campo label="Fecha del evento" hint="Mínimo 2 días">
                <input
                  className={inputCls}
                  type="date"
                  min={reglas ? fechaMinimaISO(reglas.anticipacion_minutos) : undefined}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Campo>
            </div>
            <div className="flex-1">
              <Campo label="Hora">
                <input
                  className={inputCls}
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </Campo>
            </div>
          </div>

          {dispo && (
            <AvisoFecha
              bloqueado={dispo.bloqueado}
              motivo={dispo.motivo}
              cupos={dispo.cupos}
              unidades={dispo.unidades}
              unidadesPedidas={unidadesPedidas}
            />
          )}

          <Campo label="Método de pago">
            <select
              className={inputCls}
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="">— elegí —</option>
              <option>Nequi</option>
              <option>Bancolombia</option>
            </select>
          </Campo>
          <Campo label="Notas">
            <textarea
              className={`${inputCls} min-h-16 resize-none`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Montaje, colores, alergias…"
            />
          </Campo>

          {err && (
            <p className="mt-4 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
              {err}
            </p>
          )}

          <button
            type="button"
            onClick={enviar}
            disabled={enviando || !fechaSirve}
            className="mt-5 w-full border border-vino bg-vino px-5 py-3.5 text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m disabled:opacity-40"
          >
            {enviando ? "Enviando…" : !fechaSirve ? "Elegí otra fecha" : "Confirmar pedido"}
          </button>
        </>
      )}
    </div>
  );
}

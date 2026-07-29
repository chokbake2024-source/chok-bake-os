"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, PUNTO_RECOGIDA } from "../lib/negocio";
import {
  cargarCatalogo,
  crearPedido,
  fechaMinimaISO,
  linkWhatsApp,
  precioLinea,
  totalCarrito,
  type DatosEntrega,
} from "../lib/pedido";
import type { Extra, Linea, Producto, Reglas, Entrega } from "../lib/tipos";
import {
  Cabecera,
  Campo,
  Exito,
  Opcion,
  Regla,
  Rotulo,
  Titulo,
  inputCls,
} from "../lib/ui";

const CATEGORIAS = [
  { id: "cuchareable", nombre: "Cuchareable", nota: "Vaso de 12 oz" },
  { id: "vasca", nombre: "Tarta Vasca", nota: "Porción personal" },
  { id: "brownie", nombre: "Brownies", nota: "Caja o torta" },
] as const;

export default function Cuchareables() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [reglas, setReglas] = useState<Reglas | null>(null);
  const [cargaErr, setCargaErr] = useState<string | null>(null);

  const [cat, setCat] = useState<string>("cuchareable");
  const [prodId, setProdId] = useState<string>("");
  const [adiciones, setAdiciones] = useState<string[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [entrega, setEntrega] = useState<Entrega | "">("");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("13:00");
  const [metodoPago, setMetodoPago] = useState("");
  const [notas, setNotas] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState<{ id: string; href: string } | null>(null);

  useEffect(() => {
    cargarCatalogo("cuchareable").then((c) => {
      setProductos(c.productos);
      setExtras(c.extras);
      setReglas(c.reglas);
      setCargaErr(c.error);
    });
  }, []);

  useEffect(() => {
    if (reglas && !fecha) setFecha(fechaMinimaISO(reglas.anticipacion_minutos, reglas.hora_max));
  }, [reglas, fecha]);

  const prod = productos.find((p) => p.id === prodId) ?? null;
  const delCat = productos.filter((p) => p.categoria === cat);
  const grupoTop = cat === "vasca" ? "topping_vasca" : "topping_brownie";
  const toppings = useMemo(
    () => extras.filter((e) => e.grupo === grupoTop),
    [extras, grupoTop]
  );

  const seleccionados = useMemo(() => {
    const ids = cat === "cuchareable" ? adiciones : slots.filter(Boolean);
    return ids
      .map((id) => extras.find((e) => e.id === id))
      .filter((e): e is Extra => Boolean(e));
  }, [cat, adiciones, slots, extras]);

  const precioUnit = prod ? precioLinea(prod, seleccionados) : 0;
  const listo =
    prod !== null &&
    (prod.slots === 0 || (slots.length === prod.slots && slots.every(Boolean)));

  function elegirProducto(p: Producto) {
    setProdId(p.id);
    setAdiciones([]);
    setSlots(p.slots > 0 ? new Array(p.slots).fill("") : []);
    setCantidad(1);
  }

  function cambiarCat(id: string) {
    setCat(id);
    setProdId("");
    setAdiciones([]);
    setSlots([]);
    setCantidad(1);
  }

  function toggleAdicion(id: string) {
    setAdiciones((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  }

  function agregar() {
    if (!prod || !listo) return;
    setLineas((l) => [
      ...l,
      {
        key: crypto.randomUUID(),
        producto: prod,
        extras: seleccionados,
        cantidad,
        precioUnit,
      },
    ]);
    setProdId("");
    setAdiciones([]);
    setSlots([]);
    setCantidad(1);
  }

  async function enviar() {
    setErr("");
    if (!lineas.length) return setErr("Agregá al menos un producto.");
    if (!entrega) return setErr("Indicá si es domicilio o si recogés.");
    if (!cliente.trim()) return setErr("Escribí tu nombre.");
    if (!telefono.trim()) return setErr("Escribí tu teléfono.");
    if (entrega === "domicilio" && !direccion.trim()) return setErr("Escribí la dirección.");
    if (!fecha) return setErr("Elegí la fecha.");
    if (!metodoPago) return setErr("Elegí el método de pago.");

    setEnviando(true);
    try {
      const datos: DatosEntrega = {
        tipo: "cuchareable",
        cliente,
        telefono,
        entrega,
        direccion,
        fecha,
        hora,
        metodoPago,
        notas,
        comprobanteUrl: null,
      };
      const id = await crearPedido(datos, lineas);
      setOk({ id, href: linkWhatsApp(id, "NUEVO PEDIDO", datos, lineas) });
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
        nota="Los cuchareables se pagan al recibir. No necesitás transferir nada por adelantado."
      />
    );

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-7 pb-16">
      <Cabecera seccion="I. Cuchareables" />
      <Titulo bajada="Postres individuales, listos hoy.">CUCHAREABLES</Titulo>

      {cargaErr && (
        <p className="mb-5 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
          No se pudo cargar el catálogo: {cargaErr}
        </p>
      )}

      <Regla />

      {/* ── categoría ── */}
      <Rotulo className="mt-5 block">Elegí qué querés</Rotulo>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {CATEGORIAS.map((c) => (
          <Opcion
            key={c.id}
            sel={cat === c.id}
            onClick={() => cambiarCat(c.id)}
            titulo={c.nombre}
            detalle={c.nota}
          />
        ))}
      </div>

      {/* ── producto ── */}
      <Rotulo className="mt-7 block">
        {cat === "cuchareable" ? "Sabor" : cat === "vasca" ? "Versión" : "Formato"}
      </Rotulo>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {delCat.map((p) => (
          <Opcion
            key={p.id}
            sel={prodId === p.id}
            onClick={() => elegirProducto(p)}
            titulo={p.nombre}
            detalle={p.detalle}
            precio={fmt(p.precio)}
            ancho={cat === "brownie" && p.slots === 3}
          />
        ))}
      </div>

      {/* ── adiciones (solo cuchareable) ── */}
      {prod && cat === "cuchareable" && (
        <>
          {(["adicion", "premium"] as const).map((grupo) => {
            const lista = extras.filter((e) => e.grupo === grupo);
            if (!lista.length) return null;
            return (
              <div key={grupo}>
                <div className="mt-7 flex items-baseline justify-between">
                  <Rotulo>{grupo === "adicion" ? "Adiciones" : "Premium"}</Rotulo>
                  <span className="text-[0.7rem] text-carbon/50">
                    +{fmt(lista[0].precio)} c/u · opcional
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {lista.map((e) => (
                    <Opcion
                      key={e.id}
                      sel={adiciones.includes(e.id)}
                      onClick={() => toggleAdicion(e.id)}
                      titulo={e.nombre}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ── toppings por slot ── */}
      {prod && prod.slots === 1 && (
        <>
          <div className="mt-7 flex items-baseline justify-between">
            <Rotulo>Topping incluido</Rotulo>
            <span className="text-[0.7rem] text-carbon/50">Elegí uno</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {toppings.map((e) => (
              <Opcion
                key={e.id}
                sel={slots[0] === e.id}
                onClick={() => setSlots([e.id])}
                titulo={e.nombre}
              />
            ))}
          </div>
        </>
      )}

      {prod && prod.slots > 1 && (
        <>
          <div className="mt-7 flex items-baseline justify-between">
            <Rotulo>Topping por unidad</Rotulo>
            <span className="text-[0.7rem] text-carbon/50">
              {prod.slots} en total · incluidos
            </span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {slots.map((val, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-laton">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <select
                  value={val}
                  onChange={(ev) =>
                    setSlots((s) => s.map((v, j) => (j === i ? ev.target.value : v)))
                  }
                  className={inputCls}
                >
                  <option value="">— elegí topping —</option>
                  {toppings.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── cantidad + agregar ── */}
      {listo && (
        <>
          <div className="mt-8">
            <Regla suave />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Rotulo>Cantidad</Rotulo>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                className="h-8 w-8 border border-carbon/20 text-vino transition hover:border-vino"
              >
                −
              </button>
              <span className="font-display w-6 text-center text-xl text-vino">{cantidad}</span>
              <button
                type="button"
                onClick={() => setCantidad((c) => Math.min(30, c + 1))}
                className="h-8 w-8 border border-carbon/20 text-vino transition hover:border-vino"
              >
                +
              </button>
            </div>
            <span className="font-display ml-auto text-xl text-vino-m">
              {fmt(precioUnit * cantidad)}
            </span>
          </div>
          <button
            type="button"
            onClick={agregar}
            className="mt-4 w-full border border-vino px-5 py-3 text-[0.86rem] font-medium text-vino transition hover:bg-vino hover:text-hueso"
          >
            Agregar al pedido
          </button>
        </>
      )}

      {/* ── carrito ── */}
      {lineas.length > 0 && (
        <>
          <div className="mt-10">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Tu pedido</Rotulo>
          <div className="mt-3 flex flex-col">
            {lineas.map((l, i) => (
              <div
                key={l.key}
                className={`flex items-start gap-3 py-3.5 ${
                  i > 0 ? "border-t border-carbon/12" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.88rem] text-vino">
                    {l.producto.nombre}
                    {l.cantidad > 1 && ` ×${l.cantidad}`}
                  </span>
                  {l.extras.length > 0 && (
                    <span className="mt-1 block text-[0.74rem] leading-snug text-carbon/55">
                      {l.extras.map((e) => e.nombre).join(", ")}
                    </span>
                  )}
                </span>
                <span className="font-mono text-[0.78rem] text-vino-m">
                  {fmt(l.precioUnit * l.cantidad)}
                </span>
                <button
                  type="button"
                  onClick={() => setLineas((ls) => ls.filter((x) => x.key !== l.key))}
                  className="font-mono text-[0.7rem] text-carbon/35 transition hover:text-vino"
                  aria-label="Quitar"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-1 border-t border-carbon/25 pt-3.5">
            <div className="flex items-baseline justify-between">
              <Rotulo>Total</Rotulo>
              <span className="font-display text-2xl text-vino">{fmt(totalCarrito(lineas))}</span>
            </div>
          </div>

          {/* ── datos ── */}
          <div className="mt-10">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Datos de entrega</Rotulo>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Opcion
              sel={entrega === "domicilio"}
              onClick={() => setEntrega("domicilio")}
              titulo="Domicilio"
              detalle="Se cobra aparte"
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
            <Campo label="Dirección">
              <input
                className={inputCls}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Calle, barrio"
              />
            </Campo>
          )}
          <div className="flex gap-3">
            <div className="flex-1">
              <Campo label="Fecha">
                <input
                  className={inputCls}
                  type="date"
                  min={reglas ? fechaMinimaISO(reglas.anticipacion_minutos, reglas.hora_max) : undefined}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Campo>
            </div>
            <div className="flex-1">
              <Campo label="Hora" hint="Entre 1:00 y 6:00 pm">
                <input
                  className={inputCls}
                  type="time"
                  min={reglas?.hora_min ?? "13:00"}
                  max={reglas?.hora_max ?? "18:00"}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </Campo>
            </div>
          </div>
          <Campo label="Método de pago" hint="Los cuchareables se pagan al recibir.">
            <select
              className={inputCls}
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value)}
            >
              <option value="">— elegí —</option>
              <option>Efectivo</option>
              <option>Nequi</option>
              <option>Bancolombia</option>
            </select>
          </Campo>
          <Campo label="Notas">
            <textarea
              className={`${inputCls} min-h-16 resize-none`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Alergias, indicaciones…"
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
            disabled={enviando}
            className="mt-5 w-full border border-vino bg-vino px-5 py-3.5 text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m disabled:opacity-50"
          >
            {enviando ? "Enviando…" : "Confirmar pedido"}
          </button>
        </>
      )}
    </div>
  );
}

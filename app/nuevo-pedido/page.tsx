"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Protegido from "../lib/Protegido";
import { supabase } from "../lib/supabase";
import { fmt } from "../lib/negocio";
import { cargarCatalogo, precioLinea } from "../lib/pedido";
import { ESTADOS, ESTADO_LABEL, hoyISO } from "../lib/gestion";
import type { Extra, Linea, Producto, Entrega } from "../lib/tipos";
import { Campo, Opcion, Regla, Rotulo, inputCls } from "../lib/ui";

const TIPOS = [
  { id: "cuchareable", nombre: "Cuchareables" },
  { id: "mesa_fria", nombre: "Mesa fría" },
  { id: "torta", nombre: "Torta" },
] as const;

function Contenido() {
  const router = useRouter();
  const [tipo, setTipo] = useState<string>("cuchareable");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);

  const [prodId, setProdId] = useState("");
  const [exSel, setExSel] = useState<string[]>([]);
  const [cantidad, setCantidad] = useState(1);

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [entrega, setEntrega] = useState<Entrega>("recoge");
  const [direccion, setDireccion] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState("");
  const [metodoPago, setMetodoPago] = useState("Efectivo");
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState("confirmado");
  const [descuento, setDescuento] = useState("");
  const [anticipo, setAnticipo] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    cargarCatalogo(tipo).then((c) => {
      setProductos(c.productos);
      setExtras(c.extras);
    });
    setProdId("");
    setExSel([]);
    setLineas([]);
  }, [tipo]);

  const prod = productos.find((p) => p.id === prodId) ?? null;
  const seleccionados = useMemo(
    () => exSel.map((id) => extras.find((e) => e.id === id)).filter((e): e is Extra => !!e),
    [exSel, extras]
  );
  const precioUnit = prod ? precioLinea(prod, seleccionados) : 0;

  const bruto = lineas.reduce((s, l) => s + l.precioUnit * l.cantidad, 0);
  const desc = Math.max(Number(descuento) || 0, 0);
  const total = Math.max(bruto - desc, 0);

  function agregar() {
    if (!prod) return;
    setLineas((l) => [
      ...l,
      { key: crypto.randomUUID(), producto: prod, extras: seleccionados, cantidad, precioUnit },
    ]);
    setProdId("");
    setExSel([]);
    setCantidad(1);
  }

  async function guardar() {
    setErr("");
    setOk("");
    if (!lineas.length) return setErr("Agregá al menos un producto.");
    if (!cliente.trim()) return setErr("Escribí el nombre del cliente.");
    if (!telefono.trim()) return setErr("Escribí el teléfono.");
    if (!fecha) return setErr("Elegí la fecha de entrega.");
    if (desc > bruto) return setErr("El descuento no puede ser mayor al total.");

    setGuardando(true);
    try {
      const { data, error } = await supabase.rpc("crear_pedido_equipo", {
        p_tipo: tipo,
        p_cliente: cliente.trim(),
        p_telefono: telefono.trim(),
        p_entrega: entrega,
        p_direccion: direccion.trim(),
        p_fecha: fecha,
        p_hora: hora || null,
        p_metodo_pago: metodoPago,
        p_notas: notas.trim(),
        p_items: lineas.map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
          extras: l.extras.map((e) => e.id),
        })),
        p_estado: estado,
        p_descuento: desc,
        p_anticipo: Math.max(Number(anticipo) || 0, 0),
      });
      if (error) throw new Error(error.message);
      setOk(data as string);
      setLineas([]);
      setCliente("");
      setTelefono("");
      setDireccion("");
      setNotas("");
      setDescuento("");
      setAnticipo("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[620px] px-7 pb-16">
      <div className="flex items-baseline justify-between pt-8">
        <Rotulo>Nuevo pedido</Rotulo>
        <Rotulo tono="carbon">Cargado por el equipo</Rotulo>
      </div>
      <div className="mt-3">
        <Regla />
      </div>

      <p className="mt-4 text-[0.78rem] leading-relaxed text-carbon/60">
        Este formulario no aplica anticipación mínima, cupo del día ni comprobante
        obligatorio. Los precios sí salen de la lista.
      </p>

      {ok && (
        <div className="mt-5 border border-vino/30 bg-vino/[0.06] px-4 py-3.5">
          <p className="text-[0.85rem] text-vino">
            Pedido <b>{ok}</b> creado. Ya debería estar en el calendario.
          </p>
          <button
            type="button"
            onClick={() => router.push("/pedidos")}
            className="mt-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-laton underline"
          >
            Ver en pedidos
          </button>
        </div>
      )}

      <Rotulo className="mt-7 block">Servicio</Rotulo>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {TIPOS.map((t) => (
          <Opcion key={t.id} sel={tipo === t.id} onClick={() => setTipo(t.id)} titulo={t.nombre} />
        ))}
      </div>

      {productos.length === 0 ? (
        <p className="mt-4 border border-carbon/15 bg-perga/60 px-4 py-3.5 text-[0.82rem] leading-relaxed text-carbon/60">
          No hay productos cargados para este servicio. Las tortas todavía no tienen
          lista de precios en la tabla <span className="font-mono">productos</span>.
        </p>
      ) : (
        <>
          <Campo label="Producto">
            <select className={inputCls} value={prodId} onChange={(e) => setProdId(e.target.value)}>
              <option value="">— elegí —</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {fmt(p.precio)}
                </option>
              ))}
            </select>
          </Campo>

          {prod && extras.length > 0 && (
            <>
              <Rotulo className="mt-5 block">Extras y toppings</Rotulo>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {extras.map((e) => (
                  <Opcion
                    key={e.id}
                    sel={exSel.includes(e.id)}
                    onClick={() =>
                      setExSel((s) =>
                        s.includes(e.id) ? s.filter((x) => x !== e.id) : [...s, e.id]
                      )
                    }
                    titulo={e.nombre}
                    precio={e.precio > 0 ? `+${fmt(e.precio)}` : null}
                  />
                ))}
              </div>
            </>
          )}

          {prod && (
            <div className="mt-5 flex items-center gap-4">
              <Rotulo>Cantidad</Rotulo>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value) || 1))}
                className={`${inputCls} w-24`}
              />
              <span className="font-display ml-auto text-lg text-vino-m">
                {fmt(precioUnit * cantidad)}
              </span>
              <button
                type="button"
                onClick={agregar}
                className="border border-vino px-3 py-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-vino transition hover:bg-vino hover:text-hueso"
              >
                Agregar
              </button>
            </div>
          )}
        </>
      )}

      {lineas.length > 0 && (
        <>
          <div className="mt-8">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Líneas</Rotulo>
          <div className="mt-2">
            {lineas.map((l, i) => (
              <div
                key={l.key}
                className={`flex items-start gap-3 py-3 ${i > 0 ? "border-t border-carbon/12" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.85rem] text-vino">
                    {l.producto.nombre}
                    {l.cantidad > 1 && ` ×${l.cantidad}`}
                  </span>
                  {l.extras.length > 0 && (
                    <span className="mt-0.5 block text-[0.72rem] text-carbon/55">
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
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-1 border-t border-carbon/25 pt-3">
            <div className="flex items-baseline justify-between">
              <Rotulo tono="carbon">Precio de lista</Rotulo>
              <span className="font-mono text-[0.82rem] text-carbon">{fmt(bruto)}</span>
            </div>
            {desc > 0 && (
              <div className="mt-1 flex items-baseline justify-between">
                <Rotulo tono="carbon">Descuento</Rotulo>
                <span className="font-mono text-[0.82rem] text-vino">−{fmt(desc)}</span>
              </div>
            )}
            <div className="mt-1.5 flex items-baseline justify-between">
              <Rotulo>Total</Rotulo>
              <span className="font-display text-2xl text-vino">{fmt(total)}</span>
            </div>
          </div>

          <div className="mt-8">
            <Regla />
          </div>
          <Rotulo className="mt-5 block">Cliente y entrega</Rotulo>

          <Campo label="Nombre">
            <input className={inputCls} value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </Campo>
          <Campo label="Teléfono">
            <input
              className={inputCls}
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="300 000 0000"
            />
          </Campo>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Opcion sel={entrega === "recoge"} onClick={() => setEntrega("recoge")} titulo="Recoge" />
            <Opcion
              sel={entrega === "domicilio"}
              onClick={() => setEntrega("domicilio")}
              titulo="Domicilio"
            />
          </div>

          {entrega === "domicilio" && (
            <Campo label="Dirección">
              <input
                className={inputCls}
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
            </Campo>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <Campo label="Fecha">
                <input
                  className={inputCls}
                  type="date"
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

          <div className="flex gap-3">
            <div className="flex-1">
              <Campo label="Descuento" hint="En pesos, sobre el precio de lista">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  placeholder="0"
                />
              </Campo>
            </div>
            <div className="flex-1">
              <Campo label="Anticipo recibido">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  value={anticipo}
                  onChange={(e) => setAnticipo(e.target.value)}
                  placeholder="0"
                />
              </Campo>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Campo label="Método de pago">
                <select
                  className={inputCls}
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option>Efectivo</option>
                  <option>Nequi</option>
                  <option>Bancolombia</option>
                </select>
              </Campo>
            </div>
            <div className="flex-1">
              <Campo label="Estado inicial">
                <select className={inputCls} value={estado} onChange={(e) => setEstado(e.target.value)}>
                  {ESTADOS.filter((e) => e !== "cancelado").map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_LABEL[e]}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          </div>

          <Campo label="Notas">
            <textarea
              className={`${inputCls} min-h-16 resize-none`}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </Campo>

          {err && (
            <p className="mt-4 border border-vino/30 bg-vino/[0.06] px-3.5 py-2.5 text-[0.8rem] text-vino">
              {err}
            </p>
          )}

          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="mt-5 w-full border border-vino bg-vino px-5 py-3.5 text-[0.9rem] font-medium text-hueso transition hover:bg-vino-m disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Crear pedido"}
          </button>
        </>
      )}
    </div>
  );
}

export default function NuevoPedido() {
  return (
    <Protegido>
      <Contenido />
    </Protegido>
  );
}

import { supabase } from "./supabase";
import { WHATSAPP, fmt } from "./negocio";
import type { Producto, Extra, Reglas, Linea, Entrega } from "./tipos";

/** Catálogo de un servicio. Las tres vistas son lo único que anon puede leer. */
export async function cargarCatalogo(tipo: string) {
  const [prods, exts, regs] = await Promise.all([
    supabase.from("productos_publicos").select("*").eq("tipo", tipo).order("orden"),
    supabase.from("extras_publicos").select("*").eq("tipo", tipo).order("orden"),
    supabase.from("reglas_publicas").select("*").eq("tipo", tipo).single(),
  ]);
  return {
    productos: (prods.data ?? []) as Producto[],
    extras: (exts.data ?? []) as Extra[],
    reglas: (regs.data ?? null) as Reglas | null,
    error: prods.error?.message ?? exts.error?.message ?? regs.error?.message ?? null,
  };
}

export function precioLinea(producto: Producto, extras: Extra[]) {
  return producto.precio + extras.reduce((s, e) => s + e.precio, 0);
}

export function totalCarrito(lineas: Linea[]) {
  return lineas.reduce((s, l) => s + l.precioUnit * l.cantidad, 0);
}

export function totalUnidades(lineas: Linea[]) {
  return lineas.reduce((s, l) => s + l.cantidad, 0);
}

/** Fecha mínima en formato YYYY-MM-DD, en hora local (no UTC:
 *  en UTC, de noche se corre un día — la lección de Bianco). */
export function fechaMinimaISO(anticipacionMinutos: number, horaMax?: string | null) {
  const d = new Date(Date.now() + anticipacionMinutos * 60000);
  // Si el mismo día ya pasó la ventana de entrega, el primer día hábil es el siguiente.
  if (horaMax) {
    const [hm] = horaMax.split(":").map(Number);
    if (d.getHours() >= hm) d.setDate(d.getDate() + 1);
  }
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function subirComprobante(file: File) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `comprobantes/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("comprobantes")
    .upload(path, file, { upsert: false });
  if (error) throw new Error("No se pudo subir el comprobante: " + error.message);
  return supabase.storage.from("comprobantes").getPublicUrl(path).data.publicUrl;
}

const MENSAJES: Record<string, string> = {
  NOMBRE_REQUERIDO: "Escribí tu nombre.",
  TELEFONO_REQUERIDO: "Escribí tu teléfono.",
  FECHA_REQUERIDA: "Elegí la fecha de entrega.",
  DIRECCION_REQUERIDA: "Escribí la dirección de entrega.",
  PEDIDO_VACIO: "Tu pedido está vacío.",
  COMPROBANTE_REQUERIDO: "Falta el comprobante del anticipo.",
  HORA_FUERA_DE_RANGO: "La hora debe estar entre 1:00 pm y 6:00 pm.",
  ANTICIPACION_MINIMA: "Necesitamos más tiempo para prepararlo. Elegí una fecha más adelante.",
  CUPO_LLENO: "Ese día ya está lleno. Elegí otra fecha.",
  CUPO_UNIDADES_LLENO: "Ese día ya no queda capacidad de producción. Elegí otra fecha.",
  MINIMO_UNIDADES: "No alcanzás el mínimo de unidades por producto.",
  TOPPINGS_INCOMPLETOS: "Falta elegir todos los toppings.",
  PRODUCTO_INVALIDO: "Uno de los productos ya no está disponible.",
  EXTRA_INVALIDO: "Una de las adiciones ya no está disponible.",
};

function traducir(raw: string) {
  const clave = Object.keys(MENSAJES).find((k) => raw.includes(k));
  if (!clave) return "No se pudo crear el pedido: " + raw;
  // El servidor adjunta detalle después de los dos puntos (ej. el mínimo real).
  const detalle = raw.split(clave + ":")[1]?.trim();
  return detalle ? `${MENSAJES[clave]} (${detalle})` : MENSAJES[clave];
}

export type DatosEntrega = {
  tipo: string;
  cliente: string;
  telefono: string;
  entrega: Entrega;
  direccion: string;
  fecha: string;
  hora: string;
  metodoPago: string;
  notas: string;
  comprobanteUrl: string | null;
};

/** Crea el pedido. El navegador manda IDs y cantidades, nunca precios. */
export async function crearPedido(d: DatosEntrega, lineas: Linea[]) {
  const { data, error } = await supabase.rpc("crear_pedido_publico", {
    p_tipo: d.tipo,
    p_cliente: d.cliente.trim(),
    p_telefono: d.telefono.trim(),
    p_entrega: d.entrega,
    p_direccion: d.direccion.trim(),
    p_fecha: d.fecha,
    p_hora: d.hora || null,
    p_metodo_pago: d.metodoPago,
    p_notas: d.notas.trim(),
    p_comprobante_url: d.comprobanteUrl,
    p_items: lineas.map((l) => ({
      producto_id: l.producto.id,
      cantidad: l.cantidad,
      extras: l.extras.map((e) => e.id),
    })),
  });
  if (error) throw new Error(traducir(error.message));
  return data as string;
}

export function linkWhatsApp(
  id: string,
  titulo: string,
  d: DatosEntrega,
  lineas: Linea[]
) {
  const items = lineas
    .map((l, i) => {
      const partes = [`${i + 1}. *${l.producto.nombre}*${l.cantidad > 1 ? ` ×${l.cantidad}` : ""}`];
      if (l.producto.detalle) partes.push(`   ${l.producto.detalle}`);
      if (l.extras.length) partes.push(`   ${l.extras.map((e) => e.nombre).join(", ")}`);
      partes.push(`   Subtotal: ${fmt(l.precioUnit * l.cantidad)}`);
      return partes.join("\n");
    })
    .join("\n\n");

  const txt = [
    `*${titulo} — CHOK BAKE*`,
    `Pedido *${id}*`,
    `------------------------`,
    items,
    `------------------------`,
    `*Entrega:* ${d.entrega === "domicilio" ? "Domicilio" : "Recoge en punto"}`,
    d.entrega === "domicilio" ? `*Dirección:* ${d.direccion}` : null,
    `*Fecha:* ${d.fecha}${d.hora ? ` — ${d.hora}` : ""}`,
    `*Pago:* ${d.metodoPago}`,
    `*TOTAL: ${fmt(totalCarrito(lineas))}*`,
    d.comprobanteUrl ? `*Comprobante:* ${d.comprobanteUrl}` : null,
    `------------------------`,
    `*Cliente:* ${d.cliente}`,
    `*Teléfono:* ${d.telefono}`,
    d.notas ? `*Notas:* ${d.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(txt)}`;
}

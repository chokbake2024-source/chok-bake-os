import { supabase } from "./supabase";

export type PedidoItem = {
  id: string;
  producto_id: string;
  nombre: string;
  cantidad: number;
  extras: string[];
  precio_unit: number;
  subtotal: number;
};

export type Pedido = {
  id: string;
  tipo: string;
  cliente: string;
  telefono: string;
  entrega: string;
  direccion: string | null;
  fecha_entrega: string;
  hora_entrega: string | null;
  metodo_pago: string | null;
  notas: string | null;
  valor: number;
  anticipo: number;
  saldo: number;
  descuento: number | null;
  origen: string | null;
  estado: string;
  comprobante_url: string | null;
  created_at: string;
  pedido_items: PedidoItem[];
};

export const ESTADOS = [
  "nuevo",
  "confirmado",
  "en_produccion",
  "entregado",
  "cancelado",
] as const;

export const ESTADO_LABEL: Record<string, string> = {
  nuevo: "Nuevo",
  confirmado: "Confirmado",
  en_produccion: "En producción",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const TIPO_LABEL: Record<string, string> = {
  cuchareable: "Cuchareable",
  mesa_fria: "Mesa fría",
  torta: "Torta",
};

/** Fecha de hoy en hora local, no UTC. */
export function hoyISO() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function diasDesdeHoy(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function fechaLarga(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Pedidos con sus líneas. Solo `authenticated` puede leer esto (RLS). */
export async function cargarPedidos(opciones?: { desde?: string; hasta?: string }) {
  let q = supabase
    .from("pedidos")
    .select("*, pedido_items(*)")
    .order("fecha_entrega", { ascending: true })
    .order("hora_entrega", { ascending: true, nullsFirst: true });

  if (opciones?.desde) q = q.gte("fecha_entrega", opciones.desde);
  if (opciones?.hasta) q = q.lte("fecha_entrega", opciones.hasta);

  const { data, error } = await q;
  return { pedidos: (data ?? []) as Pedido[], error: error?.message ?? null };
}

export async function cambiarEstado(id: string, estado: string) {
  const { error } = await supabase.from("pedidos").update({ estado }).eq("id", id);
  if (error) throw new Error("No se pudo cambiar el estado: " + error.message);
}

export type DiaBloqueado = {
  id: number;
  fecha: string;
  tipo: string | null;
  motivo: string | null;
};

export async function cargarDiasBloqueados() {
  const { data, error } = await supabase
    .from("dias_bloqueados")
    .select("*")
    .gte("fecha", hoyISO())
    .order("fecha");
  return { dias: (data ?? []) as DiaBloqueado[], error: error?.message ?? null };
}

export async function bloquearDia(fecha: string, tipo: string | null, motivo: string) {
  const { error } = await supabase
    .from("dias_bloqueados")
    .insert({ fecha, tipo, motivo: motivo.trim() || null });
  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505")
      throw new Error("Ese día ya está cerrado para ese servicio.");
    throw new Error("No se pudo cerrar el día: " + error.message);
  }
}

export async function desbloquearDia(id: number) {
  const { error } = await supabase.from("dias_bloqueados").delete().eq("id", id);
  if (error) throw new Error("No se pudo reabrir el día: " + error.message);
}

export type Cliente = {
  telefono: string;
  nombre: string;
  pedidos: Pedido[];
  total: number;
  ultimo: string;
};

/** Historial agrupado por teléfono: el teléfono es la identidad del
 *  cliente, no el nombre (que llega escrito de diez formas distintas). */
export async function buscarClientes(consulta: string) {
  const q = consulta.trim();
  let sel = supabase.from("pedidos").select("*, pedido_items(*)");
  if (q) sel = sel.or(`cliente.ilike.%${q}%,telefono.ilike.%${q}%,id.ilike.%${q}%`);

  const { data, error } = await sel
    .order("fecha_entrega", { ascending: false })
    .limit(300);
  if (error) return { clientes: [] as Cliente[], error: error.message };

  const mapa = new Map<string, Cliente>();
  for (const p of (data ?? []) as Pedido[]) {
    const clave = p.telefono.replace(/\D/g, "") || p.telefono;
    const actual = mapa.get(clave);
    if (actual) {
      actual.pedidos.push(p);
      if (p.estado !== "cancelado") actual.total += Number(p.valor);
      if (p.fecha_entrega > actual.ultimo) actual.ultimo = p.fecha_entrega;
    } else {
      mapa.set(clave, {
        telefono: p.telefono,
        nombre: p.cliente,
        pedidos: [p],
        total: p.estado === "cancelado" ? 0 : Number(p.valor),
        ultimo: p.fecha_entrega,
      });
    }
  }

  return {
    clientes: [...mapa.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo)),
    error: null,
  };
}

export function linkClienteWA(p: Pedido) {
  const tel = p.telefono.replace(/\D/g, "");
  const num = tel.startsWith("57") ? tel : `57${tel}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(
    `¡Hola ${p.cliente.split(" ")[0]}! Te escribimos de Chok Bake por tu pedido ${p.id}.`
  )}`;
}

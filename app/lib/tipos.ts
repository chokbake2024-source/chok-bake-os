export type Producto = {
  id: string;
  tipo: string;
  categoria: string;
  nombre: string;
  precio: number;
  unidad: string;
  detalle: string | null;
  slots: number;
  /** Grupo de `extras` que este producto ofrece como opciones. */
  grupo_extras: string | null;
  orden: number;
};

export type Extra = {
  id: string;
  tipo: string;
  grupo: string;
  nombre: string;
  precio: number;
  orden: number;
};

export type Reglas = {
  tipo: string;
  anticipacion_minutos: number;
  cupo_dia: number | null;
  cupo_unidades_dia: number | null;
  minimo_unidades: number;
  requiere_comprobante: boolean;
  porcentaje_anticipo: number;
  hora_min: string | null;
  hora_max: string | null;
};

/** Línea del carrito. `precioUnit` es solo para mostrar:
 *  el precio de verdad lo recalcula el servidor al crear el pedido. */
export type Linea = {
  key: string;
  producto: Producto;
  extras: Extra[];
  cantidad: number;
  precioUnit: number;
};

export type Entrega = "domicilio" | "recoge";

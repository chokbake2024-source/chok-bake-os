// Datos del negocio. Si algo de esto cambia, se cambia acá y en ningún otro lado.

export const WHATSAPP = "573223079573";

export const PAGO = {
  bancolombia: "83456270649", // Cuenta de Ahorros
  nequi: "3103114326",
  llave: "@paulah4535",
  titular: "Paula Hernández",
};

export const PUNTO_RECOGIDA =
  "Av. 4 #56-26, Urbanización Bella Vista, Pinal del Río, Cúcuta";

export const CIUDAD = "Cúcuta";

export const SERVICIOS = [
  {
    slug: "cuchareables",
    indice: "I",
    nombre: "Cuchareables",
    claim: "Postres individuales, listos hoy",
    detalle: "Cuchareables, tarta vasca y brownies",
    desde: 17000,
    nota: "Entregas 1:00 – 6:00 pm · mínimo 30 min",
  },
  {
    slug: "mesas-frias",
    indice: "II",
    nombre: "Mesas frías",
    claim: "Postres para tu evento",
    detalle: "Armá tu mesa porción por porción",
    desde: 2500,
    nota: "Mínimo 16 unidades por producto · 2 días",
  },
  {
    slug: "tortas",
    indice: "III",
    nombre: "Tortas",
    claim: "Personalizadas a tu medida",
    detalle: "Sabor, tamaño, relleno y decoración",
    desde: null,
    nota: "2 días de anticipación · anticipo del 50%",
  },
] as const;

export function fmt(n: number) {
  return "$" + n.toLocaleString("es-CO");
}

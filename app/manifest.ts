import type { MetadataRoute } from "next";

/** PWA: para que tu hermana agregue el panel a la pantalla de inicio
 *  y se abra como app, sin barra de navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chok Bake",
    short_name: "Chok",
    description: "Pedidos y gestión de Chok Bake",
    start_url: "/panel",
    display: "standalone",
    background_color: "#ede6da",
    theme_color: "#5a1226",
    lang: "es-CO",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

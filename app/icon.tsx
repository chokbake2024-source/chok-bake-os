import { ImageResponse } from "next/og";
import { CorteOG, HUESO, PERGA, ROSA, VINO, VINO_M } from "./lib/corte-og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** El corte transversal de Estratos. A 16px sigue leyéndose como capas,
 *  por eso son 4 bandas gruesas y no las 14 de la lámina. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: HUESO,
        }}
      >
        <CorteOG
          diametro={58}
          borde={3}
          bandas={[
            [ROSA, 3],
            [VINO, 2],
            [PERGA, 1.4],
            [VINO_M, 3.2],
          ]}
        />
      </div>
    ),
    size
  );
}

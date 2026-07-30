import { ImageResponse } from "next/og";
import { CorteOG, HUESO, LATON, PERGA, ROSA, VINO, VINO_M } from "./lib/corte-og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          diametro={140}
          borde={5}
          bandas={[
            [ROSA, 2.6],
            [VINO, 1.6],
            [PERGA, 1.2],
            [VINO_M, 2.4],
            [LATON, 0.5],
            [ROSA, 2],
            [VINO, 1.8],
          ]}
        />
      </div>
    ),
    size
  );
}

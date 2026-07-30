import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  CorteOG,
  CARBON,
  HUESO,
  LATON,
  PERGA,
  ROSA,
  VINO,
  VINO_M,
} from "./lib/corte-og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Chok Bake — Postres artesanales en Cúcuta";

/** Cinco especímenes: la variación con regla es la firma de Estratos. */
const CORTES: [string, number][][] = [
  [
    [ROSA, 3],
    [VINO, 1.4],
    [PERGA, 1.2],
    [VINO_M, 4.4],
  ],
  [
    [PERGA, 2.4],
    [VINO_M, 1.6],
    [ROSA, 3.2],
    [VINO, 2.8],
  ],
  [
    [VINO, 3.2],
    [ROSA, 1.4],
    [LATON, 0.6],
    [PERGA, 4.8],
  ],
  [
    [VINO_M, 2.6],
    [PERGA, 1.2],
    [VINO, 2.4],
    [ROSA, 3.8],
  ],
  [
    [ROSA, 2],
    [VINO, 2.8],
    [VINO_M, 2.2],
    [PERGA, 3],
  ],
];

async function fuente(archivo: string) {
  return readFile(join(process.cwd(), "public/fonts", archivo));
}

export default async function OG() {
  const [italiana, mono, crimson] = await Promise.all([
    fuente("Italiana-Regular.ttf"),
    fuente("DMMono-Regular.ttf"),
    fuente("CrimsonPro-Italic.ttf"),
  ]);

  const rotulo = {
    fontFamily: "DM Mono",
    fontSize: 16,
    letterSpacing: 3.5,
    color: CARBON,
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: HUESO,
          padding: "52px 72px",
          fontFamily: "DM Mono",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={rotulo}>CÚCUTA</span>
            <span style={rotulo}>POSTRES ARTESANALES</span>
          </div>
          <div
            style={{
              display: "flex",
              height: 1,
              background: CARBON,
              opacity: 0.3,
              marginTop: 14,
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Italiana",
              fontSize: 132,
              letterSpacing: 20,
              color: VINO,
              lineHeight: 1,
            }}
          >
            CHOK BAKE
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Crimson Pro",
              fontSize: 34,
              fontStyle: "italic",
              color: VINO_M,
              marginTop: 24,
            }}
          >
            Cuchareables · Mesas frías · Tortas
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 28,
              marginBottom: 24,
            }}
          >
            {CORTES.map((bandas, i) => (
              <CorteOG key={i} bandas={bandas} diametro={76} borde={2} color={VINO_M} />
            ))}
          </div>
          <div
            style={{ display: "flex", height: 1, background: CARBON, opacity: 0.3 }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 14,
            }}
          >
            <span style={{ ...rotulo, color: LATON }}>
              NADA DE VALOR SE HACE DE UNA SOLA VEZ
            </span>
            <span style={{ ...rotulo, color: LATON }}>N.º 001</span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Italiana", data: italiana, style: "normal", weight: 400 },
        { name: "DM Mono", data: mono, style: "normal", weight: 400 },
        { name: "Crimson Pro", data: crimson, style: "italic", weight: 400 },
      ],
    }
  );
}

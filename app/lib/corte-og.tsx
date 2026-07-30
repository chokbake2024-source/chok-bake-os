/** Corte transversal para next/og.
 *
 *  Satori no soporta los hard stops de `linear-gradient` (`color 0% 30%`):
 *  los interpola y el corte sale como un degradado brillante, perdiendo
 *  las capas. Hay que apilar divs con alturas en píxeles.
 */
export function CorteOG({
  bandas,
  diametro,
  borde,
  color = "#5a1226",
}: {
  bandas: [string, number][];
  diametro: number;
  borde: number;
  color?: string;
}) {
  const interior = diametro - borde * 2;
  const total = bandas.reduce((s, b) => s + b[1], 0);

  return (
    <div
      style={{
        width: diametro,
        height: diametro,
        borderRadius: diametro,
        border: `${borde}px solid ${color}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {bandas.map(([c, peso], i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: interior,
            height: Math.round((peso / total) * interior),
            background: c,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

export const HUESO = "#ede6da";
export const VINO = "#5a1226";
export const VINO_M = "#8c2740";
export const ROSA = "#c49da0";
export const LATON = "#b08d57";
export const PERGA = "#f6f1e8";
export const CARBON = "#2e2a28";

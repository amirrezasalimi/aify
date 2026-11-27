// Adapted from the seeded geo-monogram in amir/index.html (project covers).
function createCoverRng(id: string) {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) {
    seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  }
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const accents = ["#38bdf8", "#a78bfa", "#fb7185", "#fb923c", "#4ade80", "#facc15"];
const cellSize = 22;

export function AgentAvatar({ seed, size = 22 }: { seed: string; size?: number }) {
  const rng = createCoverRng(seed);
  const values = Array.from({ length: 15 }, rng);
  const accent = accents[Math.floor(rng() * accents.length)];
  const highest = Math.max(...values);
  const fallbackAccent = highest <= 0.78 ? values.indexOf(highest) : -1;

  return (
    <svg aria-hidden="true" className="shrink-0" width={size} height={size} viewBox="-12 -12 134 134">
      <rect x={-12} y={-12} width={134} height={134} rx={26} fill="#18181b" />
      {values.flatMap((value, cell) => {
        if (value < 0.34 && cell !== fallbackAccent) return [];
        const col = cell % 3;
        const y = Math.floor(cell / 3) * cellSize;
        const fill = value > 0.78 || cell === fallbackAccent ? accent : "#f4f4f5";
        return (col === 2 ? [2] : [col, 4 - col]).map((mirroredCol) => {
          const x = mirroredCol * cellSize;
          const key = `${y}:${x}`;
          return value > 0.62 ? (
            <circle key={key} cx={x + 11} cy={y + 11} r={cellSize * 0.42} fill={fill} />
          ) : (
            <rect key={key} x={x + 1.5} y={y + 1.5} width={19} height={19} rx={3} fill={fill} />
          );
        });
      })}
    </svg>
  );
}

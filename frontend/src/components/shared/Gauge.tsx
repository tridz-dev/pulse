import { useState, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

// ─── Utility ────────────────────────────────────────────
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Generate heatmap gradient stops (green → yellow → orange → red)
function heatmapStops() {
  return [
    { offset: "0%", color: "#10b981" },
    { offset: "25%", color: "#84cc16" },
    { offset: "50%", color: "#eab308" },
    { offset: "75%", color: "#f97316" },
    { offset: "100%", color: "#ef4444" },
  ];
}

// Get a solid color from a value (0–100)
function solidColorFromValue(value: number) {
  if (value <= 25) return "#10b981";
  if (value <= 50) return "#84cc16";
  if (value <= 75) return "#eab308";
  if (value <= 90) return "#f97316";
  return "#ef4444";
}

// ─── Tick marks ─────────────────────────────────────────
interface TicksProps {
  cx: number;
  cy: number;
  radius: number;
  count: number;
  tickLength: number;
  color: string;
}

function Ticks({ cx, cy, radius, count, tickLength, color }: TicksProps) {
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    const angle = Math.PI + (i / count) * Math.PI;
    const isMajor = i % (count / 4) === 0;
    const len = isMajor ? tickLength * 1.6 : tickLength;
    const x1 = cx + Math.cos(angle) * (radius - len);
    const y1 = cy + Math.sin(angle) * (radius - len);
    const x2 = cx + Math.cos(angle) * radius;
    const y2 = cy + Math.sin(angle) * radius;
    ticks.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={isMajor ? 2 : 1}
        strokeLinecap="round"
        opacity={isMajor ? 0.6 : 0.25}
      />
    );
  }
  return <>{ticks}</>;
}

// ─── Labels around arc ──────────────────────────────────
interface ArcLabelsProps {
  cx: number;
  cy: number;
  radius: number;
  divisions: number;
  fontSize: number;
  color: string;
}

function ArcLabels({ cx, cy, radius, divisions, fontSize, color }: ArcLabelsProps) {
  const labels = [];
  for (let i = 0; i <= divisions; i++) {
    const val = Math.round((i / divisions) * 100);
    const angle = Math.PI + (i / divisions) * Math.PI;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    labels.push(
      <text
        key={i}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={color}
        fontSize={fontSize}
        fontFamily="'DM Mono', monospace"
        opacity={0.5}
      >
        {val}
      </text>
    );
  }
  return <>{labels}</>;
}

// ─── Arc path helper ────────────────────────────────────
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = {
    x: cx + Math.cos(endAngle) * r,
    y: cy + Math.sin(endAngle) * r,
  };
  const end = {
    x: cx + Math.cos(startAngle) * r,
    y: cy + Math.sin(startAngle) * r,
  };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

// ─── Main Gauge Component ───────────────────────────────
const PRESETS = {
  default: {
    trackColor: "rgba(255,255,255,0.06)",
    needleColor: "#fff",
    dotColor: "#fff",
    textColor: "#f4f4f5",
    subTextColor: "rgba(255,255,255,0.4)",
    tickColor: "rgba(255,255,255,0.5)",
    labelColor: "rgba(255,255,255,0.35)",
    bg: "transparent",
  },
  light: {
    trackColor: "rgba(0,0,0,0.06)",
    needleColor: "#18181b",
    dotColor: "#18181b",
    textColor: "#18181b",
    subTextColor: "rgba(0,0,0,0.45)",
    tickColor: "rgba(0,0,0,0.3)",
    labelColor: "rgba(0,0,0,0.3)",
    bg: "transparent",
  },
};

interface GaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subtitle?: string;
  showNeedle?: boolean;
  showTicks?: boolean;
  showLabels?: boolean;
  showGlow?: boolean;
  mode?: "gradient" | "solid" | "filled";
  accentColor?: string;
  animationDuration?: number;
  theme?: "default" | "light";
  className?: string;
}

export function Gauge({
  value = 72,
  size = 240,
  strokeWidth: _sw,
  label,
  subtitle,
  showNeedle = true,
  showTicks = true,
  showLabels = false,
  showGlow = true,
  mode = "gradient",
  accentColor,
  animationDuration = 1200,
  theme = "default",
  className,
}: GaugeProps) {
  const [animated, setAnimated] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  const colors = PRESETS[theme] || PRESETS.default;
  const sw = _sw || Math.max(size * 0.07, 8);
  const norm = clamp(value, 0, 100);

  useEffect(() => {
    const from = animated;
    const to = norm;
    startRef.current = null;

    function step(ts: number) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = clamp(elapsed / animationDuration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimated(lerp(from, to, eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [norm, animationDuration]);

  const cx = size / 2;
  const cy = size / 2 + size * 0.05;
  const radius = (size - sw * 2) / 2;
  const arcStart = Math.PI;
  const arcEnd = 2 * Math.PI;
  const valueAngle = arcStart + (animated / 100) * Math.PI;

  const gradId = `gauge-grad-${size}`;
  const fillGradId = `gauge-fill-${size}`;
  const glowId = `gauge-glow-${size}`;

  const resolvedAccent = accentColor || solidColorFromValue(animated);

  const needleLen = radius - sw * 0.5 - 4;
  const needleX = cx + Math.cos(valueAngle) * needleLen;
  const needleY = cy + Math.sin(valueAngle) * needleLen;

  const percentage = Math.round(animated);

  return (
    <div
      className={cn("relative flex flex-col items-center", className)}
      style={{
        width: size,
        height: size * 0.62,
        background: colors.bg,
      }}
    >
      <svg
        width={size}
        height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            {heatmapStops().map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>

          <linearGradient id={fillGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={resolvedAccent} stopOpacity="0.15" />
            <stop offset="100%" stopColor={resolvedAccent} stopOpacity="0.35" />
          </linearGradient>

          {showGlow && (
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={sw * 0.6} />
            </filter>
          )}
        </defs>

        <path
          d={describeArc(cx, cy, radius, arcStart, arcEnd)}
          fill="none"
          stroke={colors.trackColor}
          strokeWidth={sw}
          strokeLinecap="round"
        />

        {mode === "filled" && animated > 0.5 && (
          <path
            d={`
              M ${cx} ${cy}
              L ${cx + Math.cos(arcStart) * radius} ${cy + Math.sin(arcStart) * radius}
              ${describeArc(cx, cy, radius, arcStart, valueAngle).replace(/^M[^A]*/, "")}
              L ${cx} ${cy}
              Z
            `}
            fill={`url(#${fillGradId})`}
            opacity={0.5}
          />
        )}

        {showGlow && animated > 0.5 && (
          <path
            d={describeArc(cx, cy, radius, arcStart, valueAngle)}
            fill="none"
            stroke={mode === "gradient" ? `url(#${gradId})` : resolvedAccent}
            strokeWidth={sw * 1.5}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            opacity={0.35}
          />
        )}

        {animated > 0.5 && (
          <path
            d={describeArc(cx, cy, radius, arcStart, valueAngle)}
            fill="none"
            stroke={mode === "gradient" ? `url(#${gradId})` : resolvedAccent}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        )}

        {showTicks && (
          <Ticks
            cx={cx}
            cy={cy}
            radius={radius - sw / 2 - 3}
            count={40}
            tickLength={size * 0.03}
            color={colors.tickColor}
          />
        )}

        {showLabels && (
          <ArcLabels
            cx={cx}
            cy={cy}
            radius={radius + sw / 2 + size * 0.06}
            divisions={4}
            fontSize={size * 0.045}
            color={colors.labelColor}
          />
        )}

        {showNeedle && (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <line
              x1={cx}
              y1={cy}
              x2={needleX}
              y2={needleY}
              stroke={colors.needleColor}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <circle
              cx={cx}
              cy={cy}
              r={sw * 0.45}
              fill={colors.dotColor}
              opacity={0.9}
            />
            <circle
              cx={needleX}
              cy={needleY}
              r={3}
              fill={mode === "gradient" ? solidColorFromValue(animated) : resolvedAccent}
            />
          </g>
        )}
      </svg>

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none"
        style={{ marginBottom: size * 0.02 }}
      >
        <span
          className="font-bold tracking-tighter leading-none"
          style={{
            fontSize: size * 0.18,
            color: colors.textColor,
            fontFamily: "'DM Mono', 'SF Mono', monospace",
          }}
        >
          {percentage}
          <span style={{ fontSize: size * 0.09, opacity: 0.5, fontWeight: 500 }}>%</span>
        </span>
        {label && (
          <span
            className="font-semibold uppercase tracking-widest"
            style={{
              fontSize: Math.max(size * 0.048, 9),
              color: colors.subTextColor,
              marginTop: size * 0.01,
            }}
          >
            {label}
          </span>
        )}
        {subtitle && (
          <span
            className="mt-0.5"
            style={{
              fontSize: Math.max(size * 0.04, 8),
              color: colors.subTextColor,
              opacity: 0.65,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

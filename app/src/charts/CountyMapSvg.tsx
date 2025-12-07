import { useState } from "react";
import { Tooltip } from "antd";
import {
  buildSvgPath,
  normalizeCountyName,
  type BBox,
  type CountyFeature,
} from "../hooks/useCountyGeojson";
import s from "./CountyMapSvg.module.css";

function NorthArrow({
  x,
  y,
  size = 30,
}: {
  x: number;
  y: number;
  size?: number;
}) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon
        points={`0,${-size / 2} ${size / 6},${size / 3} 0,${size / 6} ${-size / 6},${size / 3}`}
        fill="#333"
        stroke="#333"
        strokeWidth={0.5}
      />
      <text
        y={-size / 2 - 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight="bold"
        fill="#333"
      >
        N
      </text>
    </g>
  );
}

export interface CountyMapSvgProps {
  width: number;
  height: number;
  bbox: BBox | null;
  featuresByState: Record<string, CountyFeature[]>;
  highlightedCounties: Set<string>;
  getTooltip?: (
    countyName: string,
    state: string,
    isHighlighted: boolean
  ) => string;
}

const highlightColor = "var(--highlight-color)";

export function CountyMapSvg({
  width,
  height,
  bbox,
  featuresByState,
  highlightedCounties,
  getTooltip,
}: CountyMapSvgProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const defaultTooltip = (countyName: string, state: string) =>
    `${countyName}, ${state}`;

  return (
    <svg width={width} height={height}>
      {Object.entries(featuresByState).map(([st, stFeatures]) => (
        <g key={`state-group-${st}`}>
          {/* State outlines */}
          {stFeatures.map((f: CountyFeature, idx: number) => (
            <path
              className={s.stateOutline}
              key={`outline-${idx}`}
              d={bbox ? buildSvgPath(f, bbox, width, height) : ""}
            />
          ))}
          {/* County fills */}
          {stFeatures.map((f: CountyFeature, idx: number) => {
            const countyName = f.properties?.Name ?? "";
            const key = `${st}:${normalizeCountyName(countyName)}`;
            const isHighlighted = highlightedCounties.has(key);
            const isHovered = hovered === `${st}:${countyName}`;
            const fillColor = isHighlighted
              ? `lch(from ${highlightColor} calc(l * 1.3) c h)`
              : "lch(100% 0 0)";

            const tooltipText = getTooltip
              ? getTooltip(countyName, st, isHighlighted)
              : defaultTooltip(countyName, st);

            return (
              <Tooltip key={`fill-${idx}`} title={tooltipText} placement="top">
                <path
                  className={s.county}
                  d={bbox ? buildSvgPath(f, bbox, width, height) : ""}
                  fill={
                    isHovered
                      ? isHighlighted
                        ? highlightColor
                        : "#e0e0e0"
                      : fillColor
                  }
                  onMouseEnter={() => setHovered(`${st}:${countyName}`)}
                  onMouseLeave={() => setHovered(null)}
                />
              </Tooltip>
            );
          })}
        </g>
      ))}
      {<NorthArrow x={width - 25} y={30} size={28} />}
    </svg>
  );
}

export default CountyMapSvg;

"use client";

import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

/** Tiny trend line for KPI tiles — no axes, no tooltip, one series. */
export default function Sparkline({
  values,
  color = "#3987e5",
}: {
  values: Array<number | null>;
  color?: string;
}) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-9 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={["dataMin", "dataMax"]} hide />
          <Line
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

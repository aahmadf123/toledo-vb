"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum1, fmtPct, fmtRate, fmtRating } from "@/lib/format";

export interface SetComparisonSeries {
  id: string;
  name: string;
  color: string;
}

/** Grouped bars: one cluster per set, one bar per selected player/team. */
export default function SetComparison({
  labels,
  series,
  values,
  fmt = "rate3",
}: {
  labels: string[];
  series: SetComparisonSeries[];
  /** values[seriesIndex][labelIndex] */
  values: Array<Array<number | null>>;
  fmt?: "rate3" | "pct1" | "rating" | "num1";
}) {
  const fmtValue = (v: number | null) =>
    fmt === "pct1"
      ? fmtPct(v)
      : fmt === "rating"
        ? fmtRating(v)
        : fmt === "num1"
          ? fmtNum1(v)
          : fmtRate(v);

  const data = labels.map((label, i) => {
    const row: Record<string, string | number | null> = { label };
    series.forEach((s, si) => {
      row[s.id] = values[si]?.[i] ?? null;
    });
    return row;
  });

  return (
    <div className="aspect-[2/1] min-h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }} barGap={2}>
          <CartesianGrid stroke="#24395e" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#93a5c4" }}
            tickLine={false}
            axisLine={{ stroke: "#24395e" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#93a5c4" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => fmtValue(v)}
            width={52}
          />
          <Tooltip
            formatter={(v) => fmtValue(typeof v === "number" ? v : null)}
            labelStyle={{ fontSize: 12, fontWeight: 600, color: "#f2f5fa" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              backgroundColor: "#16294a",
              border: "1px solid #24395e",
              color: "#f2f5fa",
            }}
            itemStyle={{ color: "#f2f5fa" }}
            cursor={{ fill: "#16294a", opacity: 0.5 }}
          />
          {series.length >= 2 ? (
            <Legend wrapperStyle={{ fontSize: 12, color: "#93a5c4" }} />
          ) : null}
          {series.map((s) => (
            <Bar
              key={s.id}
              dataKey={s.id}
              name={s.name}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

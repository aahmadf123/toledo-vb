"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum1, fmtPct, fmtRate, fmtRating } from "@/lib/format";

export interface TrendSeries {
  id: string;
  name: string;
  color: string;
  /** Aligned to the labels array; null = skipped session (no attempts). */
  values: Array<number | null>;
  /** Dashed derived overlay (rolling average) — same hue as its parent. */
  dashed?: boolean;
}

export default function TrendChart({
  labels,
  series,
  fmt = "rate3",
}: {
  labels: string[];
  series: TrendSeries[];
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
    for (const s of series) row[s.id] = s.values[i];
    return row;
  });

  const showLegend = series.length >= 2;

  return (
    <div className="aspect-[2/1] min-h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
          <CartesianGrid stroke="#24395e" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#93a5c4" }}
            tickLine={false}
            axisLine={{ stroke: "#24395e" }}
            interval="preserveStartEnd"
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
            cursor={{ stroke: "#24395e" }}
          />
          {showLegend ? (
            <Legend wrapperStyle={{ fontSize: 12, color: "#93a5c4" }} iconType="plainline" />
          ) : null}
          {series.map((s) => (
            <Line
              key={s.id}
              dataKey={s.id}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "6 4" : undefined}
              dot={{ r: 3, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

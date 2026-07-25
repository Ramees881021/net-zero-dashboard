import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface Scope3WaterfallChartProps {
  baseScope3: number;
  targetReductionPercent: number;
}

export const Scope3WaterfallChart = ({
  baseScope3,
  targetReductionPercent,
}: Scope3WaterfallChartProps) => {
  const targetReduction = baseScope3 * (targetReductionPercent / 100);

  const levers = [
    { name: "Supplier Eng.", percent: 30 },
    { name: "Sustainable Proc.", percent: 20 },
    { name: "Product Design", percent: 15 },
    { name: "Logistics Opt.", percent: 15 },
    { name: "Employee Comm.", percent: 10 },
    { name: "Business Travel", percent: 10 },
  ];

  interface WaterfallItem {
    name: string;
    base: number;
    value: number;
    type: "start" | "reduction" | "end";
  }

  const waterfallData: WaterfallItem[] = [];
  waterfallData.push({ name: "Baseline", base: 0, value: baseScope3, type: "start" });

  let runningTotal = baseScope3;
  levers.forEach((lever) => {
    const reduction = targetReduction * (lever.percent / 100);
    const newTotal = runningTotal - reduction;
    waterfallData.push({ name: lever.name, base: newTotal, value: reduction, type: "reduction" });
    runningTotal = newTotal;
  });

  waterfallData.push({ name: "Target", base: 0, value: baseScope3 - targetReduction, type: "end" });

  const getBarColor = (type: string) => {
    if (type === "start") return "hsl(var(--chart-1))";
    if (type === "reduction") return "hsl(var(--destructive))";
    return "hsl(var(--muted-foreground))";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scope 3 Reduction Levers</CardTitle>
        <CardDescription>
          Waterfall breakdown of {targetReductionPercent}% reduction target (
          {(targetReduction / 1000).toFixed(0)}k tCO₂e)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={waterfallData} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                height={50}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                domain={[0, "auto"]}
              />
              <Tooltip
                formatter={(value: number, name: string, props: unknown) => {
                  if (name === "base") return null;
                  const payload = props as { payload: WaterfallItem };
                  const item = payload.payload;
                  if (item.type === "reduction") {
                    return [`-${value.toLocaleString()} tCO₂e`, "Reduction"];
                  }
                  return [`${value.toLocaleString()} tCO₂e`, "Emissions"];
                }}
              />
              <Bar dataKey="base" stackId="waterfall" fill="transparent" />
              <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.type)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex justify-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm bg-chart-1" />
            <span className="text-muted-foreground">Baseline</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm bg-destructive" />
            <span className="text-muted-foreground">Reduction</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-sm bg-muted-foreground" />
            <span className="text-muted-foreground">Target</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

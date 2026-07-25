import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';

interface PathwayDataPoint {
  year: number;
  'Scope 1 Target': number;
  'Scope 2 Target': number;
  'Scope 1 Actual': number | null;
  'Scope 2 Actual': number | null;
}

interface Scope12PathwayChartProps {
  data: PathwayDataPoint[];
  nearTermYear: number;
  baseYear: number;
  reductionPercent: number;
}

export const Scope12PathwayChart = ({ data, nearTermYear, baseYear, reductionPercent }: Scope12PathwayChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Scope 1 & 2 Near-Term Pathway</CardTitle>
        <CardDescription>
          Target: {reductionPercent}% reduction by {nearTermYear} (SBTi 1.5°C aligned)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString()} tCO₂e`, '']}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Legend />
              <ReferenceLine 
                x={baseYear} 
                stroke="hsl(var(--muted-foreground))" 
                strokeDasharray="3 3" 
                label={{ value: 'Base', position: 'top' }}
              />
              <ReferenceLine 
                x={nearTermYear} 
                stroke="hsl(var(--primary))" 
                strokeDasharray="5 5" 
                label={{ value: 'Target', position: 'top' }}
              />
              <Area 
                type="monotone" 
                dataKey="Scope 1 Target" 
                stackId="target"
                stroke="hsl(var(--chart-1))" 
                fill="hsl(var(--chart-1))" 
                fillOpacity={0.3}
              />
              <Area 
                type="monotone" 
                dataKey="Scope 2 Target" 
                stackId="target"
                stroke="hsl(var(--chart-2))" 
                fill="hsl(var(--chart-2))" 
                fillOpacity={0.3}
              />
              <Area 
                type="monotone" 
                dataKey="Scope 1 Actual" 
                stackId="actual"
                stroke="hsl(var(--chart-1))" 
                fill="hsl(var(--chart-1))" 
                fillOpacity={0.7}
              />
              <Area 
                type="monotone" 
                dataKey="Scope 2 Actual" 
                stackId="actual"
                stroke="hsl(var(--chart-2))" 
                fill="hsl(var(--chart-2))" 
                fillOpacity={0.7}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

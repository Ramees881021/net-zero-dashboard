import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';

interface AnnualReductionDataPoint {
  year: number;
  'Required Reduction': number;
  'Actual Reduction': number | null;
}

interface AnnualReductionChartProps {
  data: AnnualReductionDataPoint[];
  nearTermYear: number;
}

export const AnnualReductionChart = ({ data, nearTermYear }: AnnualReductionChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Annual Reduction Requirements (Scope 1 & 2)</CardTitle>
        <CardDescription>
          Year-over-year reduction needed to meet near-term targets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${v.toLocaleString()}`} />
              <Tooltip 
                formatter={(value: number) => [`${value.toLocaleString()} tCO₂e`, '']}
              />
              <Legend />
              <Bar 
                dataKey="Required Reduction" 
                fill="#b388ff" 
              />
              <Bar 
                dataKey="Actual Reduction" 
                fill="#4caf50" 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

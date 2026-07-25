import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface EmissionsData {
  reporting_year: number;
  scope3_breakdown: Record<string, { value: number; status: string }> | null;
}

const SCOPE3_CATEGORIES: Record<string, string> = {
  cat1: 'Purchased Goods',
  cat2: 'Capital Goods',
  cat3: 'Fuel & Energy',
  cat4: 'Upstream Transport',
  cat5: 'Waste',
  cat6: 'Business Travel',
  cat7: 'Employee Commuting',
  cat8: 'Upstream Leased',
  cat9: 'Downstream Transport',
  cat10: 'Processing of Sold',
  cat11: 'Use of Sold',
  cat12: 'End-of-Life',
  cat13: 'Downstream Leased',
  cat14: 'Franchises',
  cat15: 'Investments',
};

const SHORT_LABELS: Record<string, string> = {
  cat1: 'Cat 1',
  cat2: 'Cat 2',
  cat3: 'Cat 3',
  cat4: 'Cat 4',
  cat5: 'Cat 5',
  cat6: 'Cat 6',
  cat7: 'Cat 7',
  cat8: 'Cat 8',
  cat9: 'Cat 9',
  cat10: 'Cat 10',
  cat11: 'Cat 11',
  cat12: 'Cat 12',
  cat13: 'Cat 13',
  cat14: 'Cat 14',
  cat15: 'Cat 15',
};

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(210, 70%, 50%)',
  'hsl(30, 70%, 50%)',
  'hsl(300, 50%, 50%)',
  'hsl(160, 60%, 40%)',
  'hsl(0, 60%, 50%)',
  'hsl(45, 80%, 45%)',
  'hsl(270, 50%, 55%)',
  'hsl(180, 50%, 40%)',
  'hsl(120, 40%, 45%)',
  'hsl(350, 60%, 55%)',
];

interface Props {
  emissions: EmissionsData[];
  selectedYear: number;
}

export const Scope3InsightsCharts = ({ emissions, selectedYear }: Props) => {
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

  const handleLegendClick = useCallback((dataKey: string) => {
    setHiddenCategories(prev => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  // Parse breakdown data from all years
  const parseBreakdown = (bd: any): Record<string, { value: number; status: string }> => {
    if (!bd || typeof bd !== 'object') return {};
    const result: Record<string, { value: number; status: string }> = {};
    for (const [key, val] of Object.entries(bd)) {
      if (val && typeof val === 'object' && 'value' in (val as any)) {
        const v = val as any;
        result[key] = { value: Number(v.value) || 0, status: v.status || 'calculated' };
      }
    }
    return result;
  };

  // Find all active categories (calculated with value > 0 in at least one year)
  const activeCategories = new Set<string>();
  emissions.forEach(e => {
    const bd = parseBreakdown(e.scope3_breakdown);
    Object.entries(bd).forEach(([key, { value, status }]) => {
      if (status === 'calculated' && value > 0) activeCategories.add(key);
    });
  });

  // Sort categories by descending total value across all years
  const categoryTotals = new Map<string, number>();
  emissions.forEach(e => {
    const bd = parseBreakdown(e.scope3_breakdown);
    Object.entries(bd).forEach(([key, { value, status }]) => {
      if (status === 'calculated' && value > 0) {
        categoryTotals.set(key, (categoryTotals.get(key) || 0) + value);
      }
    });
  });

  const sortedCategories = Array.from(activeCategories).sort((a, b) => {
    return (categoryTotals.get(b) || 0) - (categoryTotals.get(a) || 0);
  });

  if (sortedCategories.length === 0) return null;

  const visibleCategories = sortedCategories.filter(cat => !hiddenCategories.has(SCOPE3_CATEGORIES[cat] || cat));

  // Yearly stacked bar data
  const stackedData = emissions
    .filter(e => e.scope3_breakdown)
    .sort((a, b) => a.reporting_year - b.reporting_year)
    .map(e => {
      const bd = parseBreakdown(e.scope3_breakdown);
      const row: Record<string, any> = { year: e.reporting_year };
      sortedCategories.forEach(cat => {
        row[SCOPE3_CATEGORIES[cat] || cat] = bd[cat]?.status === 'calculated' ? (bd[cat]?.value || 0) : 0;
      });
      return row;
    });

  // Individual category trend data
  const trendData = emissions
    .filter(e => e.scope3_breakdown)
    .sort((a, b) => a.reporting_year - b.reporting_year)
    .map(e => {
      const bd = parseBreakdown(e.scope3_breakdown);
      const row: Record<string, any> = { year: e.reporting_year };
      sortedCategories.forEach(cat => {
        row[SCOPE3_CATEGORIES[cat] || cat] = bd[cat]?.status === 'calculated' ? (bd[cat]?.value || 0) : null;
      });
      return row;
    });

  // Movement summary: compare latest vs earliest for each category
  const movementSummary = sortedCategories.map(cat => {
    const name = SCOPE3_CATEGORIES[cat] || cat;
    const shortLabel = SHORT_LABELS[cat] || cat;
    const yearlyValues = emissions
      .filter(e => e.scope3_breakdown)
      .sort((a, b) => a.reporting_year - b.reporting_year)
      .map(e => {
        const bd = parseBreakdown(e.scope3_breakdown);
        return { year: e.reporting_year, value: bd[cat]?.status === 'calculated' ? (bd[cat]?.value || 0) : null };
      })
      .filter(v => v.value !== null && v.value > 0);

    if (yearlyValues.length < 2) {
      return { cat, name, shortLabel, change: null, direction: 'stable' as const, first: yearlyValues[0]?.value || 0, last: yearlyValues[yearlyValues.length - 1]?.value || 0 };
    }

    const first = yearlyValues[0].value!;
    const last = yearlyValues[yearlyValues.length - 1].value!;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    const direction = change < -1 ? 'reducing' as const : change > 1 ? 'increasing' as const : 'stable' as const;

    return { cat, name, shortLabel, change, direction, first, last };
  });

  return (
    <div className="space-y-6">
      {/* Yearly Scope 3 Sub-Category Stacked Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Scope 3 Sub-Category Breakdown by Year</CardTitle>
          <CardDescription>Yearly distribution of emissions across active Scope 3 categories (tCO₂e)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stackedData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} tCO₂e`} />
                <Legend
                  onClick={(e: any) => handleLegendClick(e.dataKey)}
                  wrapperStyle={{ fontSize: '11px', cursor: 'pointer' }}
                  formatter={(value: string) => (
                    <span style={{ opacity: hiddenCategories.has(value) ? 0.3 : 1 }}>{value}</span>
                  )}
                />
                {sortedCategories.map((cat, i) => (
                  <Bar
                    key={cat}
                    dataKey={SCOPE3_CATEGORIES[cat] || cat}
                    stackId="scope3"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    hide={hiddenCategories.has(SCOPE3_CATEGORIES[cat] || cat)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category Trend Lines */}
      {sortedCategories.length > 1 && trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Individual Category Trends</CardTitle>
            <CardDescription>Year-over-year movement for each active Scope 3 category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `${value?.toLocaleString()} tCO₂e`} />
                  <Legend
                    onClick={(e: any) => handleLegendClick(e.dataKey)}
                    wrapperStyle={{ fontSize: '11px', cursor: 'pointer' }}
                    formatter={(value: string) => (
                      <span style={{ opacity: hiddenCategories.has(value) ? 0.3 : 1 }}>{value}</span>
                    )}
                  />
                  {sortedCategories.map((cat, i) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={SCOPE3_CATEGORIES[cat] || cat}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls={false}
                      hide={hiddenCategories.has(SCOPE3_CATEGORIES[cat] || cat)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement Summary Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Category Movement Summary</CardTitle>
          <CardDescription>Overall direction of each Scope 3 sub-category across all reporting years</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {movementSummary.map(({ cat, name, change, direction, first, last }) => (
              <div
                key={cat}
                className={`flex items-center gap-3 p-3 rounded-lg border ${
                  direction === 'reducing'
                    ? 'border-green-500/30 bg-green-500/5'
                    : direction === 'increasing'
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-muted bg-muted/20'
                }`}
              >
                {direction === 'reducing' ? (
                  <TrendingDown className="h-5 w-5 text-green-600 shrink-0" />
                ) : direction === 'increasing' ? (
                  <TrendingUp className="h-5 w-5 text-red-600 shrink-0" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {change !== null
                      ? `${change > 0 ? '+' : ''}${change.toFixed(1)}% (${first.toLocaleString()} → ${last.toLocaleString()})`
                      : 'Insufficient data'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

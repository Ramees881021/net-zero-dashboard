import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Treemap,
} from 'recharts';
import { Loader2, TrendingDown, TrendingUp, Minus, BarChart3 } from 'lucide-react';

interface YearData {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  categories: Record<string, number>;
}

const SCOPE_COLORS = {
  scope1: 'hsl(158, 100%, 41%)',
  scope2: 'hsl(199, 89%, 48%)',
  scope3: 'hsl(262, 83%, 58%)',
};

const CATEGORY_COLORS = [
  'hsl(262, 83%, 58%)', 'hsl(280, 70%, 50%)', 'hsl(320, 65%, 50%)',
  'hsl(340, 70%, 55%)', 'hsl(10, 75%, 55%)', 'hsl(30, 80%, 50%)',
  'hsl(50, 85%, 45%)', 'hsl(80, 60%, 45%)', 'hsl(120, 50%, 45%)',
  'hsl(160, 60%, 40%)', 'hsl(190, 70%, 45%)', 'hsl(210, 75%, 50%)',
  'hsl(230, 65%, 55%)', 'hsl(250, 60%, 55%)', 'hsl(270, 55%, 50%)',
];

export const CarbonDashboardTab = () => {
  const { user } = useAuth();
  const { selectedYear } = useDashboard();
  const [loading, setLoading] = useState(true);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await supabase
        .from('carbon_calc_entries')
        .select('scope, category, amount_tco2e, reporting_year, site_id')
        .eq('user_id', user.id)
        .order('reporting_year', { ascending: true });
      setAllEntries(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const yearlyData = useMemo<YearData[]>(() => {
    const map = new Map<number, YearData>();
    allEntries.forEach((e) => {
      const y = e.reporting_year;
      if (!map.has(y)) map.set(y, { year: y, scope1: 0, scope2: 0, scope3: 0, total: 0, categories: {} });
      const yd = map.get(y)!;
      const val = Number(e.amount_tco2e) || 0;
      if (e.scope === 1) yd.scope1 += val;
      else if (e.scope === 2) yd.scope2 += val;
      else if (e.scope === 3) {
        yd.scope3 += val;
        yd.categories[e.category] = (yd.categories[e.category] || 0) + val;
      }
      yd.total += val;
    });
    return Array.from(map.values()).sort((a, b) => a.year - b.year);
  }, [allEntries]);

  const currentYearData = yearlyData.find(d => d.year === selectedYear);
  const prevYearData = yearlyData.find(d => d.year === selectedYear - 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (yearlyData.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <h3 className="text-lg font-semibold mb-1">No Emissions Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Add emissions data in the Carbon Calculator to see your dashboard with KPIs, trends, and breakdowns across all reporting years.
          </p>
        </CardContent>
      </Card>
    );
  }

  const yoyChange = currentYearData && prevYearData && prevYearData.total > 0
    ? ((currentYearData.total - prevYearData.total) / prevYearData.total) * 100
    : null;

  // Scope 3 breakdown for current year
  const scope3Breakdown = currentYearData
    ? SCOPE3_CATEGORIES
        .map((cat, i) => ({
          name: cat.label.split('. ')[1] || cat.label,
          code: cat.code,
          value: currentYearData.categories[cat.code] || 0,
          color: CATEGORY_COLORS[i],
        }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  // Scope split pie for current year
  const scopePie = currentYearData
    ? [
        { name: 'Scope 1', value: currentYearData.scope1, color: SCOPE_COLORS.scope1 },
        { name: 'Scope 2', value: currentYearData.scope2, color: SCOPE_COLORS.scope2 },
        { name: 'Scope 3', value: currentYearData.scope3, color: SCOPE_COLORS.scope3 },
      ].filter(d => d.value > 0)
    : [];

  // Treemap data for scope 3
  const treemapData = scope3Breakdown.map(d => ({
    name: d.name,
    size: d.value,
    fill: d.color,
  }));

  // Intensity change per scope (YoY)
  const scopeChanges = currentYearData && prevYearData ? [
    { scope: 'Scope 1', current: currentYearData.scope1, previous: prevYearData.scope1 },
    { scope: 'Scope 2', current: currentYearData.scope2, previous: prevYearData.scope2 },
    { scope: 'Scope 3', current: currentYearData.scope3, previous: prevYearData.scope3 },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Carbon Dashboard</h1>
        <span className="text-sm text-muted-foreground ml-2">— Reporting Year {selectedYear}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Emissions"
          value={currentYearData?.total ?? 0}
          unit="tCO₂e"
          change={yoyChange}
        />
        <KPICard
          label="Scope 1"
          value={currentYearData?.scope1 ?? 0}
          unit="tCO₂e"
          change={scopeChanges.length > 0 && scopeChanges[0].previous > 0
            ? ((scopeChanges[0].current - scopeChanges[0].previous) / scopeChanges[0].previous) * 100
            : null}
          color={SCOPE_COLORS.scope1}
        />
        <KPICard
          label="Scope 2"
          value={currentYearData?.scope2 ?? 0}
          unit="tCO₂e"
          change={scopeChanges.length > 0 && scopeChanges[1].previous > 0
            ? ((scopeChanges[1].current - scopeChanges[1].previous) / scopeChanges[1].previous) * 100
            : null}
          color={SCOPE_COLORS.scope2}
        />
        <KPICard
          label="Scope 3"
          value={currentYearData?.scope3 ?? 0}
          unit="tCO₂e"
          change={scopeChanges.length > 0 && scopeChanges[2].previous > 0
            ? ((scopeChanges[2].current - scopeChanges[2].previous) / scopeChanges[2].previous) * 100
            : null}
          color={SCOPE_COLORS.scope3}
        />
      </div>

      {/* Year selector chips */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground self-center">Data available for:</span>
        {yearlyData.map(yd => (
          <span
            key={yd.year}
            className={`px-2 py-1 rounded-full border text-xs font-medium ${
              yd.year === selectedYear ? 'bg-primary text-primary-foreground' : 'bg-muted'
            }`}
          >
            {yd.year} — {yd.total.toFixed(1)} tCO₂e
          </span>
        ))}
      </div>

      {/* Row 1: Stacked bar trend + Scope pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Emissions Trend by Scope</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={v => `${v.toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)} tCO₂e`} />
                  <Legend />
                  <Bar dataKey="scope1" stackId="a" fill={SCOPE_COLORS.scope1} name="Scope 1" />
                  <Bar dataKey="scope2" stackId="a" fill={SCOPE_COLORS.scope2} name="Scope 2" />
                  <Bar dataKey="scope3" stackId="a" fill={SCOPE_COLORS.scope3} name="Scope 3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Scope Split — {selectedYear}</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={scopePie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {scopePie.map(e => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)} tCO₂e`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Total trend line + Scope 3 category bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total Emissions Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={v => `${v.toFixed(0)}`} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)} tCO₂e`} />
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--primary))"
                    fill="url(#totalGradient)"
                    strokeWidth={2}
                    name="Total tCO₂e"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {scope3Breakdown.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Scope 3 by Category — {selectedYear}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scope3Breakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={v => `${Number(v).toFixed(1)}`} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(3)} tCO₂e`} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="tCO₂e">
                      {scope3Breakdown.map((d, i) => <Cell key={d.code} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3: Scope 3 Treemap + Multi-year scope lines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {treemapData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Scope 3 Treemap — {selectedYear}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    nameKey="name"
                    stroke="hsl(var(--border))"
                    content={<CustomTreemapContent />}
                  />
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {yearlyData.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Scope Trends Over Time</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={v => `${v.toFixed(0)}`} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2)} tCO₂e`} />
                    <Legend />
                    <Line type="monotone" dataKey="scope1" stroke={SCOPE_COLORS.scope1} strokeWidth={2} name="Scope 1" dot />
                    <Line type="monotone" dataKey="scope2" stroke={SCOPE_COLORS.scope2} strokeWidth={2} name="Scope 2" dot />
                    <Line type="monotone" dataKey="scope3" stroke={SCOPE_COLORS.scope3} strokeWidth={2} name="Scope 3" dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* YoY comparison table */}
      {scopeChanges.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Year-on-Year Comparison ({selectedYear - 1} → {selectedYear})</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scopeChanges.map((sc, i) => {
                const pct = sc.previous > 0 ? ((sc.current - sc.previous) / sc.previous) * 100 : null;
                return (
                  <div key={sc.scope} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{sc.scope}</p>
                      <p className="text-xs text-muted-foreground">
                        {sc.previous.toFixed(2)} → {sc.current.toFixed(2)} tCO₂e
                      </p>
                    </div>
                    {pct !== null && (
                      <div className={`flex items-center gap-1 text-sm font-semibold ${pct < 0 ? 'text-green-500' : pct > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {pct < 0 ? <TrendingDown className="h-4 w-4" /> : pct > 0 ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        {Math.abs(pct).toFixed(1)}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// KPI Card component
const KPICard = ({ label, value, unit, change, color }: {
  label: string;
  value: number;
  unit: string;
  change: number | null;
  color?: string;
}) => (
  <Card>
    <CardContent className="pt-6">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold" style={color ? { color } : undefined}>
        {value.toFixed(2)}
      </p>
      <p className="text-xs text-muted-foreground">{unit}</p>
      {change !== null && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${change < 0 ? 'text-green-500' : change > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
          {change < 0 ? <TrendingDown className="h-3 w-3" /> : change > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          {Math.abs(change).toFixed(1)}% vs prev year
        </div>
      )}
    </CardContent>
  </Card>
);

// Custom treemap content renderer
const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, fill } = props;
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} rx={4} />
      {width > 60 && height > 30 && (
        <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={Math.min(11, width / 10)} fontWeight={600}>
          {name.length > 20 ? name.slice(0, 18) + '…' : name}
        </text>
      )}
    </g>
  );
};

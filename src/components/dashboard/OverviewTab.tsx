import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Factory, Zap, Globe, DollarSign, Target, ArrowDown, ArrowUp, Minus, Truck } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, LineChart, Line, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { Scope3InsightsCharts } from './overview/Scope3InsightsCharts';
import { SBTiAdherenceCard } from './overview/SBTiAdherenceCard';

interface EmissionsData {
  id: string;
  reporting_year: number;
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
  revenue: number | null;
  scope3_breakdown: any;
}

export const OverviewTab = () => {
  const { user } = useAuth();
  const { selectedYear, currencySymbol, baseYear } = useDashboard();
  const [emissions, setEmissions] = useState<EmissionsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmissions = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user.id)
        .order('reporting_year', { ascending: true });

      if (data) {
        setEmissions(data);
      }
      setLoading(false);
    };

    fetchEmissions();
  }, [user]);

  const currentData = emissions.find(e => e.reporting_year === selectedYear);
  const previousData = emissions.find(e => e.reporting_year === selectedYear - 1);
  const baseYearData = baseYear ? emissions.find(e => e.reporting_year === baseYear) : null;

  const totalEmissions = (currentData?.scope_1_emissions || 0) + 
                         (currentData?.scope_2_emissions || 0) + 
                         (currentData?.scope_3_emissions || 0);

  const previousTotal = previousData 
    ? (previousData.scope_1_emissions || 0) + (previousData.scope_2_emissions || 0) + (previousData.scope_3_emissions || 0)
    : 0;

  const baseYearTotal = baseYearData
    ? (baseYearData.scope_1_emissions || 0) + (baseYearData.scope_2_emissions || 0) + (baseYearData.scope_3_emissions || 0)
    : 0;

  const yoyChange = previousTotal > 0 ? ((totalEmissions - previousTotal) / previousTotal * 100) : 0;

  // Base year reduction calculations
  const baseYearReduction = baseYearTotal > 0 && baseYear && selectedYear !== baseYear
    ? ((baseYearTotal - totalEmissions) / baseYearTotal * 100)
    : null;

  // Current intensity
  const currentIntensity = currentData?.revenue && currentData.revenue > 0 
    ? (totalEmissions / (currentData.revenue / 1000000))
    : 0;

  // Base year intensity
  const baseYearIntensity = baseYearData?.revenue && baseYearData.revenue > 0
    ? (baseYearTotal / (baseYearData.revenue / 1000000))
    : 0;

  const intensityReduction = baseYearIntensity > 0 && baseYear && selectedYear !== baseYear
    ? ((baseYearIntensity - currentIntensity) / baseYearIntensity * 100)
    : null;

  const chartData = emissions.map(e => {
    const total = (e.scope_1_emissions || 0) + (e.scope_2_emissions || 0) + (e.scope_3_emissions || 0);
    const intensity = e.revenue && e.revenue > 0 ? (total / (e.revenue / 1000000)) : 0;
    return {
      year: e.reporting_year,
      'Scope 1': e.scope_1_emissions || 0,
      'Scope 2': e.scope_2_emissions || 0,
      'Scope 3': e.scope_3_emissions || 0,
      Total: total,
      Intensity: parseFloat(intensity.toFixed(2)),
    };
  });

  // Reduction tracking chart data (vs base year)
  const reductionChartData = baseYear ? emissions
    .filter(e => e.reporting_year >= baseYear)
    .map(e => {
      const total = (e.scope_1_emissions || 0) + (e.scope_2_emissions || 0) + (e.scope_3_emissions || 0);
      const intensity = e.revenue && e.revenue > 0 ? (total / (e.revenue / 1000000)) : 0;
      const emissionsReduction = baseYearTotal > 0 ? ((baseYearTotal - total) / baseYearTotal * 100) : 0;
      const intensityRed = baseYearIntensity > 0 ? ((baseYearIntensity - intensity) / baseYearIntensity * 100) : 0;
      return {
        year: e.reporting_year,
        'Emissions Reduction (%)': parseFloat(emissionsReduction.toFixed(1)),
        'Intensity Reduction (%)': parseFloat(intensityRed.toFixed(1)),
      };
    }) : [];

  const KpiCard = ({ title, value, unit, icon: Icon, trend, subtitle }: { 
    title: string; 
    value: string; 
    unit: string; 
    icon: React.ElementType;
    trend?: number;
    subtitle?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{unit}</span>
          {trend !== undefined && (
            <span className={`flex items-center text-xs ${trend < 0 ? 'text-green-600' : trend > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {trend < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <Minus className="h-3 w-3 mr-1" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {subtitle && <div className="text-xs text-muted-foreground mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );

  const ReductionCard = ({ title, value, isPositive, baseYearLabel }: {
    title: string;
    value: number | null;
    isPositive: boolean;
    baseYearLabel: string;
  }) => (
    <Card className={value !== null ? (isPositive ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <CardDescription className="text-xs">vs {baseYearLabel} base year</CardDescription>
      </CardHeader>
      <CardContent>
        {value !== null ? (
          <div className="flex items-center gap-2">
            {isPositive ? (
              <ArrowDown className="h-6 w-6 text-green-600" />
            ) : (
              <ArrowUp className="h-6 w-6 text-red-600" />
            )}
            <span className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {Math.abs(value).toFixed(1)}%
            </span>
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            {baseYear ? 'No data for selected year' : 'Set a base year to track'}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-lg" />
        ))}
      </div>
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground">Your sustainability performance at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          title="Total Emissions"
          value={totalEmissions.toLocaleString()}
          unit="tCO₂e"
          icon={Globe}
          trend={yoyChange}
          subtitle="YoY change"
        />
        <KpiCard
          title="Scope 1"
          value={(currentData?.scope_1_emissions || 0).toLocaleString()}
          unit="tCO₂e"
          icon={Factory}
        />
        <KpiCard
          title="Scope 2"
          value={(currentData?.scope_2_emissions || 0).toLocaleString()}
          unit="tCO₂e"
          icon={Zap}
        />
        <KpiCard
          title="Scope 3"
          value={(currentData?.scope_3_emissions || 0).toLocaleString()}
          unit="tCO₂e"
          icon={Truck}
        />
        <KpiCard
          title="Carbon Intensity"
          value={currentIntensity.toFixed(2)}
          unit={`tCO₂e/M${currencySymbol}`}
          icon={DollarSign}
        />
      </div>

      {/* Scope Distribution Doughnut Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Emissions by Scope</CardTitle>
          <CardDescription>Scope 1, 2 & 3 distribution for {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Scope 1', value: currentData?.scope_1_emissions || 0 },
                    { name: 'Scope 2', value: currentData?.scope_2_emissions || 0 },
                    { name: 'Scope 3', value: currentData?.scope_3_emissions || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                  labelLine={true}
                >
                  <Cell fill="hsl(var(--chart-1))" />
                  <Cell fill="hsl(var(--chart-2))" />
                  <Cell fill="hsl(var(--chart-3))" />
                </Pie>
                <Tooltip formatter={(value: number) => `${value.toLocaleString()} tCO₂e`} />
                <Legend />
                {/* Center label */}
                <text
                  x="50%"
                  y="46%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  Total
                </text>
                <text
                  x="50%"
                  y="54%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground"
                  style={{ fontSize: '20px', fontWeight: 700 }}
                >
                  {totalEmissions.toLocaleString()}
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Base Year Reduction Tracking */}
      {baseYear && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReductionCard
            title="Emissions Reduction"
            value={baseYearReduction}
            isPositive={baseYearReduction !== null && baseYearReduction > 0}
            baseYearLabel={baseYear.toString()}
          />
          <ReductionCard
            title="Intensity Reduction"
            value={intensityReduction}
            isPositive={intensityReduction !== null && intensityReduction > 0}
            baseYearLabel={baseYear.toString()}
          />
        </div>
      )}

      {!baseYear && (
        <Card className="border-dashed border-2">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                Set a <strong>Base Year</strong> in the sidebar to track emission and intensity reductions over time
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Emissions Trend</CardTitle>
            <CardDescription>Total emissions over time (tCO₂e)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  {baseYear && (
                    <ReferenceLine x={baseYear} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: 'Base', position: 'top' }} />
                  )}
                  <Area 
                    type="monotone" 
                    dataKey="Total" 
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary))" 
                    fillOpacity={0.3} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Intensity Trend</CardTitle>
            <CardDescription>Carbon intensity over time (tCO₂e/M{currencySymbol})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(2)} tCO₂e/M${currencySymbol}`, 'Intensity']} />
                  {baseYear && (
                    <ReferenceLine x={baseYear} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: 'Base', position: 'top' }} />
                  )}
                  <Line 
                    type="monotone" 
                    dataKey="Intensity" 
                    stroke="hsl(var(--chart-4))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-4))', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Emissions by Scope</CardTitle>
            <CardDescription>Breakdown by scope over time (tCO₂e)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {baseYear && (
                    <ReferenceLine x={baseYear} stroke="hsl(var(--primary))" strokeDasharray="5 5" />
                  )}
                  <Bar dataKey="Scope 1" stackId="a" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="Scope 2" stackId="a" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="Scope 3" stackId="a" fill="hsl(var(--chart-3))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reduction Progress Chart (only if base year is set and has data) */}
      {baseYear && reductionChartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Reduction Progress vs {baseYear} Base Year</CardTitle>
            <CardDescription>
              Tracking both absolute emissions reduction and intensity reduction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={reductionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value: number) => `${value}%`} />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Line 
                    type="monotone" 
                    dataKey="Emissions Reduction (%)" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Intensity Reduction (%)" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--chart-2))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scope 3 Sub-Category Insights */}
      <Scope3InsightsCharts emissions={emissions} selectedYear={selectedYear} />

      {/* SBTi / Net-Zero Pathway Adherence */}
      <SBTiAdherenceCard />
    </div>
  );
};

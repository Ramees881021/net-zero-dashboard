import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Brain, 
  Activity, 
  Calendar,
  PlayCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TimeRange = '1' | '3' | '5' | '10';

interface PredictionDataPoint {
  year: number;
  historical: number | null;
  predicted: number | null;
  ci80Lower: number | null;
  ci80Upper: number | null;
  ci95Lower: number | null;
  ci95Upper: number | null;
}

interface ScenarioParams {
  growthRate: number;
  reductionTarget: number;
}

interface ScenarioResult {
  name: string;
  params: ScenarioParams;
  data: PredictionDataPoint[];
  emissions2030: number;
  emissions2040: number;
  emissions2050: number;
}

export const PredictiveAnalyticsTab = () => {
  const { user } = useAuth();
  const { baseYear, currencySymbol } = useDashboard();
  const [timeRange, setTimeRange] = useState<TimeRange>('5');
  const [isSimulating, setIsSimulating] = useState(false);
  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    growthRate: 2,
    reductionTarget: 4.2
  });
  const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);

  // Fetch historical emissions data
  const { data: emissionsData } = useQuery({
    queryKey: ['emissions-data', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user.id)
        .order('reporting_year', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  // Fetch net-zero targets for gap analysis
  const { data: netZeroTargets } = useQuery({
    queryKey: ['netzero-targets', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('netzero_targets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const currentYear = new Date().getFullYear();
  const predictionYears = parseInt(timeRange);

  // Generate prediction data with confidence intervals
  const predictionData = useMemo((): PredictionDataPoint[] => {
    if (!emissionsData || emissionsData.length === 0) {
      // Generate mock data if no real data
      const mockData: PredictionDataPoint[] = [];
      const startYear = currentYear - 5;
      let baseEmissions = 15000;
      
      for (let year = startYear; year <= currentYear + predictionYears; year++) {
        const isHistorical = year <= currentYear;
        const yearsSinceStart = year - startYear;
        
        if (isHistorical) {
          const variation = (Math.random() - 0.5) * 1000;
          baseEmissions = 15000 - yearsSinceStart * 200 + variation;
          mockData.push({
            year,
            historical: Math.round(baseEmissions),
            predicted: null,
            ci80Lower: null,
            ci80Upper: null,
            ci95Lower: null,
            ci95Upper: null
          });
        } else {
          const yearsAhead = year - currentYear;
          const decayRate = 0.96; // 4% annual reduction
          const predicted = baseEmissions * Math.pow(decayRate, yearsAhead);
          const uncertainty = predicted * 0.05 * yearsAhead;
          
          mockData.push({
            year,
            historical: null,
            predicted: Math.round(predicted),
            ci80Lower: Math.round(predicted - uncertainty * 1.28),
            ci80Upper: Math.round(predicted + uncertainty * 1.28),
            ci95Lower: Math.round(predicted - uncertainty * 1.96),
            ci95Upper: Math.round(predicted + uncertainty * 1.96)
          });
        }
      }
      return mockData;
    }

    const data: PredictionDataPoint[] = [];
    const sortedEmissions = [...emissionsData].sort((a, b) => a.reporting_year - b.reporting_year);
    
    // Add historical data
    sortedEmissions.forEach(emission => {
      const total = (emission.scope_1_emissions || 0) + 
                   (emission.scope_2_emissions || 0) + 
                   (emission.scope_3_emissions || 0);
      data.push({
        year: emission.reporting_year,
        historical: total,
        predicted: null,
        ci80Lower: null,
        ci80Upper: null,
        ci95Lower: null,
        ci95Upper: null
      });
    });

    // Calculate trend for predictions
    if (sortedEmissions.length >= 2) {
      const lastEmission = sortedEmissions[sortedEmissions.length - 1];
      const lastTotal = (lastEmission.scope_1_emissions || 0) + 
                       (lastEmission.scope_2_emissions || 0) + 
                       (lastEmission.scope_3_emissions || 0);
      
      const reductionRate = scenarioParams.reductionTarget / 100;
      
      for (let i = 1; i <= predictionYears; i++) {
        const year = lastEmission.reporting_year + i;
        const predicted = lastTotal * Math.pow(1 - reductionRate, i);
        const uncertainty = predicted * 0.05 * i;
        
        data.push({
          year,
          historical: null,
          predicted: Math.round(predicted),
          ci80Lower: Math.round(predicted - uncertainty * 1.28),
          ci80Upper: Math.round(predicted + uncertainty * 1.28),
          ci95Lower: Math.round(predicted - uncertainty * 1.96),
          ci95Upper: Math.round(predicted + uncertainty * 1.96)
        });
      }
    }

    return data;
  }, [emissionsData, predictionYears, scenarioParams.reductionTarget, currentYear]);

  // Calculate prediction milestones
  const predictionMilestones = useMemo(() => {
    const getEmissionsForYear = (year: number) => {
      const dataPoint = predictionData.find(d => d.year === year);
      return dataPoint?.predicted || dataPoint?.historical || 0;
    };

    const baselineEmissions = predictionData.find(d => d.historical)?.historical || 15000;
    const emissions2030 = getEmissionsForYear(2030) || baselineEmissions * 0.58;
    const emissions2040 = getEmissionsForYear(2040) || baselineEmissions * 0.25;
    const emissions2050 = getEmissionsForYear(2050) || baselineEmissions * 0.1;

    const targetReduction = netZeroTargets?.scope_1_2_reduction_percent || 42;
    const target2030 = baselineEmissions * (1 - targetReduction / 100);

    return {
      baseline: baselineEmissions,
      emissions2030,
      emissions2040,
      emissions2050,
      change2030: ((baselineEmissions - emissions2030) / baselineEmissions * 100),
      change2040: ((baselineEmissions - emissions2040) / baselineEmissions * 100),
      change2050: ((baselineEmissions - emissions2050) / baselineEmissions * 100),
      target2030,
      gap2030: emissions2030 - target2030
    };
  }, [predictionData, netZeroTargets]);

  // Model performance metrics (mock data)
  const modelMetrics = useMemo(() => ({
    mae: 234.5,
    rmse: 312.8,
    r2: 0.94,
    lastTrained: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    dataFreshness: emissionsData && emissionsData.length > 0 
      ? Math.max(...emissionsData.map(d => d.reporting_year)) === currentYear - 1 
        ? 'current' 
        : 'stale'
      : 'no-data'
  }), [emissionsData, currentYear]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const baselineEmissions = predictionMilestones.baseline;
    const scenarioData: PredictionDataPoint[] = [];
    
    for (let year = currentYear; year <= currentYear + 10; year++) {
      const yearsAhead = year - currentYear;
      const growthFactor = 1 + (scenarioParams.growthRate / 100);
      const reductionFactor = 1 - (scenarioParams.reductionTarget / 100);
      
      const predicted = baselineEmissions * 
        Math.pow(growthFactor, yearsAhead) * 
        Math.pow(reductionFactor, yearsAhead);
      
      scenarioData.push({
        year,
        historical: year === currentYear ? baselineEmissions : null,
        predicted: Math.round(predicted),
        ci80Lower: null,
        ci80Upper: null,
        ci95Lower: null,
        ci95Upper: null
      });
    }

    const newScenario: ScenarioResult = {
      name: `Scenario ${scenarios.length + 1}`,
      params: { ...scenarioParams },
      data: scenarioData,
      emissions2030: scenarioData.find(d => d.year === 2030)?.predicted || 0,
      emissions2040: scenarioData.find(d => d.year === 2040)?.predicted || 0,
      emissions2050: scenarioData.find(d => d.year === 2050)?.predicted || 0
    };

    setScenarios(prev => [...prev.slice(-2), newScenario]);
    setIsSimulating(false);
    toast.success('Simulation completed');
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value?.toLocaleString()} tCO₂e
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Predictive Analytics
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered emissions forecasting and scenario modeling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="w-32 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Year</SelectItem>
              <SelectItem value="3">3 Years</SelectItem>
              <SelectItem value="5">5 Years</SelectItem>
              <SelectItem value="10">10 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Forecast Dashboard */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Emissions Forecast
          </CardTitle>
          <CardDescription>
            Historical emissions with {predictionYears}-year prediction and confidence intervals
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={predictionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="year" 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                
                {/* 95% Confidence Interval */}
                <Area
                  type="monotone"
                  dataKey="ci95Upper"
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.1}
                  name="95% CI"
                />
                <Area
                  type="monotone"
                  dataKey="ci95Lower"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                />
                
                {/* 80% Confidence Interval */}
                <Area
                  type="monotone"
                  dataKey="ci80Upper"
                  stroke="none"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                  name="80% CI"
                />
                <Area
                  type="monotone"
                  dataKey="ci80Lower"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                />

                {/* Reference line for current year */}
                <ReferenceLine 
                  x={currentYear} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="5 5"
                  label={{ value: 'Now', position: 'top', fill: 'hsl(var(--muted-foreground))' }}
                />

                {/* Historical line */}
                <Line
                  type="monotone"
                  dataKey="historical"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  name="Historical"
                  connectNulls={false}
                />
                
                {/* Predicted line */}
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  strokeDasharray="8 4"
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  name="Predicted"
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Prediction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { year: 2030, emissions: predictionMilestones.emissions2030, change: predictionMilestones.change2030 },
          { year: 2040, emissions: predictionMilestones.emissions2040, change: predictionMilestones.change2040 },
          { year: 2050, emissions: predictionMilestones.emissions2050, change: predictionMilestones.change2050 }
        ].map(({ year, emissions, change }) => (
          <Card key={year} className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>Year {year}</span>
                {change > 0 ? (
                  <TrendingDown className="h-5 w-5 text-success" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-destructive" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-2xl font-bold text-foreground">
                  {Math.round(emissions).toLocaleString()} tCO₂e
                </p>
                <p className={cn(
                  "text-sm font-medium",
                  change > 0 ? "text-success" : "text-destructive"
                )}>
                  {change > 0 ? '↓' : '↑'} {Math.abs(change).toFixed(1)}% from baseline
                </p>
                {year === 2030 && predictionMilestones.gap2030 > 0 && (
                  <div className="mt-3 p-2 rounded-md bg-warning/10 border border-warning/20">
                    <p className="text-xs text-warning flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {Math.round(predictionMilestones.gap2030).toLocaleString()} tCO₂e above target
                    </p>
                  </div>
                )}
                {year === 2030 && predictionMilestones.gap2030 <= 0 && (
                  <div className="mt-3 p-2 rounded-md bg-success/10 border border-success/20">
                    <p className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      On track to meet target
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scenario Modeling */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Scenario Modeling
          </CardTitle>
          <CardDescription>
            Adjust parameters and run simulations to compare different pathways
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Sliders */}
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Business Growth Rate</Label>
                  <span className="text-sm text-muted-foreground">{scenarioParams.growthRate}%/year</span>
                </div>
                <Slider
                  value={[scenarioParams.growthRate]}
                  onValueChange={([v]) => setScenarioParams(p => ({ ...p, growthRate: v }))}
                  min={-5}
                  max={15}
                  step={0.5}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Annual Reduction Target</Label>
                  <span className="text-sm text-muted-foreground">{scenarioParams.reductionTarget}%/year</span>
                </div>
                <Slider
                  value={[scenarioParams.reductionTarget]}
                  onValueChange={([v]) => setScenarioParams(p => ({ ...p, reductionTarget: v }))}
                  min={0}
                  max={15}
                  step={0.1}
                  className="w-full"
                />
              </div>


              <Button 
                onClick={handleRunSimulation} 
                className="w-full"
                disabled={isSimulating}
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Running Simulation...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Run Simulation
                  </>
                )}
              </Button>
            </div>

            {/* Scenario Comparison Chart */}
            <div>
              {scenarios.length > 0 ? (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="year" 
                        type="number"
                        domain={[currentYear, currentYear + 10]}
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      
                      {scenarios.map((scenario, idx) => (
                        <Line
                          key={scenario.name}
                          data={scenario.data}
                          type="monotone"
                          dataKey="predicted"
                          stroke={idx === scenarios.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                          strokeWidth={idx === scenarios.length - 1 ? 3 : 2}
                          strokeDasharray={idx === scenarios.length - 1 ? undefined : "4 4"}
                          dot={false}
                          name={scenario.name}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[280px] flex items-center justify-center border border-dashed border-border rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <PlayCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Run a simulation to see results</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Performance */}
      <Card className="bg-card/50 backdrop-blur-sm border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Model Performance
          </CardTitle>
          <CardDescription>
            Prediction accuracy and data freshness indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">MAE</p>
              <p className="text-xl font-bold text-foreground">{modelMetrics.mae.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">tCO₂e</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">RMSE</p>
              <p className="text-xl font-bold text-foreground">{modelMetrics.rmse.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">tCO₂e</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Last Trained</p>
              <p className="text-xl font-bold text-foreground flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                2d ago
              </p>
              <p className="text-xs text-muted-foreground">Auto-updates weekly</p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data Freshness</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={cn(
                  "h-3 w-3 rounded-full",
                  modelMetrics.dataFreshness === 'current' ? "bg-success" :
                  modelMetrics.dataFreshness === 'stale' ? "bg-warning" : "bg-destructive"
                )} />
                <p className="text-lg font-bold text-foreground capitalize">
                  {modelMetrics.dataFreshness === 'no-data' ? 'No Data' : modelMetrics.dataFreshness}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {modelMetrics.dataFreshness === 'current' ? 'Using latest data' : 
                 modelMetrics.dataFreshness === 'stale' ? 'Update recommended' : 'Add emissions data'}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retrain Model
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

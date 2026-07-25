import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { Scope12PathwayChart } from './netzero/Scope12PathwayChart';
import { Scope3WaterfallChart } from './netzero/Scope3WaterfallChart';
import { AnnualReductionChart } from './netzero/AnnualReductionChart';
import { EmissionReductionProjects } from './netzero/EmissionReductionProjects';

interface NetZeroTarget {
  id: string;
  base_year: number;
  near_term_target_year: number;
  netzero_target_year: number;
  scope_1_2_reduction_percent: number;
  scope_3_reduction_percent: number;
}

interface EmissionsData {
  reporting_year: number;
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
}

export const NetZeroTab = () => {
  const { user } = useAuth();
  const { selectedYear } = useDashboard();
  const [target, setTarget] = useState<NetZeroTarget | null>(null);
  const [emissions, setEmissions] = useState<EmissionsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formData, setFormData] = useState({
    base_year: new Date().getFullYear() - 1,
    near_term_target_year: 2030,
    netzero_target_year: 2050,
    scope_1_2_reduction_percent: 46.2,
    scope_3_reduction_percent: 28,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const [targetRes, emissionsRes] = await Promise.all([
        supabase
          .from('netzero_targets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('emissions_data')
          .select('*')
          .eq('user_id', user.id)
          .order('reporting_year', { ascending: true }),
      ]);

      if (targetRes.data) {
        setTarget(targetRes.data);
        setFormData({
          base_year: targetRes.data.base_year,
          near_term_target_year: targetRes.data.near_term_target_year,
          netzero_target_year: targetRes.data.netzero_target_year,
          scope_1_2_reduction_percent: targetRes.data.scope_1_2_reduction_percent,
          scope_3_reduction_percent: targetRes.data.scope_3_reduction_percent,
        });
        setIsDirty(false);
      }
      if (emissionsRes.data) setEmissions(emissionsRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);

    const payload = {
      user_id: user.id,
      base_year: formData.base_year,
      near_term_target_year: formData.near_term_target_year,
      netzero_target_year: formData.netzero_target_year,
      scope_1_2_reduction_percent: formData.scope_1_2_reduction_percent,
      scope_3_reduction_percent: formData.scope_3_reduction_percent,
    };

    let error;
    if (target) {
      ({ error } = await supabase.from('netzero_targets').update(payload).eq('id', target.id));
    } else {
      ({ error } = await supabase.from('netzero_targets').insert(payload));
    }

    if (error) {
      toast.error('Failed to save targets');
    } else {
      toast.success('Net-Zero targets saved');
      setIsDirty(false);
      // Refetch to get the new target ID if created
      const { data } = await supabase.from('netzero_targets').select('*').eq('user_id', user.id).maybeSingle();
      if (data) setTarget(data);
    }
    setSaving(false);
  };

  // Get base year emissions
  const baseEmissions = emissions.find(e => e.reporting_year === formData.base_year);
  const baseScope1 = baseEmissions?.scope_1_emissions || 5000;
  const baseScope2 = baseEmissions?.scope_2_emissions || 3000;
  const baseScope3 = baseEmissions?.scope_3_emissions || 20000;
  const baseTotal = baseScope1 + baseScope2 + baseScope3;
  const baseScope12 = baseScope1 + baseScope2;

  // Generate Scope 1+2 pathway data
  const generateScope12Pathway = () => {
    const data = [];
    const startYear = formData.base_year;
    const nearTermYear = formData.near_term_target_year;
    const yearsToTarget = nearTermYear - startYear;
    
    for (let year = startYear; year <= nearTermYear; year++) {
      const progress = (year - startYear) / yearsToTarget;
      const reduction = progress * (formData.scope_1_2_reduction_percent / 100);
      
      const scope1Target = baseScope1 * (1 - reduction);
      const scope2Target = baseScope2 * (1 - reduction);

      const actual = emissions.find(e => e.reporting_year === year);

      data.push({
        year,
        'Scope 1 Target': Math.round(scope1Target),
        'Scope 2 Target': Math.round(scope2Target),
        'Scope 1 Actual': actual?.scope_1_emissions || null,
        'Scope 2 Actual': actual?.scope_2_emissions || null,
      });
    }
    
    return data;
  };

  // Generate annual reduction requirements
  const generateAnnualReductions = () => {
    const data = [];
    const startYear = formData.base_year;
    const nearTermYear = formData.near_term_target_year;
    const yearsToTarget = nearTermYear - startYear;
    const totalReduction = baseScope12 * (formData.scope_1_2_reduction_percent / 100);
    const annualRequired = totalReduction / yearsToTarget;

    for (let year = startYear + 1; year <= nearTermYear; year++) {
      const prevActual = emissions.find(e => e.reporting_year === year - 1);
      const currActual = emissions.find(e => e.reporting_year === year);
      
      let actualReduction = null;
      if (prevActual && currActual) {
        const prevTotal = (prevActual.scope_1_emissions || 0) + (prevActual.scope_2_emissions || 0);
        const currTotal = (currActual.scope_1_emissions || 0) + (currActual.scope_2_emissions || 0);
        actualReduction = prevTotal - currTotal;
      }

      data.push({
        year,
        'Required Reduction': Math.round(annualRequired),
        'Actual Reduction': actualReduction !== null ? Math.round(actualReduction) : null,
      });
    }
    
    return data;
  };

  // Generate overall decarbonization pathway
  const generateFullPathway = () => {
    const data = [];
    const startYear = formData.base_year;
    const nearTermYear = formData.near_term_target_year;
    const netZeroYear = formData.netzero_target_year;
    
    for (let year = startYear; year <= netZeroYear; year++) {
      let scope12Target = baseScope12;
      let scope3Target = baseScope3;
      
      if (year <= nearTermYear) {
        const progress = (year - startYear) / (nearTermYear - startYear);
        scope12Target = baseScope12 * (1 - progress * (formData.scope_1_2_reduction_percent / 100));
        scope3Target = baseScope3 * (1 - progress * (formData.scope_3_reduction_percent / 100));
      } else {
        const nearTermScope12 = baseScope12 * (1 - formData.scope_1_2_reduction_percent / 100);
        const nearTermScope3 = baseScope3 * (1 - formData.scope_3_reduction_percent / 100);
        const progress = (year - nearTermYear) / (netZeroYear - nearTermYear);
        scope12Target = nearTermScope12 * (1 - progress * 0.95);
        scope3Target = nearTermScope3 * (1 - progress * 0.9);
      }

      const actual = emissions.find(e => e.reporting_year === year);
      const actualTotal = actual 
        ? (actual.scope_1_emissions || 0) + (actual.scope_2_emissions || 0) + (actual.scope_3_emissions || 0)
        : null;

      data.push({
        year,
        'Scope 1+2 Target': Math.max(0, Math.round(scope12Target)),
        'Scope 3 Target': Math.max(0, Math.round(scope3Target)),
        'Actual': actualTotal,
      });
    }
    
    return data;
  };

  const scope12PathwayData = generateScope12Pathway();
  const annualReductionData = generateAnnualReductions();
  const fullPathwayData = generateFullPathway();

  // SBTi alignment check
  const isSbtiAligned = formData.scope_1_2_reduction_percent >= 42 && 
                         formData.scope_3_reduction_percent >= 25 &&
                         formData.near_term_target_year <= 2030;

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Net-Zero Planning</h1>
        <p className="text-muted-foreground">Set and track your decarbonization pathway</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Target Settings */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Reduction Targets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Base Year</Label>
                <Input
                  type="number"
                  value={formData.base_year}
                  onChange={(e) => {
                    setFormData({ ...formData, base_year: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Near-Term Target Year</Label>
                <Input
                  type="number"
                  value={formData.near_term_target_year}
                  onChange={(e) => {
                    setFormData({ ...formData, near_term_target_year: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Net-Zero Target Year</Label>
                <Input
                  type="number"
                  value={formData.netzero_target_year}
                  onChange={(e) => {
                    setFormData({ ...formData, netzero_target_year: parseInt(e.target.value) });
                    setIsDirty(true);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Scope 1+2 Reduction (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.scope_1_2_reduction_percent}
                  onChange={(e) => {
                    setFormData({ ...formData, scope_1_2_reduction_percent: parseFloat(e.target.value) });
                    setIsDirty(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">SBTi 1.5°C: min 42% by 2030</p>
              </div>
              
              <div className="space-y-2">
                <Label>Scope 3 Reduction (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.scope_3_reduction_percent}
                  onChange={(e) => {
                    setFormData({ ...formData, scope_3_reduction_percent: parseFloat(e.target.value) });
                    setIsDirty(true);
                  }}
                />
                <p className="text-xs text-muted-foreground">SBTi: min 25% by 2030</p>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                {isDirty || !target ? 'Save Targets' : 'Edit Targets'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Milestones & SBTi Status */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Key Milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SBTi Alignment Badge */}
            <div className={`flex items-center gap-3 p-4 rounded-lg ${isSbtiAligned ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
              {isSbtiAligned ? (
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              )}
              <div>
                <div className="font-semibold">{isSbtiAligned ? 'SBTi 1.5°C Aligned' : 'Not SBTi Aligned'}</div>
                <div className="text-sm text-muted-foreground">
                  {isSbtiAligned 
                    ? 'Your targets meet Science Based Targets initiative requirements' 
                    : 'Adjust targets to meet SBTi 1.5°C pathway requirements'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Base Year ({formData.base_year})</div>
                <div className="text-2xl font-bold mt-1">{(baseTotal / 1000).toFixed(1)}k</div>
                <div className="text-xs text-muted-foreground">tCO₂e total</div>
              </div>
              
              <div className="p-4 bg-primary/10 rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Scope 1+2 ({formData.near_term_target_year})</div>
                <div className="text-2xl font-bold mt-1 text-primary">
                  -{formData.scope_1_2_reduction_percent}%
                </div>
                <div className="text-xs text-muted-foreground">Near-term reduction</div>
              </div>

              <div className="p-4 bg-orange-500/10 rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Scope 3 ({formData.near_term_target_year})</div>
                <div className="text-2xl font-bold mt-1 text-orange-600">
                  -{formData.scope_3_reduction_percent}%
                </div>
                <div className="text-xs text-muted-foreground">Near-term reduction</div>
              </div>

              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <div className="text-sm text-muted-foreground">Net-Zero ({formData.netzero_target_year})</div>
                <div className="text-2xl font-bold mt-1 text-green-600">~0</div>
                <div className="text-xs text-muted-foreground">tCO₂e target</div>
              </div>
            </div>

            {/* Annual reduction needed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Required Annual Scope 1+2 Reduction</div>
                <div className="text-3xl font-bold text-primary">
                  {Math.round((baseScope12 * formData.scope_1_2_reduction_percent / 100) / (formData.near_term_target_year - formData.base_year)).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">tCO₂e per year until {formData.near_term_target_year}</div>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Required Annual Scope 3 Reduction</div>
                <div className="text-3xl font-bold text-orange-600">
                  {Math.round((baseScope3 * formData.scope_3_reduction_percent / 100) / (formData.near_term_target_year - formData.base_year)).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">tCO₂e per year until {formData.near_term_target_year}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scope 1+2 Near-Term Pathway */}
      <Scope12PathwayChart 
        data={scope12PathwayData}
        nearTermYear={formData.near_term_target_year}
        baseYear={formData.base_year}
        reductionPercent={formData.scope_1_2_reduction_percent}
      />

      {/* Annual Reduction Chart */}
      <AnnualReductionChart 
        data={annualReductionData}
        nearTermYear={formData.near_term_target_year}
      />

      {/* Scope 3 Waterfall */}
      <Scope3WaterfallChart 
        baseScope3={baseScope3}
        targetReductionPercent={formData.scope_3_reduction_percent}
      />

      {/* Full Decarbonization Pathway */}
      <Card>
        <CardHeader>
          <CardTitle>Full Decarbonization Pathway</CardTitle>
          <CardDescription>
            Combined Scope 1, 2, and 3 trajectory to Net-Zero by {formData.netzero_target_year}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fullPathwayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toLocaleString()} tCO₂e`, '']}
                />
                <Legend />
                <ReferenceLine 
                  x={formData.near_term_target_year} 
                  stroke="hsl(var(--primary))" 
                  strokeDasharray="5 5" 
                  label={{ value: 'Near-term', position: 'top' }}
                />
                <ReferenceLine 
                  x={formData.netzero_target_year} 
                  stroke="hsl(var(--chart-1))" 
                  strokeDasharray="5 5" 
                  label={{ value: 'Net-Zero', position: 'top' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Scope 1+2 Target" 
                  stackId="target"
                  stroke="hsl(var(--chart-1))" 
                  fill="hsl(var(--chart-1))" 
                  fillOpacity={0.3}
                />
                <Area 
                  type="monotone" 
                  dataKey="Scope 3 Target" 
                  stackId="target"
                  stroke="hsl(var(--chart-3))" 
                  fill="hsl(var(--chart-3))" 
                  fillOpacity={0.3}
                />
                <Area 
                  type="monotone" 
                  dataKey="Actual" 
                  stroke="hsl(var(--chart-2))" 
                  fill="hsl(var(--chart-2))" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Emission Reduction Projects */}
      <EmissionReductionProjects
        baseScope12={baseScope12}
        baseScope3={baseScope3}
        baseYear={formData.base_year}
        nearTermYear={formData.near_term_target_year}
        netZeroYear={formData.netzero_target_year}
        scope12ReductionPercent={formData.scope_1_2_reduction_percent}
        scope3ReductionPercent={formData.scope_3_reduction_percent}
      />
    </div>
  );
};

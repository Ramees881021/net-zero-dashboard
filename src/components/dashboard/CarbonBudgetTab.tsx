import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, TrendingDown, Target, Calculator, Wallet, PiggyBank, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';

interface CarbonBudget {
  id: string;
  user_id: string;
  scope_1_carbon_cost: number | null;
  scope_2_carbon_cost: number | null;
  scope_3_carbon_cost: number | null;
  discount_rate: number | null;
}

interface EmissionsData {
  reporting_year: number;
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
}

interface NetZeroTarget {
  base_year: number;
  near_term_target_year: number;
  netzero_target_year: number;
  scope_1_2_reduction_percent: number;
  scope_3_reduction_percent: number;
}

const getCurrencySymbol = (currency: string) => {
  switch (currency) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    default: return currency;
  }
};

export const CarbonBudgetTab = () => {
  const { user } = useAuth();
  const { currency, baseYear } = useDashboard();
  const currencySymbol = getCurrencySymbol(currency);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingBudget, setExistingBudget] = useState<CarbonBudget | null>(null);
  const [emissionsData, setEmissionsData] = useState<EmissionsData[]>([]);
  const [netZeroTarget, setNetZeroTarget] = useState<NetZeroTarget | null>(null);
  
  const [formData, setFormData] = useState({
    scope_1_carbon_cost: '',
    scope_2_carbon_cost: '',
    scope_3_carbon_cost: '',
    discount_rate: '5'
  });
  
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoading(true);
      
      // Fetch carbon budget, emissions data, and net-zero targets in parallel
      const [budgetRes, emissionsRes, targetRes] = await Promise.all([
        supabase
          .from('carbon_budgets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('emissions_data')
          .select('reporting_year, scope_1_emissions, scope_2_emissions, scope_3_emissions')
          .eq('user_id', user.id)
          .order('reporting_year', { ascending: true }),
        supabase
          .from('netzero_targets')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      if (budgetRes.data) {
        setExistingBudget(budgetRes.data);
        setFormData({
          scope_1_carbon_cost: budgetRes.data.scope_1_carbon_cost?.toString() || '',
          scope_2_carbon_cost: budgetRes.data.scope_2_carbon_cost?.toString() || '',
          scope_3_carbon_cost: budgetRes.data.scope_3_carbon_cost?.toString() || '',
          discount_rate: budgetRes.data.discount_rate?.toString() || '5'
        });
      }
      
      if (emissionsRes.data) {
        setEmissionsData(emissionsRes.data);
      }
      
      if (targetRes.data) {
        setNetZeroTarget(targetRes.data);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    
    const budgetData = {
      user_id: user.id,
      scope_1_carbon_cost: formData.scope_1_carbon_cost ? parseFloat(formData.scope_1_carbon_cost) : null,
      scope_2_carbon_cost: formData.scope_2_carbon_cost ? parseFloat(formData.scope_2_carbon_cost) : null,
      scope_3_carbon_cost: formData.scope_3_carbon_cost ? parseFloat(formData.scope_3_carbon_cost) : null,
      discount_rate: formData.discount_rate ? parseFloat(formData.discount_rate) : 5
    };
    
    let result;
    if (existingBudget) {
      result = await supabase
        .from('carbon_budgets')
        .update(budgetData)
        .eq('id', existingBudget.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('carbon_budgets')
        .insert(budgetData)
        .select()
        .single();
    }
    
    if (result.error) {
      toast.error('Failed to save carbon budget data');
    } else {
      setExistingBudget(result.data);
      setIsDirty(false);
      toast.success('Carbon budget data saved successfully');
    }
    
    setSaving(false);
  };

  // Calculate carbon budgets using financial methods
  const calculations = useMemo(() => {
    if (!netZeroTarget || emissionsData.length === 0) return null;
    
    const baseYearData = emissionsData.find(e => e.reporting_year === netZeroTarget.base_year);
    if (!baseYearData) return null;
    
    const baseScope12 = (baseYearData.scope_1_emissions || 0) + (baseYearData.scope_2_emissions || 0);
    const baseScope3 = baseYearData.scope_3_emissions || 0;
    const totalBaseEmissions = baseScope12 + baseScope3;
    
    const currentYear = new Date().getFullYear();
    const yearsToNearTerm = Math.max(0, netZeroTarget.near_term_target_year - currentYear);
    const yearsToNetZero = Math.max(0, netZeroTarget.netzero_target_year - currentYear);
    const yearsNearTermToNetZero = netZeroTarget.netzero_target_year - netZeroTarget.near_term_target_year;
    
    // Near-term targets
    const nearTermScope12Target = baseScope12 * (1 - netZeroTarget.scope_1_2_reduction_percent / 100);
    const nearTermScope3Target = baseScope3 * (1 - netZeroTarget.scope_3_reduction_percent / 100);
    const nearTermTotalTarget = nearTermScope12Target + nearTermScope3Target;
    
    // Net-Zero targets (90% reduction from near-term for residual)
    const netZeroScope12Target = nearTermScope12Target * 0.05; // 95% reduction from near-term
    const netZeroScope3Target = nearTermScope3Target * 0.1; // 90% reduction from near-term
    const netZeroTotalTarget = netZeroScope12Target + netZeroScope3Target;
    
    // Current emissions (latest year)
    const latestData = emissionsData[emissionsData.length - 1];
    const currentScope12 = (latestData?.scope_1_emissions || 0) + (latestData?.scope_2_emissions || 0);
    const currentScope3 = latestData?.scope_3_emissions || 0;
    const currentTotal = currentScope12 + currentScope3;
    
    // Reductions needed for Near-Term
    const scope12ReductionToNearTerm = Math.max(0, currentScope12 - nearTermScope12Target);
    const scope3ReductionToNearTerm = Math.max(0, currentScope3 - nearTermScope3Target);
    const totalReductionToNearTerm = scope12ReductionToNearTerm + scope3ReductionToNearTerm;
    
    // Reductions needed for Net-Zero (from near-term target)
    const scope12ReductionToNetZero = Math.max(0, nearTermScope12Target - netZeroScope12Target);
    const scope3ReductionToNetZero = Math.max(0, nearTermScope3Target - netZeroScope3Target);
    const totalReductionToNetZero = scope12ReductionToNetZero + scope3ReductionToNetZero;
    
    // Total reductions from current to net-zero
    const totalScope12Reduction = Math.max(0, currentScope12 - netZeroScope12Target);
    const totalScope3Reduction = Math.max(0, currentScope3 - netZeroScope3Target);
    
    // Carbon costs
    const scope1Cost = parseFloat(formData.scope_1_carbon_cost) || 0;
    const scope2Cost = parseFloat(formData.scope_2_carbon_cost) || 0;
    const scope3Cost = parseFloat(formData.scope_3_carbon_cost) || 0;
    const discountRate = (parseFloat(formData.discount_rate) || 5) / 100;
    
    // Weighted average cost for Scope 1+2
    const scope12Ratio = currentScope12 > 0 
      ? (latestData?.scope_1_emissions || 0) / currentScope12 
      : 0.5;
    const avgScope12Cost = scope12Ratio * scope1Cost + (1 - scope12Ratio) * scope2Cost;
    
    // === NEAR-TERM CARBON BUDGET CALCULATIONS ===
    // Cumulative carbon budget (trapezoidal area under reduction curve)
    const nearTermCarbonBudgetScope12 = yearsToNearTerm > 0 
      ? ((currentScope12 + nearTermScope12Target) / 2) * yearsToNearTerm
      : 0;
    const nearTermCarbonBudgetScope3 = yearsToNearTerm > 0 
      ? ((currentScope3 + nearTermScope3Target) / 2) * yearsToNearTerm
      : 0;
    const nearTermTotalCarbonBudget = nearTermCarbonBudgetScope12 + nearTermCarbonBudgetScope3;
    
    // Financial budget to reach near-term (cost of reductions)
    const nearTermFinancialScope12 = scope12ReductionToNearTerm * avgScope12Cost;
    const nearTermFinancialScope3 = scope3ReductionToNearTerm * scope3Cost;
    const nearTermTotalFinancial = nearTermFinancialScope12 + nearTermFinancialScope3;
    
    // NPV of near-term carbon liability
    const calculateNPV = (annualEmissions: number, carbonCost: number, years: number) => {
      let npv = 0;
      for (let t = 1; t <= years; t++) {
        npv += (annualEmissions * carbonCost) / Math.pow(1 + discountRate, t);
      }
      return npv;
    };
    
    const nearTermNPVScope12 = calculateNPV((currentScope12 + nearTermScope12Target) / 2, avgScope12Cost, yearsToNearTerm);
    const nearTermNPVScope3 = calculateNPV((currentScope3 + nearTermScope3Target) / 2, scope3Cost, yearsToNearTerm);
    const nearTermTotalNPV = nearTermNPVScope12 + nearTermNPVScope3;
    
    // Annual reduction rate for near-term
    const annualScope12ReductionNearTerm = yearsToNearTerm > 0 ? scope12ReductionToNearTerm / yearsToNearTerm : 0;
    const annualScope3ReductionNearTerm = yearsToNearTerm > 0 ? scope3ReductionToNearTerm / yearsToNearTerm : 0;
    
    // === NET-ZERO CARBON BUDGET CALCULATIONS ===
    // Cumulative carbon budget from near-term to net-zero
    const netZeroCarbonBudgetScope12 = yearsNearTermToNetZero > 0 
      ? ((nearTermScope12Target + netZeroScope12Target) / 2) * yearsNearTermToNetZero
      : 0;
    const netZeroCarbonBudgetScope3 = yearsNearTermToNetZero > 0 
      ? ((nearTermScope3Target + netZeroScope3Target) / 2) * yearsNearTermToNetZero
      : 0;
    const netZeroTotalCarbonBudget = netZeroCarbonBudgetScope12 + netZeroCarbonBudgetScope3;
    
    // Total carbon budget from now to net-zero
    const totalCarbonBudget = nearTermTotalCarbonBudget + netZeroTotalCarbonBudget;
    
    // Financial budget to reach net-zero (from near-term)
    const netZeroFinancialScope12 = scope12ReductionToNetZero * avgScope12Cost;
    const netZeroFinancialScope3 = scope3ReductionToNetZero * scope3Cost;
    const netZeroTotalFinancial = netZeroFinancialScope12 + netZeroFinancialScope3;
    
    // Total financial budget (near-term + net-zero phase)
    const totalFinancialBudget = nearTermTotalFinancial + netZeroTotalFinancial;
    
    // NPV of net-zero phase carbon liability (discounted from near-term year)
    const netZeroNPVScope12 = calculateNPV((nearTermScope12Target + netZeroScope12Target) / 2, avgScope12Cost, yearsNearTermToNetZero) / Math.pow(1 + discountRate, yearsToNearTerm);
    const netZeroNPVScope3 = calculateNPV((nearTermScope3Target + netZeroScope3Target) / 2, scope3Cost, yearsNearTermToNetZero) / Math.pow(1 + discountRate, yearsToNearTerm);
    const netZeroTotalNPV = netZeroNPVScope12 + netZeroNPVScope3;
    
    // Total NPV
    const totalNPV = nearTermTotalNPV + netZeroTotalNPV;
    
    // Annual reduction rate for net-zero phase
    const annualScope12ReductionNetZero = yearsNearTermToNetZero > 0 ? scope12ReductionToNetZero / yearsNearTermToNetZero : 0;
    const annualScope3ReductionNetZero = yearsNearTermToNetZero > 0 ? scope3ReductionToNetZero / yearsNearTermToNetZero : 0;
    
    // Generate year-by-year projection
    const projectionData = [];
    for (let year = currentYear; year <= netZeroTarget.netzero_target_year; year++) {
      const yearsFromNow = year - currentYear;
      const isNearTerm = year <= netZeroTarget.near_term_target_year;
      
      let scope12Emissions, scope3Emissions;
      
      if (isNearTerm && yearsToNearTerm > 0) {
        const progress = yearsFromNow / yearsToNearTerm;
        scope12Emissions = currentScope12 - (scope12ReductionToNearTerm * progress);
        scope3Emissions = currentScope3 - (scope3ReductionToNearTerm * progress);
      } else {
        // Post near-term: continue to net-zero
        const yearsFromNearTerm = year - netZeroTarget.near_term_target_year;
        const progress = yearsNearTermToNetZero > 0 ? yearsFromNearTerm / yearsNearTermToNetZero : 1;
        scope12Emissions = nearTermScope12Target - (scope12ReductionToNetZero * progress);
        scope3Emissions = nearTermScope3Target - (scope3ReductionToNetZero * progress);
      }
      
      const annualCost = (scope12Emissions * avgScope12Cost + scope3Emissions * scope3Cost) / 1000000;
      
      projectionData.push({
        year,
        scope12: Math.max(0, scope12Emissions),
        scope3: Math.max(0, scope3Emissions),
        total: Math.max(0, scope12Emissions + scope3Emissions),
        annualCost: Math.max(0, annualCost),
        isNearTerm: year === netZeroTarget.near_term_target_year,
        isNetZero: year === netZeroTarget.netzero_target_year
      });
    }
    
    // Marginal Abatement Cost data
    const macData = [
      { name: 'Energy Efficiency', cost: scope1Cost * 0.3, potential: totalScope12Reduction * 0.25 },
      { name: 'Renewable Energy', cost: scope2Cost * 0.5, potential: totalScope12Reduction * 0.35 },
      { name: 'Electrification', cost: scope1Cost * 0.8, potential: totalScope12Reduction * 0.2 },
      { name: 'Supply Chain', cost: scope3Cost * 0.6, potential: totalScope3Reduction * 0.3 },
      { name: 'Low-Carbon Materials', cost: scope3Cost * 1.2, potential: totalScope3Reduction * 0.25 },
      { name: 'Carbon Offsets', cost: Math.max(scope1Cost, scope2Cost, scope3Cost) * 1.5, potential: (totalScope12Reduction + totalScope3Reduction) * 0.15 }
    ].sort((a, b) => a.cost - b.cost);
    
    return {
      // Target years
      baseYear: netZeroTarget.base_year,
      nearTermYear: netZeroTarget.near_term_target_year,
      netZeroYear: netZeroTarget.netzero_target_year,
      
      // Current emissions
      currentScope12,
      currentScope3,
      currentTotal,
      
      // Base year emissions
      baseScope12,
      baseScope3,
      totalBaseEmissions,
      
      // Target emissions
      nearTermScope12Target,
      nearTermScope3Target,
      nearTermTotalTarget,
      netZeroScope12Target,
      netZeroScope3Target,
      netZeroTotalTarget,
      
      // Near-term calculations
      scope12ReductionToNearTerm,
      scope3ReductionToNearTerm,
      totalReductionToNearTerm,
      nearTermCarbonBudgetScope12,
      nearTermCarbonBudgetScope3,
      nearTermTotalCarbonBudget,
      nearTermFinancialScope12,
      nearTermFinancialScope3,
      nearTermTotalFinancial,
      nearTermNPVScope12,
      nearTermNPVScope3,
      nearTermTotalNPV,
      annualScope12ReductionNearTerm,
      annualScope3ReductionNearTerm,
      
      // Net-zero calculations
      scope12ReductionToNetZero,
      scope3ReductionToNetZero,
      totalReductionToNetZero,
      netZeroCarbonBudgetScope12,
      netZeroCarbonBudgetScope3,
      netZeroTotalCarbonBudget,
      netZeroFinancialScope12,
      netZeroFinancialScope3,
      netZeroTotalFinancial,
      netZeroNPVScope12,
      netZeroNPVScope3,
      netZeroTotalNPV,
      annualScope12ReductionNetZero,
      annualScope3ReductionNetZero,
      
      // Totals
      totalCarbonBudget,
      totalFinancialBudget,
      totalNPV,
      
      // Chart data
      projectionData,
      macData,
      
      // Time periods
      yearsToNearTerm,
      yearsToNetZero,
      yearsNearTermToNetZero
    };
  }, [netZeroTarget, emissionsData, formData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasTargets = netZeroTarget !== null;
  const hasCosts = formData.scope_1_carbon_cost || formData.scope_2_carbon_cost || formData.scope_3_carbon_cost;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Carbon Budget</h2>
        <p className="text-muted-foreground">
          Calculate your carbon budget and financial liability using advanced financial methods
        </p>
      </div>

      {/* Carbon Cost Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Carbon Cost Inputs
          </CardTitle>
          <CardDescription>
            Enter your internal carbon pricing per tonne of CO₂e for each scope
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Scope 1 Carbon Cost ({currencySymbol}/tCO₂e)
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Direct emissions cost - fuel combustion, company vehicles, etc.</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                type="number"
                placeholder="e.g., 50"
                value={formData.scope_1_carbon_cost}
                onChange={(e) => handleInputChange('scope_1_carbon_cost', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Scope 2 Carbon Cost ({currencySymbol}/tCO₂e)
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Indirect emissions cost - purchased electricity, heating, cooling</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                type="number"
                placeholder="e.g., 45"
                value={formData.scope_2_carbon_cost}
                onChange={(e) => handleInputChange('scope_2_carbon_cost', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Scope 3 Carbon Cost ({currencySymbol}/tCO₂e)
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Value chain emissions cost - supply chain, business travel, etc.</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                type="number"
                placeholder="e.g., 30"
                value={formData.scope_3_carbon_cost}
                onChange={(e) => handleInputChange('scope_3_carbon_cost', e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                Discount Rate (%)
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">Used for NPV calculations of future carbon liability</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <Input
                type="number"
                placeholder="5"
                value={formData.discount_rate}
                onChange={(e) => handleInputChange('discount_rate', e.target.value)}
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving || !isDirty}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingBudget && !isDirty ? 'Edit' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Warning if no targets set */}
      {!hasTargets && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-sm">
              Please set your net-zero targets in the Net-Zero section to calculate carbon budgets.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Budget Summary Cards */}
      {calculations && hasCosts && (
        <>
          {/* Near-Term Carbon Budget Section */}
          <Card className="border-primary/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Near-Term Carbon Budget ({new Date().getFullYear()} → {calculations.nearTermYear})
              </CardTitle>
              <CardDescription>
                Carbon budget and financial requirements to reach your {calculations.nearTermYear} near-term targets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-sm">Carbon Budget</span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {calculations.nearTermTotalCarbonBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">tCO₂e cumulative allowance</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm">Required Reduction</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {calculations.totalReductionToNearTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">tCO₂e total</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span className="text-sm">Financial Budget</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currencySymbol}{(calculations.nearTermTotalFinancial / 1000000).toFixed(2)}M
                  </p>
                  <p className="text-xs text-muted-foreground">Reduction investment</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm">NPV of Liability</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currencySymbol}{(calculations.nearTermTotalNPV / 1000000).toFixed(2)}M
                  </p>
                  <p className="text-xs text-muted-foreground">At {formData.discount_rate}% discount</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Scope 1+2 Budget</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbon Budget:</span>
                      <span className="font-medium">{calculations.nearTermCarbonBudgetScope12.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reduction Required:</span>
                      <span className="font-medium">{calculations.scope12ReductionToNearTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Reduction:</span>
                      <span className="font-medium">{calculations.annualScope12ReductionNearTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e/yr</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Financial Cost:</span>
                      <span className="font-medium text-primary">{currencySymbol}{(calculations.nearTermFinancialScope12 / 1000000).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Scope 3 Budget</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbon Budget:</span>
                      <span className="font-medium">{calculations.nearTermCarbonBudgetScope3.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reduction Required:</span>
                      <span className="font-medium">{calculations.scope3ReductionToNearTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Reduction:</span>
                      <span className="font-medium">{calculations.annualScope3ReductionNearTerm.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e/yr</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Financial Cost:</span>
                      <span className="font-medium text-primary">{currencySymbol}{(calculations.nearTermFinancialScope3 / 1000000).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Net-Zero Carbon Budget Section */}
          <Card className="border-green-500/30">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                Net-Zero Carbon Budget ({calculations.nearTermYear} → {calculations.netZeroYear})
              </CardTitle>
              <CardDescription>
                Carbon budget and financial requirements for the long-term pathway to net-zero by {calculations.netZeroYear}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Target className="h-4 w-4" />
                    <span className="text-sm">Carbon Budget</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {calculations.netZeroTotalCarbonBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">tCO₂e cumulative allowance</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm">Required Reduction</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {calculations.totalReductionToNetZero.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">tCO₂e from near-term</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    <span className="text-sm">Financial Budget</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currencySymbol}{(calculations.netZeroTotalFinancial / 1000000).toFixed(2)}M
                  </p>
                  <p className="text-xs text-muted-foreground">Reduction investment</p>
                </div>
                
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calculator className="h-4 w-4" />
                    <span className="text-sm">NPV of Liability</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {currencySymbol}{(calculations.netZeroTotalNPV / 1000000).toFixed(2)}M
                  </p>
                  <p className="text-xs text-muted-foreground">Discounted to present</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Scope 1+2 Budget</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbon Budget:</span>
                      <span className="font-medium">{calculations.netZeroCarbonBudgetScope12.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reduction Required:</span>
                      <span className="font-medium">{calculations.scope12ReductionToNetZero.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Reduction:</span>
                      <span className="font-medium">{calculations.annualScope12ReductionNetZero.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e/yr</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Financial Cost:</span>
                      <span className="font-medium text-green-600">{currencySymbol}{(calculations.netZeroFinancialScope12 / 1000000).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-3">Scope 3 Budget</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carbon Budget:</span>
                      <span className="font-medium">{calculations.netZeroCarbonBudgetScope3.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reduction Required:</span>
                      <span className="font-medium">{calculations.scope3ReductionToNetZero.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Annual Reduction:</span>
                      <span className="font-medium">{calculations.annualScope3ReductionNetZero.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e/yr</span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Financial Cost:</span>
                      <span className="font-medium text-green-600">{currencySymbol}{(calculations.netZeroFinancialScope3 / 1000000).toFixed(2)}M</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Budget Summary */}
          <Card className="bg-gradient-to-br from-primary/5 to-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Total Carbon Budget Summary
              </CardTitle>
              <CardDescription>
                Combined near-term and net-zero pathway budget ({new Date().getFullYear()} → {calculations.netZeroYear})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">Total Carbon Budget</p>
                  <p className="text-3xl font-bold">{calculations.totalCarbonBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <p className="text-sm text-muted-foreground">tCO₂e cumulative</p>
                </div>
                
                <div className="text-center p-6 bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">Total Financial Budget</p>
                  <p className="text-3xl font-bold text-primary">{currencySymbol}{(calculations.totalFinancialBudget / 1000000).toFixed(2)}M</p>
                  <p className="text-sm text-muted-foreground">Investment required</p>
                </div>
                
                <div className="text-center p-6 bg-background rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">Total NPV of Liability</p>
                  <p className="text-3xl font-bold text-green-600">{currencySymbol}{(calculations.totalNPV / 1000000).toFixed(2)}M</p>
                  <p className="text-sm text-muted-foreground">At {formData.discount_rate}% discount rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emissions & Cost Projection Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Carbon Budget Trajectory
              </CardTitle>
              <CardDescription>
                Projected emissions pathway and annual carbon costs to net-zero
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={calculations.projectionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="year" className="text-xs" />
                    <YAxis yAxisId="emissions" className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis yAxisId="cost" orientation="right" className="text-xs" tickFormatter={(v) => `${currencySymbol}${v.toFixed(1)}M`} />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'annualCost') return [`${currencySymbol}${value.toFixed(2)}M`, 'Annual Cost'];
                        return [value.toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' tCO₂e', name];
                      }}
                    />
                    <Legend />
                    <ReferenceLine x={calculations.nearTermYear} stroke="hsl(var(--primary))" strokeDasharray="5 5" label={{ value: 'Near-Term', position: 'top' }} yAxisId="emissions" />
                    <ReferenceLine x={calculations.netZeroYear} stroke="hsl(var(--destructive))" strokeDasharray="5 5" label={{ value: 'Net-Zero', position: 'top' }} yAxisId="emissions" />
                    <Area yAxisId="emissions" type="monotone" dataKey="scope12" stackId="1" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} name="Scope 1+2" />
                    <Area yAxisId="emissions" type="monotone" dataKey="scope3" stackId="1" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.6} name="Scope 3" />
                    <Area yAxisId="cost" type="monotone" dataKey="annualCost" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.3} name="annualCost" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Marginal Abatement Cost Curve */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Marginal Abatement Cost Curve (MACC)
              </CardTitle>
              <CardDescription>
                Estimated cost-effectiveness of different decarbonization levers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calculations.macData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `${currencySymbol}${v}`} className="text-xs" />
                    <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'cost') return [`${currencySymbol}${value.toFixed(0)}/tCO₂e`, 'Abatement Cost'];
                        return [`${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} tCO₂e`, 'Reduction Potential'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="cost" name="Abatement Cost" radius={[0, 4, 4, 0]}>
                      {calculations.macData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                * MACC data is illustrative based on your carbon cost inputs. Actual costs vary by technology and implementation.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state when no costs entered */}
      {hasTargets && !hasCosts && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Enter Carbon Costs to Calculate Budget</h3>
            <p className="text-muted-foreground max-w-md">
              Input your internal carbon pricing for each scope above to see your carbon budget calculations, 
              financial projections, and marginal abatement cost analysis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

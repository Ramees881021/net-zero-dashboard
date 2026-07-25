import { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, Loader2, Trash2, Download, Upload, FileSpreadsheet, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useEmissionsBulkOperations, CDP_SCORES, SBTI_STATUSES } from '@/hooks/useEmissionsBulkOperations';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';

type Scope3Status = 'calculated' | 'not_applicable' | 'not_calculated';

interface Scope3CategoryEntry {
  value: string;
  status: Scope3Status;
}

export type Scope3Breakdown = Record<string, Scope3CategoryEntry>;

interface EmissionsFormData {
  scope_1_emissions: string;
  scope_2_location_based: string;
  scope_2_market_based: string;
  scope_3_emissions: string;
  revenue: string;
  cdp_score: string;
  ecovadis_score: string;
  sbti_target_status: string;
  scope3_breakdown: Scope3Breakdown;
}

const getDefaultBreakdown = (): Scope3Breakdown => {
  const bd: Scope3Breakdown = {};
  SCOPE3_CATEGORIES.forEach(cat => {
    bd[cat.code] = { value: '', status: 'calculated' };
  });
  return bd;
};

export const EmissionsTab = () => {
  const { user } = useAuth();
  const { selectedYear, currencySymbol } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScope3Breakdown, setShowScope3Breakdown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { downloadTemplate, exportData, importData } = useEmissionsBulkOperations(user?.id, currencySymbol);
  
  const [formData, setFormData] = useState<EmissionsFormData>({
    scope_1_emissions: '',
    scope_2_location_based: '',
    scope_2_market_based: '',
    scope_3_emissions: '',
    revenue: '',
    cdp_score: '',
    ecovadis_score: '',
    sbti_target_status: '',
    scope3_breakdown: getDefaultBreakdown(),
  });

  const resetForm = () => {
    setFormData({
      scope_1_emissions: '',
      scope_2_location_based: '',
      scope_2_market_based: '',
      scope_3_emissions: '',
      revenue: '',
      cdp_score: '',
      ecovadis_score: '',
      sbti_target_status: '',
      scope3_breakdown: getDefaultBreakdown(),
    });
    setExistingId(null);
    setIsDirty(false);
  };

  const parseBreakdownFromDb = (dbVal: any): Scope3Breakdown => {
    const bd = getDefaultBreakdown();
    if (!dbVal || typeof dbVal !== 'object') return bd;
    Object.keys(dbVal).forEach(key => {
      if (bd[key]) {
        const entry = dbVal[key];
        bd[key] = {
          value: entry?.value?.toString() ?? '',
          status: entry?.status || 'calculated',
        };
      }
    });
    return bd;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const { data } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('reporting_year', selectedYear)
        .maybeSingle();

      if (data) {
        setExistingId(data.id);
        setFormData({
          scope_1_emissions: data.scope_1_emissions?.toString() || '',
          scope_2_location_based: (data as any).scope_2_location_based?.toString() || '',
          scope_2_market_based: data.scope_2_emissions?.toString() || '',
          scope_3_emissions: data.scope_3_emissions?.toString() || '',
          revenue: data.revenue?.toString() || '',
          cdp_score: data.cdp_score || '',
          ecovadis_score: data.ecovadis_score?.toString() || '',
          sbti_target_status: data.sbti_target_status || '',
          scope3_breakdown: parseBreakdownFromDb((data as any).scope3_breakdown),
        });
        setIsDirty(false);
      } else {
        resetForm();
      }
      setLoading(false);
    };

    fetchData();
  }, [user, selectedYear]);

  // Compute sum of Scope 3 sub-categories
  const scope3SubTotal = useMemo(() => {
    return Object.values(formData.scope3_breakdown).reduce((sum, entry) => {
      if (entry.status === 'calculated' && entry.value) {
        return sum + (parseFloat(entry.value) || 0);
      }
      return sum;
    }, 0);
  }, [formData.scope3_breakdown]);

  const scope3Total = formData.scope_3_emissions ? parseFloat(formData.scope_3_emissions) : 0;
  const hasBreakdownValues = Object.values(formData.scope3_breakdown).some(
    e => e.status !== 'calculated' || (e.value && e.value !== '')
  );
  const scope3Mismatch = hasBreakdownValues && scope3Total > 0 && Math.abs(scope3SubTotal - scope3Total) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // If breakdown has values, auto-sync the total
    if (hasBreakdownValues && scope3SubTotal > 0) {
      // Auto-set Scope 3 total to match sub-total
      formData.scope_3_emissions = scope3SubTotal.toString();
    }

    // Build breakdown payload for DB
    const breakdownPayload: Record<string, { value: number | null; status: string }> = {};
    Object.entries(formData.scope3_breakdown).forEach(([code, entry]) => {
      breakdownPayload[code] = {
        value: entry.status === 'calculated' && entry.value ? parseFloat(entry.value) : null,
        status: entry.status,
      };
    });

    setSaving(true);

    const payload = {
      user_id: user.id,
      reporting_year: selectedYear,
      scope_1_emissions: formData.scope_1_emissions ? parseFloat(formData.scope_1_emissions) : null,
      scope_2_location_based: formData.scope_2_location_based ? parseFloat(formData.scope_2_location_based) : null,
      scope_2_emissions: formData.scope_2_market_based ? parseFloat(formData.scope_2_market_based) : null,
      scope_3_emissions: formData.scope_3_emissions ? parseFloat(formData.scope_3_emissions) : null,
      revenue: formData.revenue ? parseFloat(formData.revenue) : null,
      cdp_score: formData.cdp_score || null,
      ecovadis_score: formData.ecovadis_score ? parseInt(formData.ecovadis_score) : null,
      sbti_target_status: formData.sbti_target_status || null,
      scope3_breakdown: breakdownPayload,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from('emissions_data').update(payload).eq('id', existingId));
    } else {
      ({ error } = await supabase.from('emissions_data').insert(payload));
    }

    if (error) {
      toast.error('Failed to save data');
    } else {
      toast.success('Data saved successfully');
      setIsDirty(false);
      if (!existingId) {
        const { data } = await supabase
          .from('emissions_data')
          .select('id')
          .eq('user_id', user.id)
          .eq('reporting_year', selectedYear)
          .maybeSingle();
        if (data) setExistingId(data.id);
      }
    }
    setSaving(false);
  };

  const handleClearData = async () => {
    if (!user || !existingId) return;
    
    setClearing(true);
    const { error } = await supabase
      .from('emissions_data')
      .delete()
      .eq('id', existingId);

    if (error) {
      toast.error('Failed to clear data');
    } else {
      toast.success(`Emissions data for ${selectedYear} cleared successfully`);
      resetForm();
    }
    setClearing(false);
    setShowClearConfirm(false);
  };

  const updateField = (field: keyof EmissionsFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const updateBreakdownEntry = (code: string, field: 'value' | 'status', val: string) => {
    setFormData(prev => {
      const bd = { ...prev.scope3_breakdown };
      bd[code] = { ...bd[code], [field]: val };
      // If switching to not_applicable or not_calculated, clear value
      if (field === 'status' && val !== 'calculated') {
        bd[code].value = '';
      }
      return { ...prev, scope3_breakdown: bd };
    });
    setIsDirty(true);
  };

  // Auto-sync: when breakdown sub-total changes, update main scope 3 field
  const handleSyncScope3Total = () => {
    setFormData(prev => ({ ...prev, scope_3_emissions: scope3SubTotal.toString() }));
    setIsDirty(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const result = await importData(file);
    setImporting(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    if (result.success) {
      const { data } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user?.id)
        .eq('reporting_year', selectedYear)
        .maybeSingle();

      if (data) {
        setExistingId(data.id);
        setFormData({
          scope_1_emissions: data.scope_1_emissions?.toString() || '',
          scope_2_location_based: (data as any).scope_2_location_based?.toString() || '',
          scope_2_market_based: data.scope_2_emissions?.toString() || '',
          scope_3_emissions: data.scope_3_emissions?.toString() || '',
          revenue: data.revenue?.toString() || '',
          cdp_score: data.cdp_score || '',
          ecovadis_score: data.ecovadis_score?.toString() || '',
          sbti_target_status: data.sbti_target_status || '',
          scope3_breakdown: parseBreakdownFromDb((data as any).scope3_breakdown),
        });
        setIsDirty(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Emissions Data Entry</h1>
          <p className="text-muted-foreground">Enter your emissions and ESG data for {selectedYear}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import Data
          </Button>
          
          <Button type="button" variant="outline" size="sm" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>
      
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>Bulk Entry:</strong> Download the template to enter multiple years of data at once, including Scope 3 sub-category breakdown.
            The template includes a "Dropdown Options" sheet with valid values for CDP Score ({CDP_SCORES.join(', ')}) 
            and SBTi Status ({SBTI_STATUSES.join(', ')}). EcoVadis scores must be between 0-100.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Emissions Section */}
        <Card>
          <CardHeader>
            <CardTitle>GHG Emissions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scope1">Scope 1 (tCO₂e)</Label>
              <Input
                id="scope1"
                type="number"
                step="any"
                placeholder="Direct emissions"
                value={formData.scope_1_emissions}
                onChange={(e) => updateField('scope_1_emissions', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope2-location">Scope 2 - Location-based (tCO₂e)</Label>
              <Input
                id="scope2-location"
                type="number"
                step="any"
                placeholder="Location-based emissions"
                value={formData.scope_2_location_based}
                onChange={(e) => updateField('scope_2_location_based', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope2-market">Scope 2 - Market-based (tCO₂e)</Label>
              <Input
                id="scope2-market"
                type="number"
                step="any"
                placeholder="Market-based emissions"
                value={formData.scope_2_market_based}
                onChange={(e) => updateField('scope_2_market_based', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used for calculations & analytics</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope3">Scope 3 Total (tCO₂e)</Label>
              <Input
                id="scope3"
                type="number"
                step="any"
                placeholder="Value chain"
                value={formData.scope_3_emissions}
                onChange={(e) => updateField('scope_3_emissions', e.target.value)}
                className={scope3Mismatch ? 'border-yellow-500' : ''}
              />
              {hasBreakdownValues && (
                <p className="text-xs text-muted-foreground">
                  Sub-category total: <strong>{scope3SubTotal.toFixed(2)}</strong> tCO₂e
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Scope 3 Sub-category Breakdown */}
        <Card>
          <CardHeader className="cursor-pointer" onClick={() => setShowScope3Breakdown(!showScope3Breakdown)}>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Scope 3 Sub-Category Breakdown
                {hasBreakdownValues && !scope3Mismatch && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {scope3Mismatch && (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {hasBreakdownValues && (
                  <span className="text-sm text-muted-foreground">
                    Total: {scope3SubTotal.toFixed(2)} tCO₂e
                  </span>
                )}
                {showScope3Breakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
          {showScope3Breakdown && (
            <CardContent className="space-y-3">
              {/* Mismatch warning */}
              {scope3Mismatch && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                  <span>
                    Sub-category total ({scope3SubTotal.toFixed(2)}) doesn't match Scope 3 total ({scope3Total.toFixed(2)}).
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={handleSyncScope3Total} className="ml-auto">
                    Sync Total
                  </Button>
                </div>
              )}

              <div className="text-xs text-muted-foreground mb-2">
                For each category, enter the value in tCO₂e or mark as "Not Applicable" or "Not Calculated".
              </div>

              <div className="space-y-2">
                {SCOPE3_CATEGORIES.map(cat => {
                  const entry = formData.scope3_breakdown[cat.code];
                  return (
                    <div key={cat.code} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/30 border">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{cat.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={entry?.status || 'calculated'}
                          onValueChange={(v) => updateBreakdownEntry(cat.code, 'status', v)}
                        >
                          <SelectTrigger className="w-[150px] h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="calculated">Calculated</SelectItem>
                            <SelectItem value="not_applicable">Not Applicable</SelectItem>
                            <SelectItem value="not_calculated">Not Calculated</SelectItem>
                          </SelectContent>
                        </Select>
                        {entry?.status === 'calculated' ? (
                          <Input
                            type="number"
                            step="any"
                            placeholder="tCO₂e"
                            className="w-[130px] h-9 text-sm"
                            value={entry?.value || ''}
                            onChange={(e) => updateBreakdownEntry(cat.code, 'value', e.target.value)}
                          />
                        ) : (
                          <div className="w-[130px] h-9 flex items-center justify-center text-xs text-muted-foreground italic border rounded-md bg-muted/50">
                            {entry?.status === 'not_applicable' ? 'N/A' : 'Not calculated'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary row */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20 mt-2">
                <span className="text-sm font-semibold">Sub-Category Total</span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{scope3SubTotal.toFixed(2)} tCO₂e</span>
                  {scope3SubTotal > 0 && (
                    <Button type="button" variant="outline" size="sm" onClick={handleSyncScope3Total}>
                      Use as Scope 3 Total
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Financial Section */}
        <Card>
          <CardHeader>
            <CardTitle>Financial Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-md">
              <Label htmlFor="revenue">Revenue ({currencySymbol})</Label>
              <Input
                id="revenue"
                type="number"
                placeholder="Annual revenue"
                value={formData.revenue}
                onChange={(e) => updateField('revenue', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ESG Scores Section */}
        <Card>
          <CardHeader>
            <CardTitle>ESG Performance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CDP Score</Label>
              <Select value={formData.cdp_score} onValueChange={(v) => updateField('cdp_score', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select score" />
                </SelectTrigger>
                <SelectContent>
                  {CDP_SCORES.map((score) => (
                    <SelectItem key={score} value={score}>{score}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ecovadis">EcoVadis Score (0-100)</Label>
              <Input
                id="ecovadis"
                type="number"
                min="0"
                max="100"
                placeholder="0-100"
                value={formData.ecovadis_score}
                onChange={(e) => updateField('ecovadis_score', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>SBTi Status</Label>
              <Select value={formData.sbti_target_status} onValueChange={(v) => updateField('sbti_target_status', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {SBTI_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={saving} className="w-full md:w-auto">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {isDirty || !existingId ? 'Save Data' : 'Edit Data'}
          </Button>

          {existingId && (
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={clearing}>
                  {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all emissions data for {selectedYear}. 
                    This action cannot be undone and will affect calculations across all sections.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearData}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Clear Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </form>
    </div>
  );
};

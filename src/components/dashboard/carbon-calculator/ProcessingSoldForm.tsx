import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2, Globe, MapPin, Factory, Zap, Upload, Download, FileSpreadsheet, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

interface ProcessingSoldFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
}

// Data mode selector (shared pattern)
const DataModeSelector = ({ mode, setMode, sites, selectedSiteId, setSelectedSiteId }: {
  mode: 'global' | 'site';
  setMode: (m: 'global' | 'site') => void;
  sites: Site[];
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
}) => (
  <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-muted/30 border">
    <span className="text-xs text-muted-foreground">Data level:</span>
    <Button variant={mode === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setMode('global')} className="gap-1">
      <Globe className="h-3.5 w-3.5" /> Global
    </Button>
    <Button variant={mode === 'site' ? 'default' : 'outline'} size="sm" onClick={() => setMode('site')} className="gap-1" disabled={sites.length === 0}>
      <MapPin className="h-3.5 w-3.5" /> Site-level
    </Button>
    {mode === 'site' && sites.length > 0 && (
      <Select value={selectedSiteId || ''} onValueChange={v => setSelectedSiteId(v)}>
        <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Select site" /></SelectTrigger>
        <SelectContent>
          {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ''}</SelectItem>)}
        </SelectContent>
      </Select>
    )}
    {mode === 'site' && sites.length === 0 && (
      <span className="text-xs text-muted-foreground">Add sites in the Sites tab first</span>
    )}
  </div>
);

export const ProcessingSoldForm = ({ onAdd, onAddBatch, sites, entries }: ProcessingSoldFormProps) => {
  const [method, setMethod] = useState<'average' | 'site_specific'>('average');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);

  // Average-Data Method state
  const [productName, setProductName] = useState('');
  const [processDesc, setProcessDesc] = useState('');
  const [mass, setMass] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiFactor, setAiFactor] = useState<{ emission_factor: number; source: string; reasoning: string; tco2e: number } | null>(null);

  // Site-Specific Method state
  const [customerName, setCustomerName] = useState('');
  const [fuelTco2e, setFuelTco2e] = useState('');
  const [electricityTco2e, setElectricityTco2e] = useState('');
  const [wasteTco2e, setWasteTco2e] = useState('');
  const [allocationPct, setAllocationPct] = useState('');
  const [siteDesc, setSiteDesc] = useState('');

  // Bulk import
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);

  // ── Average-Data: Get AI Factor ──
  const fetchProcessFactor = async () => {
    if (!productName || !mass) return;
    setLoading(true);
    setAiFactor(null);
    try {
      const { data, error } = await supabase.functions.invoke('assign-process-factor', {
        body: {
          entries: [{
            productName,
            processDescription: processDesc || `Standard processing of ${productName}`,
            massTonnes: parseFloat(mass),
          }],
        },
      });
      if (error) throw error;
      if (data?.results?.[0]) {
        setAiFactor(data.results[0]);
      }
    } catch (err: any) {
      console.error('Process factor error:', err);
      toast.error('AI unavailable. Enter emission factor manually or try again.');
    } finally {
      setLoading(false);
    }
  };

  const addAverageEntry = () => {
    if (!mass || !aiFactor) return;
    onAdd({
      categoryCode: 'processing_sold',
      type: 'average_data',
      quantity: parseFloat(mass),
      unit: 'tonnes',
      tco2e: aiFactor.tco2e,
      description: `${productName}: ${processDesc || 'Processing'} (${aiFactor.source})`,
      siteId: mode === 'site' ? selectedSiteId : null,
    });
    setProductName(''); setProcessDesc(''); setMass(''); setAiFactor(null);
    toast.success('Entry added');
  };

  // ── Site-Specific: Add Entry ──
  const addSiteSpecificEntry = () => {
    const fuel = parseFloat(fuelTco2e || '0');
    const elec = parseFloat(electricityTco2e || '0');
    const waste = parseFloat(wasteTco2e || '0');
    const alloc = parseFloat(allocationPct || '100') / 100;
    const totalCustomer = fuel + elec + waste;
    const allocated = totalCustomer * alloc;
    if (allocated <= 0) return;

    onAdd({
      categoryCode: 'processing_sold',
      type: 'site_specific',
      quantity: allocated,
      unit: 'tCO₂e',
      tco2e: allocated,
      description: `${customerName || 'Customer'}: Fuel=${fuel}, Elec=${elec}, Waste=${waste} × ${(alloc * 100).toFixed(0)}% alloc`,
      siteId: mode === 'site' ? selectedSiteId : null,
    });
    setCustomerName(''); setFuelTco2e(''); setElectricityTco2e(''); setWasteTco2e(''); setAllocationPct(''); setSiteDesc('');
    toast.success('Entry added');
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Average-Data sheet
    const avgHeaders = ['Method', 'Product Name', 'Process Description', 'Mass (tonnes)', 'Emission Factor (kgCO2e/t)', 'Site Name'];
    const avgExample = ['average', 'Raw Sugar', 'Sugar Refining', '500', '150', ''];
    const avgWs = XLSX.utils.aoa_to_sheet([avgHeaders, avgExample]);
    avgWs['!cols'] = avgHeaders.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, avgWs, 'Average Data');

    // Site-Specific sheet
    const ssHeaders = ['Method', 'Customer Name', 'Fuel (tCO2e)', 'Electricity (tCO2e)', 'Waste (tCO2e)', 'Allocation %', 'Description', 'Site Name'];
    const ssExample = ['site_specific', 'Acme Foods Ltd', '120', '85', '15', '30', 'Sugar processing allocation', ''];
    const ssWs = XLSX.utils.aoa_to_sheet([ssHeaders, ssExample]);
    ssWs['!cols'] = ssHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ssWs, 'Site-Specific');

    // Reference
    const refData = [
      ['Scope 3 Category 10: Processing of Sold Products'],
      [],
      ['Method', 'Description'],
      ['average', 'Mass × Emission Factor (AI-assigned or manual). Most common method.'],
      ['site_specific', 'Sum of customer fuel + electricity + waste × allocation %. Most accurate.'],
      [],
      ['Notes:'],
      ['- For Average Data: if Emission Factor is left blank, AI will assign one automatically on import'],
      ['- For Site-Specific: Allocation % is the portion of customer processing attributable to your product'],
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 30 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference');

    XLSX.writeFile(wb, 'cat10_processing_sold_template.xlsx');
    toast.success('Template downloaded');
  };

  // ── Bulk: Import ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const parsed: Omit<Scope3Entry, 'id'>[] = [];

        // Parse Average Data sheet
        const avgSheet = wb.Sheets['Average Data'] || wb.Sheets[wb.SheetNames[0]];
        if (avgSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(avgSheet);
          rows.forEach((row: any) => {
            const m = String(row['Method'] || '').toLowerCase().trim();
            if (m !== 'average') return;
            const product = String(row['Product Name'] || '').trim();
            const process = String(row['Process Description'] || '').trim();
            const massTonnes = parseFloat(row['Mass (tonnes)'] || 0);
            const ef = parseFloat(row['Emission Factor (kgCO2e/t)'] || 0);
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            if (!massTonnes || !ef) return;
            const tco2e = (massTonnes * ef) / 1000;
            parsed.push({
              categoryCode: 'processing_sold', type: 'average_data', quantity: massTonnes, unit: 'tonnes',
              tco2e, description: `${product}: ${process} (EF: ${ef} kgCO₂e/t)`,
              siteId: siteMatch?.id || null,
            });
          });
        }

        // Parse Site-Specific sheet
        const ssSheet = wb.Sheets['Site-Specific'] || wb.Sheets[wb.SheetNames[1]];
        if (ssSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(ssSheet);
          rows.forEach((row: any) => {
            const m = String(row['Method'] || '').toLowerCase().trim();
            if (m !== 'site_specific') return;
            const customer = String(row['Customer Name'] || '').trim();
            const fuel = parseFloat(row['Fuel (tCO2e)'] || 0);
            const elec = parseFloat(row['Electricity (tCO2e)'] || 0);
            const waste = parseFloat(row['Waste (tCO2e)'] || 0);
            const alloc = parseFloat(row['Allocation %'] || 100) / 100;
            const desc = String(row['Description'] || '').trim();
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            const totalAllocated = (fuel + elec + waste) * alloc;
            if (totalAllocated <= 0) return;
            parsed.push({
              categoryCode: 'processing_sold', type: 'site_specific', quantity: totalAllocated, unit: 'tCO₂e',
              tco2e: totalAllocated,
              description: desc || `${customer}: F=${fuel}, E=${elec}, W=${waste} × ${(alloc * 100).toFixed(0)}%`,
              siteId: siteMatch?.id || null,
            });
          });
        }

        if (parsed.length === 0) {
          toast.error('No valid rows found. Check the template format.');
          return;
        }
        setImportPreview(parsed);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Bulk: Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.info('No entries to export'); return; }
    const wb = XLSX.utils.book_new();

    const avgEntries = entries.filter(e => e.type === 'average_data');
    const ssEntries = entries.filter(e => e.type === 'site_specific');

    if (avgEntries.length > 0) {
      const rows = avgEntries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return {
          'Method': 'average', 'Description': e.description, 'Mass (tonnes)': e.quantity,
          'tCO2e': parseFloat(e.tco2e.toFixed(6)), 'Site': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Average Data');
    }

    if (ssEntries.length > 0) {
      const rows = ssEntries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return {
          'Method': 'site_specific', 'Description': e.description, 'Allocated tCO2e': e.quantity,
          'tCO2e': parseFloat(e.tco2e.toFixed(6)), 'Site': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Site-Specific');
    }

    XLSX.writeFile(wb, 'cat10_processing_sold_export.xlsx');
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <div className="space-y-4">
      {/* Method Selector */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/30 border">
        <span className="text-sm font-medium">Method:</span>
        <Button
          variant={method === 'average' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('average')}
          className="gap-1"
        >
          <Factory className="h-4 w-4" /> Average-Data
          <Badge variant="secondary" className="ml-1 text-[10px]">Recommended</Badge>
        </Button>
        <Button
          variant={method === 'site_specific' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('site_specific')}
          className="gap-1"
        >
          <Zap className="h-4 w-4" /> Site-Specific
        </Button>
      </div>

      {/* Bulk Operations */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border">
        <span className="text-sm font-medium mr-2">Bulk Data:</span>
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
          <FileSpreadsheet className="h-4 w-4" /> Template
        </Button>
        <Button variant="outline" size="sm" className="gap-1" asChild>
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
          <Download className="h-4 w-4" /> Export ({entries.length})
        </Button>
      </div>

      {/* Import Preview */}
      {importPreview && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Import Preview — {importPreview.length} entries</CardTitle>
            <CardDescription>Review before confirming</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {importPreview.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">{e.type === 'average_data' ? '📊' : '🏭'} {e.description}</span>
                    <span className="text-muted-foreground ml-2">{e.quantity.toLocaleString()} {e.unit}</span>
                  </div>
                  <span className="font-semibold">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
            </div>
            <p className="text-sm font-medium">
              Total: {importPreview.reduce((s, e) => s + e.tco2e, 0).toFixed(4)} tCO₂e
            </p>
            <div className="flex gap-2">
              <Button onClick={() => { onAddBatch(importPreview); setImportPreview(null); toast.success(`Imported ${importPreview.length} entries`); }} className="gap-1">
                <Check className="h-4 w-4" /> Confirm Import
              </Button>
              <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── A. Average-Data Method ── */}
      {method === 'average' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="h-4 w-4" /> Average-Data Method
              <Badge variant="secondary" className="text-[10px]">Recommended</Badge>
            </CardTitle>
            <CardDescription>
              tCO₂e = Mass of Sold Product (tonnes) × Average Process Emission Factor (kg CO₂e/t) ÷ 1000
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Product Name</Label>
                <Input value={productName} onChange={e => { setProductName(e.target.value); setAiFactor(null); }} placeholder="e.g. Raw Sugar" />
              </div>
              <div className="space-y-2">
                <Label>Downstream Process</Label>
                <Input value={processDesc} onChange={e => { setProcessDesc(e.target.value); setAiFactor(null); }} placeholder="e.g. Sugar Refining" />
              </div>
              <div className="space-y-2">
                <Label>Mass Sold (tonnes)</Label>
                <Input type="number" value={mass} onChange={e => { setMass(e.target.value); setAiFactor(null); }} placeholder="0" />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  variant="outline"
                  onClick={fetchProcessFactor}
                  disabled={!productName || !mass || loading}
                  className="gap-1"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🤖'}
                  {loading ? 'Calculating...' : 'Get Factor'}
                </Button>
                <Button
                  onClick={addAverageEntry}
                  disabled={!aiFactor || !mass}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            {/* AI Result Display */}
            {aiFactor && mass && (
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
                <p className="text-sm font-medium">
                  {parseFloat(mass).toLocaleString()} tonnes × {aiFactor.emission_factor.toFixed(2)} kg CO₂e/t ÷ 1000 = <span className="font-bold">{aiFactor.tco2e.toFixed(4)} tCO₂e</span>
                </p>
                <p className="text-xs text-muted-foreground">Source: {aiFactor.source}</p>
                <p className="text-xs text-muted-foreground">Reasoning: {aiFactor.reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── B. Site-Specific Method ── */}
      {method === 'site_specific' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" /> Site-Specific Method
            </CardTitle>
            <CardDescription>
              Collect actual energy &amp; waste data from customers, then allocate your product's share.
              tCO₂e = (Fuel + Electricity + Waste) × Allocation %
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Acme Foods Ltd" />
              </div>
              <div className="space-y-2">
                <Label>Customer Fuel Emissions (tCO₂e)</Label>
                <Input type="number" value={fuelTco2e} onChange={e => setFuelTco2e(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Customer Electricity Emissions (tCO₂e)</Label>
                <Input type="number" value={electricityTco2e} onChange={e => setElectricityTco2e(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Customer Waste Emissions (tCO₂e)</Label>
                <Input type="number" value={wasteTco2e} onChange={e => setWasteTco2e(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Allocation % (your product's share)</Label>
                <Input type="number" value={allocationPct} onChange={e => setAllocationPct(e.target.value)} placeholder="e.g. 30" min="0" max="100" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={siteDesc} onChange={e => setSiteDesc(e.target.value)} placeholder="Notes" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={addSiteSpecificEntry}
                disabled={
                  (!fuelTco2e && !electricityTco2e && !wasteTco2e) ||
                  !allocationPct ||
                  (mode === 'site' && !selectedSiteId)
                }
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> Add Entry
              </Button>
              {fuelTco2e || electricityTco2e || wasteTco2e ? (
                <p className="text-xs text-muted-foreground">
                  ({parseFloat(fuelTco2e || '0').toFixed(2)} + {parseFloat(electricityTco2e || '0').toFixed(2)} + {parseFloat(wasteTco2e || '0').toFixed(2)})
                  × {parseFloat(allocationPct || '100')}%
                  = <span className="font-semibold">
                    {(
                      (parseFloat(fuelTco2e || '0') + parseFloat(electricityTco2e || '0') + parseFloat(wasteTco2e || '0')) *
                      (parseFloat(allocationPct || '100') / 100)
                    ).toFixed(4)} tCO₂e
                  </span>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

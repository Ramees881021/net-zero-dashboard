import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Globe, MapPin, Zap, Flame, Upload, Download, FileSpreadsheet, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FUEL_TYPES, GRID_REGIONS } from '@/lib/emission-factors';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

interface UseSoldFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
}

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

const FUEL_KEY_MAP: Record<string, string> = {};
Object.entries(FUEL_TYPES).forEach(([k, v]) => { FUEL_KEY_MAP[v.label.toLowerCase()] = k; });

const GRID_KEY_MAP: Record<string, string> = {};
Object.entries(GRID_REGIONS).forEach(([k, v]) => { GRID_KEY_MAP[v.label.toLowerCase()] = k; });

export const UseSoldForm = ({ onAdd, onAddBatch, sites, entries }: UseSoldFormProps) => {
  const [method, setMethod] = useState<'direct' | 'indirect'>('direct');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);

  // Direct Use state
  const [dProductName, setDProductName] = useState('');
  const [dUnitsSold, setDUnitsSold] = useState('');
  const [dLifetimeYears, setDLifetimeYears] = useState('');
  const [dAnnualFuelUse, setDAnnualFuelUse] = useState('');
  const [dFuelType, setDFuelType] = useState<string>('natural_gas');

  // Indirect Use state
  const [iProductName, setIProductName] = useState('');
  const [iUnitsSold, setIUnitsSold] = useState('');
  const [iLifetimeYears, setILifetimeYears] = useState('');
  const [iAnnualKwh, setIAnnualKwh] = useState('');
  const [iGridRegion, setIGridRegion] = useState<string>('uk');

  // Bulk import preview
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);

  const siteId = mode === 'site' ? selectedSiteId : null;

  // ── Direct Use: Add Entry ──
  const addDirectEntry = () => {
    const units = parseFloat(dUnitsSold || '0');
    const life = parseFloat(dLifetimeYears || '0');
    const annualUse = parseFloat(dAnnualFuelUse || '0');
    const fuel = FUEL_TYPES[dFuelType as keyof typeof FUEL_TYPES];
    if (!units || !life || !annualUse || !fuel) return;
    const tco2e = units * life * annualUse * fuel.factor;
    onAdd({
      categoryCode: 'use_sold',
      type: 'direct_use',
      quantity: units,
      unit: 'units',
      tco2e,
      description: `${dProductName || 'Product'}: ${units} units × ${life}yr × ${annualUse} ${fuel.unit}/yr ${fuel.label} = ${tco2e.toFixed(4)} tCO₂e`,
      siteId,
    });
    setDProductName(''); setDUnitsSold(''); setDLifetimeYears(''); setDAnnualFuelUse('');
    toast.success('Direct use entry added');
  };

  // ── Indirect Use: Add Entry ──
  const addIndirectEntry = () => {
    const units = parseFloat(iUnitsSold || '0');
    const life = parseFloat(iLifetimeYears || '0');
    const annualKwh = parseFloat(iAnnualKwh || '0');
    const grid = GRID_REGIONS[iGridRegion as keyof typeof GRID_REGIONS];
    if (!units || !life || !annualKwh || !grid) return;
    const tco2e = units * life * annualKwh * grid.factor;
    onAdd({
      categoryCode: 'use_sold',
      type: 'indirect_use',
      quantity: units,
      unit: 'units',
      tco2e,
      description: `${iProductName || 'Product'}: ${units} units × ${life}yr × ${annualKwh} kWh/yr (${grid.label}) = ${tco2e.toFixed(4)} tCO₂e`,
      siteId,
    });
    setIProductName(''); setIUnitsSold(''); setILifetimeYears(''); setIAnnualKwh('');
    toast.success('Indirect use entry added');
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    const dHeaders = ['Method', 'Product Name', 'Units Sold', 'Lifetime (years)', 'Annual Fuel Use', 'Fuel Type', 'Site Name'];
    const dExample = ['direct', 'Gas Boiler X100', '500', '10', '15000', 'Natural Gas', ''];
    const dWs = XLSX.utils.aoa_to_sheet([dHeaders, dExample]);
    dWs['!cols'] = dHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, dWs, 'Direct Use');

    const iHeaders = ['Method', 'Product Name', 'Units Sold', 'Lifetime (years)', 'Annual kWh Use', 'Grid Region', 'Site Name'];
    const iExample = ['indirect', 'Electric Heater EH200', '1000', '5', '1000', 'UK Grid', ''];
    const iWs = XLSX.utils.aoa_to_sheet([iHeaders, iExample]);
    iWs['!cols'] = iHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, iWs, 'Indirect Use');

    // Reference sheets
    const fuelRef = [['Fuel Type', 'Unit', 'Factor (tCO₂e)', 'Source'], ...Object.values(FUEL_TYPES).map(f => [f.label, f.unit, f.factor, f.source])];
    const fuelWs = XLSX.utils.aoa_to_sheet(fuelRef);
    fuelWs['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, fuelWs, 'Fuel Types');

    const gridRef = [['Grid Region', 'Factor (tCO₂e/kWh)', 'Source'], ...Object.values(GRID_REGIONS).map(g => [g.label, g.factor, g.source])];
    const gridWs = XLSX.utils.aoa_to_sheet(gridRef);
    gridWs['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, gridWs, 'Grid Regions');

    const refData = [
      ['Scope 3 Category 11: Use of Sold Products'],
      [],
      ['Method', 'Formula'],
      ['direct', 'Units Sold × Lifetime (yr) × Annual Fuel Use × Fuel Emission Factor'],
      ['indirect', 'Units Sold × Lifetime (yr) × Annual kWh Use × Grid Emission Factor'],
      [],
      ['Notes:'],
      ['- Direct Use: for products that consume fuels/emit GHGs directly (boilers, vehicles, refrigerants)'],
      ['- Indirect Use: for products that consume electricity (appliances, IT equipment, motors)'],
      ['- Use the Fuel Types and Grid Regions sheets for valid values'],
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 30 }, { wch: 70 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference');

    XLSX.writeFile(wb, 'cat11_use_of_sold_products_template.xlsx');
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

        // Direct Use sheet
        const directSheet = wb.Sheets['Direct Use'] || wb.Sheets[wb.SheetNames[0]];
        if (directSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(directSheet);
          rows.forEach((row: any) => {
            const m = String(row['Method'] || '').toLowerCase().trim();
            if (m !== 'direct') return;
            const product = String(row['Product Name'] || '').trim();
            const units = parseFloat(row['Units Sold'] || 0);
            const life = parseFloat(row['Lifetime (years)'] || 0);
            const annualUse = parseFloat(row['Annual Fuel Use'] || 0);
            const fuelLabel = String(row['Fuel Type'] || '').trim().toLowerCase();
            const fuelKey = FUEL_KEY_MAP[fuelLabel] || Object.keys(FUEL_TYPES).find(k => k === fuelLabel) || 'natural_gas';
            const fuel = FUEL_TYPES[fuelKey as keyof typeof FUEL_TYPES];
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            if (!units || !life || !annualUse) return;
            const tco2e = units * life * annualUse * fuel.factor;
            parsed.push({
              categoryCode: 'use_sold',
              type: 'direct_use',
              quantity: units,
              unit: 'units',
              tco2e,
              description: `${product || 'Product'}: ${units} units × ${life}yr × ${annualUse} ${fuel.unit}/yr ${fuel.label}`,
              siteId: siteMatch?.id || null,
            });
          });
        }

        // Indirect Use sheet
        const indirectSheet = wb.Sheets['Indirect Use'];
        if (indirectSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(indirectSheet);
          rows.forEach((row: any) => {
            const m = String(row['Method'] || '').toLowerCase().trim();
            if (m !== 'indirect') return;
            const product = String(row['Product Name'] || '').trim();
            const units = parseFloat(row['Units Sold'] || 0);
            const life = parseFloat(row['Lifetime (years)'] || 0);
            const annualKwh = parseFloat(row['Annual kWh Use'] || 0);
            const gridLabel = String(row['Grid Region'] || '').trim().toLowerCase();
            const gridKey = GRID_KEY_MAP[gridLabel] || Object.keys(GRID_REGIONS).find(k => k === gridLabel) || 'uk';
            const grid = GRID_REGIONS[gridKey as keyof typeof GRID_REGIONS];
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            if (!units || !life || !annualKwh) return;
            const tco2e = units * life * annualKwh * grid.factor;
            parsed.push({
              categoryCode: 'use_sold',
              type: 'indirect_use',
              quantity: units,
              unit: 'units',
              tco2e,
              description: `${product || 'Product'}: ${units} units × ${life}yr × ${annualKwh} kWh/yr (${grid.label})`,
              siteId: siteMatch?.id || null,
            });
          });
        }

        if (parsed.length === 0) {
          toast.error('No valid rows found');
          return;
        }
        setImportPreview(parsed);
        toast.info(`${parsed.length} entries ready for review`);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    onAddBatch(importPreview);
    toast.success(`${importPreview.length} entries imported`);
    setImportPreview(null);
  };

  // ── Bulk: Export ──
  const handleExport = () => {
    const catEntries = entries.filter(e => e.categoryCode === 'use_sold');
    if (catEntries.length === 0) { toast.info('No entries to export'); return; }
    const rows = catEntries.map(e => ({
      Method: e.type === 'direct_use' ? 'Direct' : 'Indirect',
      Description: e.description,
      Quantity: e.quantity,
      'tCO₂e': e.tco2e,
      Site: e.siteId ? sites.find(s => s.id === e.siteId)?.name || '' : 'Global',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Use of Sold Products');
    XLSX.writeFile(wb, 'cat11_use_of_sold_export.xlsx');
    toast.success('Exported');
  };

  const catTotal = entries.filter(e => e.categoryCode === 'use_sold').reduce((s, e) => s + e.tco2e, 0);

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base">Cat 11 — Use of Sold Products</h3>
          <p className="text-xs text-muted-foreground">Lifetime emissions from products sold during the reporting year</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Template
          </Button>
          <Button variant="outline" size="sm" className="gap-1" asChild>
            <label>
              <Upload className="h-3.5 w-3.5" /> Import
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          {catTotal > 0 && (
            <Badge variant="secondary" className="text-xs">{catTotal.toFixed(4)} tCO₂e</Badge>
          )}
        </div>
      </div>

      <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />

      {/* Import Preview */}
      {importPreview && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Import Preview — {importPreview.length} entries</CardTitle>
            <CardDescription className="text-xs">
              Total: {importPreview.reduce((s, e) => s + e.tco2e, 0).toFixed(4)} tCO₂e
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="max-h-48 overflow-y-auto space-y-1 text-xs">
              {importPreview.map((e, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-border/50">
                  <span className="truncate flex-1">{e.description}</span>
                  <Badge variant="outline" className="ml-2 shrink-0">{e.tco2e.toFixed(4)} tCO₂e</Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmImport} className="gap-1"><Check className="h-3.5 w-3.5" /> Confirm Import</Button>
              <Button size="sm" variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Method selector — equal preference */}
      <div className="flex gap-2">
        <Button variant={method === 'direct' ? 'default' : 'outline'} size="sm" onClick={() => setMethod('direct')} className="gap-1.5">
          <Flame className="h-3.5 w-3.5" /> A. Direct Use (Fuels/GHGs)
        </Button>
        <Button variant={method === 'indirect' ? 'default' : 'outline'} size="sm" onClick={() => setMethod('indirect')} className="gap-1.5">
          <Zap className="h-3.5 w-3.5" /> B. Indirect Use (Electricity)
        </Button>
      </div>

      {/* ─── Direct Use Form ─── */}
      {method === 'direct' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" /> Direct Use — Fuels & GHGs</CardTitle>
            <CardDescription className="text-xs">
              Units Sold × Lifetime (yr) × Annual Fuel Use × Fuel Emission Factor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Product Name</Label>
                <Input placeholder="e.g. Gas Boiler X100" value={dProductName} onChange={e => setDProductName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fuel Type</Label>
                <Select value={dFuelType} onValueChange={setDFuelType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FUEL_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} ({v.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Units Sold</Label>
                <Input type="number" min="0" placeholder="e.g. 500" value={dUnitsSold} onChange={e => setDUnitsSold(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Expected Lifetime (years)</Label>
                <Input type="number" min="0" placeholder="e.g. 10" value={dLifetimeYears} onChange={e => setDLifetimeYears(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Annual Fuel Use ({FUEL_TYPES[dFuelType as keyof typeof FUEL_TYPES]?.unit || 'units'}/yr)</Label>
                <Input type="number" min="0" placeholder="e.g. 15000" value={dAnnualFuelUse} onChange={e => setDAnnualFuelUse(e.target.value)} />
              </div>
            </div>

            {/* Live preview */}
            {parseFloat(dUnitsSold || '0') > 0 && parseFloat(dLifetimeYears || '0') > 0 && parseFloat(dAnnualFuelUse || '0') > 0 && (
              <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
                <p className="font-medium">Calculation Preview:</p>
                {(() => {
                  const u = parseFloat(dUnitsSold); const l = parseFloat(dLifetimeYears); const a = parseFloat(dAnnualFuelUse);
                  const f = FUEL_TYPES[dFuelType as keyof typeof FUEL_TYPES];
                  const tco2e = u * l * a * f.factor;
                  return (
                    <>
                      <p>{u.toLocaleString()} units × {l} yr × {a.toLocaleString()} {f.unit}/yr × {f.factor} tCO₂e/{f.unit}</p>
                      <p className="font-semibold text-sm">= {tco2e.toFixed(4)} tCO₂e</p>
                    </>
                  );
                })()}
              </div>
            )}

            <Button onClick={addDirectEntry} className="gap-1" disabled={!dUnitsSold || !dLifetimeYears || !dAnnualFuelUse}>
              <Plus className="h-4 w-4" /> Add Direct Use Entry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Indirect Use Form ─── */}
      {method === 'indirect' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Indirect Use — Electricity</CardTitle>
            <CardDescription className="text-xs">
              Units Sold × Lifetime (yr) × Annual kWh Use × Grid Emission Factor
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Product Name</Label>
                <Input placeholder="e.g. Electric Heater EH200" value={iProductName} onChange={e => setIProductName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Grid Region</Label>
                <Select value={iGridRegion} onValueChange={setIGridRegion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRID_REGIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} ({v.factor} tCO₂e/kWh)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Units Sold</Label>
                <Input type="number" min="0" placeholder="e.g. 1000" value={iUnitsSold} onChange={e => setIUnitsSold(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Expected Lifetime (years)</Label>
                <Input type="number" min="0" placeholder="e.g. 5" value={iLifetimeYears} onChange={e => setILifetimeYears(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Annual kWh Use</Label>
                <Input type="number" min="0" placeholder="e.g. 1000" value={iAnnualKwh} onChange={e => setIAnnualKwh(e.target.value)} />
              </div>
            </div>

            {/* Live preview */}
            {parseFloat(iUnitsSold || '0') > 0 && parseFloat(iLifetimeYears || '0') > 0 && parseFloat(iAnnualKwh || '0') > 0 && (
              <div className="p-3 rounded-lg bg-muted/40 border text-xs space-y-1">
                <p className="font-medium">Calculation Preview:</p>
                {(() => {
                  const u = parseFloat(iUnitsSold); const l = parseFloat(iLifetimeYears); const a = parseFloat(iAnnualKwh);
                  const g = GRID_REGIONS[iGridRegion as keyof typeof GRID_REGIONS];
                  const tco2e = u * l * a * g.factor;
                  return (
                    <>
                      <p>{u.toLocaleString()} units × {l} yr × {a.toLocaleString()} kWh/yr × {g.factor} tCO₂e/kWh ({g.label})</p>
                      <p className="font-semibold text-sm">= {tco2e.toFixed(4)} tCO₂e</p>
                    </>
                  );
                })()}
              </div>
            )}

            <Button onClick={addIndirectEntry} className="gap-1" disabled={!iUnitsSold || !iLifetimeYears || !iAnnualKwh}>
              <Plus className="h-4 w-4" /> Add Indirect Use Entry
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

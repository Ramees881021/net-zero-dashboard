import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Globe, MapPin, CheckCircle, Circle, Upload, Download, FileSpreadsheet, X, Check, AlertCircle, Store } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { FUEL_TYPES, GRID_REGIONS, SPEND_FACTORS } from '@/lib/emission-factors';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

type Method = 'franchisee_specific' | 'average_data' | 'spend_based';

interface FranchisesFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries?: Scope3Entry[];
}

const METHODS: { key: Method; label: string; description: string }[] = [
  { key: 'franchisee_specific', label: 'Franchisee-Specific', description: 'Collect actual fuel & electricity data from each franchise location. Gold standard.' },
  { key: 'average_data', label: 'Average-Data', description: 'Estimate using number of franchise stores, average floor space, and energy intensity factors.' },
  { key: 'spend_based', label: 'Spend-Based', description: 'Use franchisee revenue or fees paid, multiplied by EEIO sector emission factors.' },
];

// Franchise store types for average-data method
const STORE_TYPES = [
  { key: 'small_retail', label: 'Small Retail (<200m²)', avgKwhPerM2: 250, source: 'CIBSE TM46' },
  { key: 'large_retail', label: 'Large Retail (200-1000m²)', avgKwhPerM2: 300, source: 'CIBSE TM46' },
  { key: 'restaurant_qsr', label: 'Quick-Service Restaurant', avgKwhPerM2: 550, source: 'CIBSE TM46' },
  { key: 'restaurant_casual', label: 'Casual Dining Restaurant', avgKwhPerM2: 450, source: 'CIBSE TM46' },
  { key: 'hotel_small', label: 'Hotel (small, <50 rooms)', avgKwhPerM2: 280, source: 'CIBSE TM46' },
  { key: 'hotel_large', label: 'Hotel (large, 50+ rooms)', avgKwhPerM2: 320, source: 'CIBSE TM46' },
  { key: 'convenience_store', label: 'Convenience Store', avgKwhPerM2: 400, source: 'CIBSE TM46' },
  { key: 'gym_fitness', label: 'Gym / Fitness Centre', avgKwhPerM2: 200, source: 'CIBSE TM46' },
  { key: 'office_service', label: 'Office / Service Centre', avgKwhPerM2: 150, source: 'CIBSE TM46' },
] as const;

// Fuel types for franchisee-specific (Scope 1)
const FUEL_KEYS = Object.entries(FUEL_TYPES).map(([key, v]) => ({ key, label: v.label, unit: v.unit, factor: v.factor }));

// Grid regions for franchisee-specific (Scope 2)
const GRID_KEYS = Object.entries(GRID_REGIONS).map(([key, v]) => ({ key, label: v.label, factor: v.factor }));

// EEIO factors for spend-based (tCO₂e per £/$1000)
const FRANCHISE_SECTORS = [
  { key: 'food_beverage', label: 'Food & Beverage Service', factor: 0.39, source: 'USEEIO v2.0' },
  { key: 'retail_general', label: 'Retail (General)', factor: 0.28, source: 'USEEIO v2.0' },
  { key: 'accommodation', label: 'Accommodation', factor: 0.32, source: 'USEEIO v2.0' },
  { key: 'automotive_services', label: 'Automotive Services', factor: 0.35, source: 'USEEIO v2.0' },
  { key: 'personal_services', label: 'Personal Services', factor: 0.22, source: 'USEEIO v2.0' },
  { key: 'business_services', label: 'Business Services', factor: 0.28, source: 'USEEIO v2.0' },
  { key: 'education_training', label: 'Education & Training', factor: 0.18, source: 'USEEIO v2.0' },
  { key: 'health_fitness', label: 'Health & Fitness', factor: 0.20, source: 'USEEIO v2.0' },
] as const;

export const FranchisesForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: FranchisesFormProps) => {
  const [selectedMethod, setSelectedMethod] = useState<Method>('franchisee_specific');

  // Franchisee-specific state
  const [franchiseeName, setFranchiseeName] = useState('');
  const [energyType, setEnergyType] = useState<'fuel' | 'electricity'>('electricity');
  const [fuelKey, setFuelKey] = useState('');
  const [gridKey, setGridKey] = useState('uk');
  const [quantity, setQuantity] = useState('');

  // Average-data state
  const [storeType, setStoreType] = useState('');
  const [numStores, setNumStores] = useState('');
  const [avgFloorArea, setAvgFloorArea] = useState('');
  const [avgGridKey, setAvgGridKey] = useState('uk');

  // Spend-based state
  const [sector, setSector] = useState('');
  const [revenue, setRevenue] = useState('');

  // Common
  const [description, setDescription] = useState('');
  const [dataMode, setDataMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calculations
  const calculatedEmission = useMemo(() => {
    if (selectedMethod === 'franchisee_specific') {
      const qty = parseFloat(quantity) || 0;
      if (energyType === 'fuel') {
        const f = FUEL_KEYS.find(f => f.key === fuelKey);
        return f ? qty * f.factor : 0;
      }
      const g = GRID_KEYS.find(g => g.key === gridKey);
      return g ? qty * g.factor : 0;
    }
    if (selectedMethod === 'average_data') {
      const st = STORE_TYPES.find(s => s.key === storeType);
      const n = parseFloat(numStores) || 0;
      const area = parseFloat(avgFloorArea) || 0;
      const g = GRID_KEYS.find(g => g.key === avgGridKey);
      if (!st || !n || !area || !g) return 0;
      // Total kWh = stores × area × kWh/m²/year
      const totalKwh = n * area * st.avgKwhPerM2;
      return totalKwh * g.factor;
    }
    if (selectedMethod === 'spend_based') {
      const s = FRANCHISE_SECTORS.find(s => s.key === sector);
      const rev = parseFloat(revenue) || 0;
      return s ? (rev / 1000) * s.factor : 0;
    }
    return 0;
  }, [selectedMethod, quantity, energyType, fuelKey, gridKey, storeType, numStores, avgFloorArea, avgGridKey, sector, revenue]);

  const canAdd = useMemo(() => {
    if (selectedMethod === 'franchisee_specific') {
      return !!(parseFloat(quantity) > 0 && (energyType === 'fuel' ? fuelKey : gridKey));
    }
    if (selectedMethod === 'average_data') {
      return !!(storeType && parseFloat(numStores) > 0 && parseFloat(avgFloorArea) > 0);
    }
    if (selectedMethod === 'spend_based') {
      return !!(sector && parseFloat(revenue) > 0);
    }
    return false;
  }, [selectedMethod, quantity, energyType, fuelKey, gridKey, storeType, numStores, avgFloorArea, sector, revenue]);

  const handleAdd = () => {
    if (!canAdd) return;

    let autoDesc = '';
    let type = '';
    let unit = '';
    let qty = 0;

    if (selectedMethod === 'franchisee_specific') {
      type = `franchisee_${energyType}`;
      qty = parseFloat(quantity);
      if (energyType === 'fuel') {
        const f = FUEL_KEYS.find(f => f.key === fuelKey);
        unit = f?.unit || '';
        autoDesc = `${franchiseeName || 'Franchise'}: ${f?.label || fuelKey} (${qty.toLocaleString()} ${unit})`;
      } else {
        unit = 'kWh';
        const g = GRID_KEYS.find(g => g.key === gridKey);
        autoDesc = `${franchiseeName || 'Franchise'}: Electricity ${g?.label || ''} (${qty.toLocaleString()} kWh)`;
      }
    } else if (selectedMethod === 'average_data') {
      const st = STORE_TYPES.find(s => s.key === storeType);
      const n = parseFloat(numStores);
      const area = parseFloat(avgFloorArea);
      type = 'average_data';
      qty = n * area * (st?.avgKwhPerM2 || 0);
      unit = 'kWh (estimated)';
      autoDesc = `${n} × ${st?.label || storeType} (${area}m² avg) → ${qty.toLocaleString()} kWh`;
    } else {
      const s = FRANCHISE_SECTORS.find(s => s.key === sector);
      type = 'spend_based';
      qty = parseFloat(revenue);
      unit = '£/$';
      autoDesc = `Franchise revenue: ${qty.toLocaleString()} × ${s?.label || sector}`;
    }

    onAdd({
      categoryCode: 'franchises',
      type,
      quantity: qty,
      unit,
      tco2e: calculatedEmission,
      description: description || autoDesc,
      siteId: dataMode === 'site' ? selectedSiteId : null,
    });

    // Reset
    setFranchiseeName(''); setQuantity('');
    setNumStores(''); setAvgFloorArea('');
    setRevenue(''); setDescription('');
    toast.success('Entry added');
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Franchisee-Specific sheet
    const fsHeaders = ['Franchise Name', 'Energy Type (fuel/electricity)', 'Fuel Key', 'Grid Region', 'Quantity', 'Description'];
    const fsExample = ['Store London', 'electricity', '', 'uk', '50000', 'Annual electricity'];
    const fsExample2 = ['Store Manchester', 'fuel', 'natural_gas', '', '120000', 'Annual gas kWh'];
    const fsSheet = XLSX.utils.aoa_to_sheet([fsHeaders, fsExample, fsExample2]);
    fsSheet['!cols'] = fsHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, fsSheet, 'Franchisee-Specific');

    // Average-Data sheet
    const adHeaders = ['Store Type', 'Number of Stores', 'Avg Floor Area (m²)', 'Grid Region', 'Description'];
    const adExample = ['restaurant_qsr', '50', '120', 'uk', '50 QSR outlets'];
    const adSheet = XLSX.utils.aoa_to_sheet([adHeaders, adExample]);
    adSheet['!cols'] = adHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, adSheet, 'Average-Data');

    // Spend-Based sheet
    const sbHeaders = ['Sector', 'Revenue (£/$)', 'Description'];
    const sbExample = ['food_beverage', '5000000', 'Annual franchise revenue'];
    const sbSheet = XLSX.utils.aoa_to_sheet([sbHeaders, sbExample]);
    sbSheet['!cols'] = sbHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, sbSheet, 'Spend-Based');

    // Reference: Store Types
    const stRef = STORE_TYPES.map(s => [s.key, s.label, s.avgKwhPerM2, s.source]);
    const stSheet = XLSX.utils.aoa_to_sheet([['Key', 'Store Type', 'Avg kWh/m²/yr', 'Source'], ...stRef]);
    stSheet['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, stSheet, 'REF - Store Types');

    // Reference: Fuel Types
    const ftRef = FUEL_KEYS.map(f => [f.key, f.label, f.unit, f.factor]);
    const ftSheet = XLSX.utils.aoa_to_sheet([['Key', 'Fuel', 'Unit', 'Factor (tCO₂e)'], ...ftRef]);
    ftSheet['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ftSheet, 'REF - Fuels (DEFRA 2025)');

    // Reference: Grid Regions
    const grRef = GRID_KEYS.map(g => [g.key, g.label, g.factor]);
    const grSheet = XLSX.utils.aoa_to_sheet([['Key', 'Region', 'Factor (tCO₂e/kWh)'], ...grRef]);
    grSheet['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, grSheet, 'REF - Grid Regions');

    // Reference: Sectors
    const secRef = FRANCHISE_SECTORS.map(s => [s.key, s.label, s.factor, s.source]);
    const secSheet = XLSX.utils.aoa_to_sheet([['Key', 'Sector', 'Factor (tCO₂e/£1000)', 'Source'], ...secRef]);
    secSheet['!cols'] = [{ wch: 20 }, { wch: 28 }, { wch: 20 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, secSheet, 'REF - Sectors');

    XLSX.writeFile(wb, 'Cat14_Franchises_Template.xlsx');
    toast.success('Template downloaded');
  };

  // ── Bulk: Import ──
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' });
        const parsed: Omit<Scope3Entry, 'id'>[] = [];

        // Parse Franchisee-Specific
        const fsSheet = wb.Sheets['Franchisee-Specific'];
        if (fsSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(fsSheet);
          rows.forEach(row => {
            const eType = String(row['Energy Type (fuel/electricity)'] || '').toLowerCase().trim();
            const qty = parseFloat(row['Quantity']) || 0;
            if (!qty) return;

            if (eType === 'fuel') {
              const fKey = String(row['Fuel Key'] || '').toLowerCase().trim();
              const f = FUEL_KEYS.find(f => f.key === fKey || f.label.toLowerCase() === fKey);
              if (!f) return;
              parsed.push({
                categoryCode: 'franchises',
                type: 'franchisee_fuel',
                quantity: qty,
                unit: f.unit,
                tco2e: qty * f.factor,
                description: row['Description'] || `${row['Franchise Name'] || 'Franchise'}: ${f.label}`,
                siteId: dataMode === 'site' ? selectedSiteId : null,
              });
            } else {
              const gKey = String(row['Grid Region'] || 'uk').toLowerCase().trim();
              const g = GRID_KEYS.find(g => g.key === gKey || g.label.toLowerCase() === gKey);
              const factor = g?.factor || GRID_REGIONS.uk.factor;
              parsed.push({
                categoryCode: 'franchises',
                type: 'franchisee_electricity',
                quantity: qty,
                unit: 'kWh',
                tco2e: qty * factor,
                description: row['Description'] || `${row['Franchise Name'] || 'Franchise'}: Electricity`,
                siteId: dataMode === 'site' ? selectedSiteId : null,
              });
            }
          });
        }

        // Parse Average-Data
        const adSheet = wb.Sheets['Average-Data'];
        if (adSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(adSheet);
          rows.forEach(row => {
            const stKey = String(row['Store Type'] || '').toLowerCase().trim();
            const n = parseFloat(row['Number of Stores']) || 0;
            const area = parseFloat(row['Avg Floor Area (m²)']) || 0;
            if (!n || !area) return;
            const st = STORE_TYPES.find(s => s.key === stKey || s.label.toLowerCase() === stKey);
            if (!st) return;
            const gKey = String(row['Grid Region'] || 'uk').toLowerCase().trim();
            const g = GRID_KEYS.find(g => g.key === gKey) || GRID_KEYS.find(g => g.key === 'uk')!;
            const totalKwh = n * area * st.avgKwhPerM2;
            parsed.push({
              categoryCode: 'franchises',
              type: 'average_data',
              quantity: totalKwh,
              unit: 'kWh (estimated)',
              tco2e: totalKwh * g.factor,
              description: row['Description'] || `${n} × ${st.label} (${area}m²)`,
              siteId: dataMode === 'site' ? selectedSiteId : null,
            });
          });
        }

        // Parse Spend-Based
        const sbSheet = wb.Sheets['Spend-Based'];
        if (sbSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(sbSheet);
          rows.forEach(row => {
            const secKey = String(row['Sector'] || '').toLowerCase().trim();
            const rev = parseFloat(row['Revenue (£/$)']) || 0;
            if (!rev) return;
            const s = FRANCHISE_SECTORS.find(s => s.key === secKey || s.label.toLowerCase() === secKey);
            if (!s) return;
            parsed.push({
              categoryCode: 'franchises',
              type: 'spend_based',
              quantity: rev,
              unit: '£/$',
              tco2e: (rev / 1000) * s.factor,
              description: row['Description'] || `Franchise revenue: ${rev.toLocaleString()} × ${s.label}`,
              siteId: dataMode === 'site' ? selectedSiteId : null,
            });
          });
        }

        if (parsed.length === 0) {
          toast.error('No valid rows found. Check column headers match the template.');
          return;
        }
        setImportPreview(parsed);
      } catch {
        toast.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPreview || !onAddBatch) return;
    onAddBatch(importPreview);
    toast.success(`Imported ${importPreview.length} entries`);
    setImportPreview(null);
  };

  // ── Bulk: Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.error('No entries to export'); return; }
    const rows = entries.map(e => ({
      'Method': e.type.includes('franchisee') ? 'Franchisee-Specific' : e.type === 'average_data' ? 'Average-Data' : 'Spend-Based',
      'Description': e.description,
      'Quantity': e.quantity,
      'Unit': e.unit,
      'tCO₂e': e.tco2e,
      'Data Level': e.siteId ? `Site: ${sites.find(s => s.id === e.siteId)?.name || e.siteId}` : 'Global',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Franchise Entries');
    XLSX.writeFile(wb, 'Cat14_Franchises_Export.xlsx');
    toast.success('Exported');
  };

  const totalEntries = entries.reduce((s, e) => s + e.tco2e, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Store className="h-4 w-4" /> 14. Franchises
            </CardTitle>
            <CardDescription>Scope 1 & 2 emissions from your franchisees' operations</CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {totalEntries > 0 && (
              <Badge variant="secondary">{totalEntries.toFixed(3)} tCO₂e</Badge>
            )}
            <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
              <Upload className="h-3.5 w-3.5" /> Import
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Import Preview */}
        {importPreview && (
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Import Preview — {importPreview.length} entries ({importPreview.reduce((s, e) => s + e.tco2e, 0).toFixed(3)} tCO₂e)
              </h4>
              <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {importPreview.slice(0, 20).map((e, i) => (
                <div key={i} className="flex justify-between text-xs p-1.5 rounded bg-background/50">
                  <span className="truncate max-w-[60%]">{e.description}</span>
                  <span className="font-medium">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
              {importPreview.length > 20 && <p className="text-xs text-muted-foreground">...and {importPreview.length - 20} more</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmImport} className="gap-1"><Check className="h-3.5 w-3.5" /> Add All</Button>
              <Button variant="outline" size="sm" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Data level */}
        <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-muted/30 border">
          <span className="text-xs text-muted-foreground">Data level:</span>
          <Button variant={dataMode === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setDataMode('global')} className="gap-1">
            <Globe className="h-3.5 w-3.5" /> Global
          </Button>
          <Button variant={dataMode === 'site' ? 'default' : 'outline'} size="sm" onClick={() => setDataMode('site')} className="gap-1" disabled={sites.length === 0}>
            <MapPin className="h-3.5 w-3.5" /> Site-level
          </Button>
          {dataMode === 'site' && sites.length > 0 && (
            <Select value={selectedSiteId || ''} onValueChange={v => setSelectedSiteId(v)}>
              <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Select site" /></SelectTrigger>
              <SelectContent>
                {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Method selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {METHODS.map(m => (
            <button
              key={m.key}
              onClick={() => setSelectedMethod(m.key)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                selectedMethod === m.key
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {selectedMethod === m.key ? <CheckCircle className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-medium">{m.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.description}</p>
            </button>
          ))}
        </div>

        {/* ── Method A: Franchisee-Specific ── */}
        {selectedMethod === 'franchisee_specific' && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
            <h4 className="text-sm font-semibold">Franchisee-Specific: Actual Energy Data</h4>
            <p className="text-xs text-muted-foreground">
              CO₂e = Actual Fuel/Electricity Used × Emission Factor
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Franchise Name</Label>
                <Input placeholder="e.g. Store London" value={franchiseeName} onChange={e => setFranchiseeName(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Energy Type</Label>
                <Select value={energyType} onValueChange={v => setEnergyType(v as 'fuel' | 'electricity')}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electricity">Electricity (Scope 2)</SelectItem>
                    <SelectItem value="fuel">Fuel (Scope 1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {energyType === 'fuel' ? (
                <div className="space-y-1">
                  <Label className="text-xs">Fuel Type</Label>
                  <Select value={fuelKey} onValueChange={setFuelKey}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Select fuel" /></SelectTrigger>
                    <SelectContent>
                      {FUEL_KEYS.map(f => <SelectItem key={f.key} value={f.key}>{f.label} ({f.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Grid Region</Label>
                  <Select value={gridKey} onValueChange={setGridKey}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRID_KEYS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">
                  Quantity ({energyType === 'fuel' ? (FUEL_KEYS.find(f => f.key === fuelKey)?.unit || 'units') : 'kWh'})
                </Label>
                <Input type="number" min="0" placeholder="0" value={quantity} onChange={e => setQuantity(e.target.value)} className="h-8" />
              </div>
            </div>
          </div>
        )}

        {/* ── Method B: Average-Data ── */}
        {selectedMethod === 'average_data' && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
            <h4 className="text-sm font-semibold">Average-Data: Estimated by Store Type</h4>
            <p className="text-xs text-muted-foreground">
              CO₂e = Number of Stores × Avg Floor Area × Energy Intensity (kWh/m²/yr) × Grid Factor
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Store Type</Label>
                <Select value={storeType} onValueChange={setStoreType}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {STORE_TYPES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Number of Stores</Label>
                <Input type="number" min="1" placeholder="e.g. 50" value={numStores} onChange={e => setNumStores(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Avg Floor Area (m²)</Label>
                <Input type="number" min="1" placeholder="e.g. 120" value={avgFloorArea} onChange={e => setAvgFloorArea(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grid Region</Label>
                <Select value={avgGridKey} onValueChange={setAvgGridKey}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRID_KEYS.map(g => <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {storeType && (
              <p className="text-xs text-muted-foreground">
                Energy intensity: {STORE_TYPES.find(s => s.key === storeType)?.avgKwhPerM2} kWh/m²/year ({STORE_TYPES.find(s => s.key === storeType)?.source})
              </p>
            )}
          </div>
        )}

        {/* ── Method C: Spend-Based ── */}
        {selectedMethod === 'spend_based' && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/10">
            <h4 className="text-sm font-semibold">Spend-Based: Revenue × EEIO Factor</h4>
            <p className="text-xs text-muted-foreground">
              CO₂e = Franchisee Total Revenue × EEIO Factor for Sector
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Franchise Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select sector" /></SelectTrigger>
                  <SelectContent>
                    {FRANCHISE_SECTORS.map(s => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label} ({s.factor} tCO₂e/£1000)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Franchise Revenue (£/$)</Label>
                <Input type="number" min="0" placeholder="e.g. 5000000" value={revenue} onChange={e => setRevenue(e.target.value)} className="h-8" />
              </div>
            </div>
          </div>
        )}

        {/* Description + Add */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Description (optional)</Label>
            <Input placeholder="Auto-generated if blank" value={description} onChange={e => setDescription(e.target.value)} className="h-8" />
          </div>
          <div className="text-right mr-2 min-w-[120px]">
            <p className="text-lg font-bold">{calculatedEmission.toFixed(4)}</p>
            <p className="text-xs text-muted-foreground">tCO₂e</p>
          </div>
          <Button onClick={handleAdd} disabled={!canAdd} className="gap-1">
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

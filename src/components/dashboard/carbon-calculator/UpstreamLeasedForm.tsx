import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Upload, FileSpreadsheet, Globe, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FUEL_TYPES, GRID_REGIONS } from '@/lib/emission-factors';
import type { Site } from './SiteManager';
import type { Scope3Entry } from './Scope3Form';

interface Props {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
  direction?: 'upstream' | 'downstream';
  categoryCode?: string;
}

type Method = 'asset_specific' | 'lessor_allocation' | 'average_data';

// Energy intensity factors (kWh/m²/yr) by asset type — CIBSE / IEA benchmarks
const ASSET_TYPES: Record<string, { label: string; electricity: number; gas: number }> = {
  office: { label: 'Office', electricity: 120, gas: 80 },
  warehouse: { label: 'Warehouse / Distribution', electricity: 55, gas: 100 },
  retail: { label: 'Retail', electricity: 165, gas: 120 },
  data_centre: { label: 'Data Centre', electricity: 450, gas: 10 },
  factory: { label: 'Factory / Light Industrial', electricity: 130, gas: 150 },
  lab: { label: 'Laboratory', electricity: 250, gas: 120 },
  mixed_use: { label: 'Mixed Use', electricity: 140, gas: 95 },
};

const ENERGY_TYPES: Record<string, { label: string; unit: string; factor: number }> = {
  electricity: { label: 'Electricity (kWh)', unit: 'kWh', factor: 0 }, // uses grid region
  natural_gas: { label: 'Natural Gas (kWh)', unit: 'kWh', factor: FUEL_TYPES.natural_gas.factor },
  diesel: { label: 'Diesel (litres)', unit: 'litres', factor: FUEL_TYPES.diesel.factor },
  fuel_oil: { label: 'Fuel Oil (litres)', unit: 'litres', factor: FUEL_TYPES.fuel_oil.factor },
};

const genId = () => crypto.randomUUID();

export const UpstreamLeasedForm = ({ onAdd, onAddBatch, sites, entries, direction = 'upstream', categoryCode: catCodeProp }: Props) => {
  const catCode = catCodeProp || (direction === 'downstream' ? 'downstream_leased' : 'upstream_leased');
  const isDownstream = direction === 'downstream';
  const dirLabel = isDownstream ? 'Downstream' : 'Upstream';
  const catNum = isDownstream ? 'Cat13' : 'Cat8';
  const [method, setMethod] = useState<Method>('asset_specific');
  const [dataMode, setDataMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id || null);

  // Asset-specific fields
  const [assetName, setAssetName] = useState('');
  const [energyType, setEnergyType] = useState('electricity');
  const [gridRegion, setGridRegion] = useState('uk');
  const [consumption, setConsumption] = useState('');

  // Lessor allocation fields
  const [buildingName, setBuildingName] = useState('');
  const [totalEmissions, setTotalEmissions] = useState('');
  const [yourArea, setYourArea] = useState('');
  const [totalArea, setTotalArea] = useState('');

  // Average-data fields
  const [avgAssetName, setAvgAssetName] = useState('');
  const [assetType, setAssetType] = useState('office');
  const [floorSpace, setFloorSpace] = useState('');
  const [avgGridRegion, setAvgGridRegion] = useState('uk');

  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const siteId = dataMode === 'site' ? selectedSiteId : null;

  const handleAddAssetSpecific = () => {
    const qty = parseFloat(consumption);
    if (!qty || !assetName) return;
    const et = ENERGY_TYPES[energyType];
    let factor = et.factor;
    if (energyType === 'electricity') {
      factor = GRID_REGIONS[gridRegion as keyof typeof GRID_REGIONS]?.factor || 0.000177;
    }
    const tco2e = qty * factor;
    onAdd({
      categoryCode: catCode,
      type: `asset_specific|${energyType}`,
      quantity: qty,
      unit: et.unit,
      tco2e,
      description: `${assetName} — ${et.label}`,
      siteId,
    });
    setAssetName(''); setConsumption('');
    toast.success(`Added: ${tco2e.toFixed(4)} tCO₂e`);
  };

  const handleAddLessorAllocation = () => {
    const te = parseFloat(totalEmissions);
    const ya = parseFloat(yourArea);
    const ta = parseFloat(totalArea);
    if (!te || !ya || !ta || ta === 0 || !buildingName) return;
    const tco2e = te * (ya / ta);
    onAdd({
      categoryCode: catCode,
      type: 'lessor_allocation',
      quantity: ya,
      unit: 'sq m',
      tco2e,
      description: `${buildingName} — ${ya}/${ta} sq m allocation`,
      siteId,
    });
    setBuildingName(''); setTotalEmissions(''); setYourArea(''); setTotalArea('');
    toast.success(`Added: ${tco2e.toFixed(4)} tCO₂e`);
  };

  const handleAddAverageData = () => {
    const area = parseFloat(floorSpace);
    if (!area || !avgAssetName) return;
    const at = ASSET_TYPES[assetType];
    const gridFactor = GRID_REGIONS[avgGridRegion as keyof typeof GRID_REGIONS]?.factor || 0.000177;
    const gasFactor = FUEL_TYPES.natural_gas.factor;
    const tco2e = (area * at.electricity * gridFactor) + (area * at.gas * gasFactor);
    onAdd({
      categoryCode: catCode,
      type: `average_data|${assetType}`,
      quantity: area,
      unit: 'sq m',
      tco2e,
      description: `${avgAssetName} — ${at.label} (${area} sq m)`,
      siteId,
    });
    setAvgAssetName(''); setFloorSpace('');
    toast.success(`Added: ${tco2e.toFixed(4)} tCO₂e`);
  };

  // ── Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    const assetRows = [
      ['Asset Name', 'Energy Type', 'Grid Region (if electricity)', 'Consumption', 'Description'],
      ['HQ Office Electricity', 'electricity', 'uk', 50000, 'Annual electricity for leased HQ'],
      ['Warehouse Gas', 'natural_gas', '', 12000, 'Gas heating for leased warehouse'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(assetRows), 'Asset-Specific');

    const lessorRows = [
      ['Building Name', 'Total Building Emissions (tCO₂e)', 'Your Area (sq m)', 'Total Building Area (sq m)', 'Description'],
      ['City Tower', 500, 2000, 20000, 'Leased 2 floors'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lessorRows), 'Lessor-Allocation');

    const avgRows = [
      ['Asset Name', 'Asset Type', 'Floor Space (sq m)', 'Grid Region', 'Description'],
      ['Regional Office', 'office', 800, 'uk', 'Small leased office'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(avgRows), 'Average-Data');

    // Reference sheets
    const energyRef = Object.entries(ENERGY_TYPES).map(([k, v]) => [k, v.label, v.unit, v.factor]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Key', 'Label', 'Unit', 'Factor (tCO₂e)'], ...energyRef]), 'Ref-EnergyTypes');

    const assetRef = Object.entries(ASSET_TYPES).map(([k, v]) => [k, v.label, v.electricity, v.gas]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Key', 'Label', 'Elec kWh/m²/yr', 'Gas kWh/m²/yr'], ...assetRef]), 'Ref-AssetTypes');

    const gridRef = Object.entries(GRID_REGIONS).map(([k, v]) => [k, v.label, v.factor]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Key', 'Label', 'Factor (tCO₂e/kWh)'], ...gridRef]), 'Ref-GridRegions');

    XLSX.writeFile(wb, `${catNum}_${dirLabel}LeasedAssets_Template.xlsx`);
    toast.success('Template downloaded');
  };

  // ── Import ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' });
      const parsed: Omit<Scope3Entry, 'id'>[] = [];

      // Asset-Specific sheet
      const asSheet = wb.Sheets['Asset-Specific'];
      if (asSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(asSheet);
        rows.forEach((r: any) => {
          const qty = parseFloat(r['Consumption']);
          const eType = r['Energy Type'] || 'electricity';
          if (!qty) return;
          const et = ENERGY_TYPES[eType] || ENERGY_TYPES.electricity;
          let factor = et.factor;
          if (eType === 'electricity') {
            const gr = r['Grid Region (if electricity)'] || 'uk';
            factor = GRID_REGIONS[gr as keyof typeof GRID_REGIONS]?.factor || 0.000177;
          }
          parsed.push({
            categoryCode: catCode,
            type: `asset_specific|${eType}`,
            quantity: qty,
            unit: et.unit,
            tco2e: qty * factor,
            description: r['Description'] || r['Asset Name'] || '',
            siteId: null,
          });
        });
      }

      // Lessor-Allocation sheet
      const laSheet = wb.Sheets['Lessor-Allocation'];
      if (laSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(laSheet);
        rows.forEach((r: any) => {
          const te = parseFloat(r['Total Building Emissions (tCO₂e)']);
          const ya = parseFloat(r['Your Area (sq m)']);
          const ta = parseFloat(r['Total Building Area (sq m)']);
          if (!te || !ya || !ta || ta === 0) return;
          parsed.push({
            categoryCode: catCode,
            type: 'lessor_allocation',
            quantity: ya,
            unit: 'sq m',
            tco2e: te * (ya / ta),
            description: r['Description'] || r['Building Name'] || '',
            siteId: null,
          });
        });
      }

      // Average-Data sheet
      const adSheet = wb.Sheets['Average-Data'];
      if (adSheet) {
        const rows = XLSX.utils.sheet_to_json<any>(adSheet);
        rows.forEach((r: any) => {
          const area = parseFloat(r['Floor Space (sq m)']);
          const aType = r['Asset Type'] || 'office';
          const gr = r['Grid Region'] || 'uk';
          if (!area) return;
          const at = ASSET_TYPES[aType] || ASSET_TYPES.office;
          const gridFactor = GRID_REGIONS[gr as keyof typeof GRID_REGIONS]?.factor || 0.000177;
          const gasFactor = FUEL_TYPES.natural_gas.factor;
          parsed.push({
            categoryCode: catCode,
            type: `average_data|${aType}`,
            quantity: area,
            unit: 'sq m',
            tco2e: (area * at.electricity * gridFactor) + (area * at.gas * gasFactor),
            description: r['Description'] || r['Asset Name'] || '',
            siteId: null,
          });
        });
      }

      if (parsed.length === 0) {
        toast.error('No valid rows found');
      } else {
        setImportPreview(parsed);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.error('No entries to export'); return; }
    const rows = entries.map(e => ({
      Method: e.type.split('|')[0],
      'Sub Type': e.type.split('|')[1] || '',
      Quantity: e.quantity,
      Unit: e.unit,
      'tCO₂e': e.tco2e,
      Description: e.description,
      Site: e.siteId ? sites.find(s => s.id === e.siteId)?.name || '' : 'Global',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), `${dirLabel}LeasedAssets`);
    XLSX.writeFile(wb, `${catNum}_${dirLabel}LeasedAssets_Export.xlsx`);
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
          <FileSpreadsheet className="h-4 w-4" /> Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
          <Upload className="h-4 w-4" /> Import Data
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1">
          <Download className="h-4 w-4" /> Export Data
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      </div>

      {/* Import preview */}
      {importPreview && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Import Preview — {importPreview.length} entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-60 overflow-y-auto space-y-1">
              {importPreview.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <span className="truncate flex-1">{e.description}</span>
                  <span className="font-mono ml-2">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onAddBatch(importPreview); setImportPreview(null); toast.success(`Added ${importPreview.length} entries`); }}>
                Add All
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data mode selector */}
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
              {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Method selector */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'asset_specific' as Method, label: 'A. Asset-Specific (Activity)', desc: 'Actual energy readings' },
          { key: 'lessor_allocation' as Method, label: 'B. Lessor Allocation', desc: 'Share of building emissions' },
          { key: 'average_data' as Method, label: 'C. Average-Data (Estimated)', desc: 'Floor area × benchmarks' },
        ]).map(m => (
          <Button
            key={m.key}
            variant={method === m.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMethod(m.key)}
            className="flex-col items-start h-auto py-2 px-3"
          >
            <span className="text-xs font-semibold">{m.label}</span>
            <span className="text-[10px] opacity-70">{m.desc}</span>
          </Button>
        ))}
      </div>

      {/* Method A: Asset-Specific */}
      {method === 'asset_specific' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Asset-Specific Method</CardTitle>
            <p className="text-xs text-muted-foreground">Enter actual energy consumption from meter readings or invoices.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Asset Name</Label>
                <Input placeholder="e.g. HQ Office" value={assetName} onChange={e => setAssetName(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Energy Type</Label>
                <Select value={energyType} onValueChange={setEnergyType}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENERGY_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {energyType === 'electricity' && (
                <div className="space-y-1">
                  <Label className="text-xs">Grid Region</Label>
                  <Select value={gridRegion} onValueChange={setGridRegion}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(GRID_REGIONS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Consumption ({ENERGY_TYPES[energyType]?.unit})</Label>
                <Input type="number" placeholder="0" value={consumption} onChange={e => setConsumption(e.target.value)} className="h-8" />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleAddAssetSpecific} className="gap-1" disabled={!consumption || !assetName}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            {consumption && assetName && (
              <p className="text-xs text-muted-foreground">
                Estimated: {(() => {
                  const qty = parseFloat(consumption) || 0;
                  const et = ENERGY_TYPES[energyType];
                  let f = et.factor;
                  if (energyType === 'electricity') f = GRID_REGIONS[gridRegion as keyof typeof GRID_REGIONS]?.factor || 0.000177;
                  return (qty * f).toFixed(4);
                })()} tCO₂e
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Method B: Lessor Allocation */}
      {method === 'lessor_allocation' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Lessor Allocation Method</CardTitle>
            <p className="text-xs text-muted-foreground">Allocate a share of total building emissions based on your leased area.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Building Name</Label>
                <Input placeholder="e.g. City Tower" value={buildingName} onChange={e => setBuildingName(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Building Emissions (tCO₂e)</Label>
                <Input type="number" placeholder="0" value={totalEmissions} onChange={e => setTotalEmissions(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Your Leased Area (sq m)</Label>
                <Input type="number" placeholder="0" value={yourArea} onChange={e => setYourArea(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Total Building Area (sq m)</Label>
                <Input type="number" placeholder="0" value={totalArea} onChange={e => setTotalArea(e.target.value)} className="h-8" />
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleAddLessorAllocation} className="gap-1" disabled={!totalEmissions || !yourArea || !totalArea || !buildingName}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            {totalEmissions && yourArea && totalArea && (
              <p className="text-xs text-muted-foreground">
                Your share: {((parseFloat(yourArea) / parseFloat(totalArea)) * 100).toFixed(1)}% = {(parseFloat(totalEmissions) * parseFloat(yourArea) / parseFloat(totalArea)).toFixed(4)} tCO₂e
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Method C: Average-Data */}
      {method === 'average_data' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average-Data Method</CardTitle>
            <p className="text-xs text-muted-foreground">Estimate emissions from floor space using industry energy intensity benchmarks (kWh/m²/yr).</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Asset Name</Label>
                <Input placeholder="e.g. Regional Office" value={avgAssetName} onChange={e => setAvgAssetName(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Asset Type</Label>
                <Select value={assetType} onValueChange={setAssetType}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ASSET_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} ({v.electricity + v.gas} kWh/m²)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Floor Space (sq m)</Label>
                <Input type="number" placeholder="0" value={floorSpace} onChange={e => setFloorSpace(e.target.value)} className="h-8" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Grid Region</Label>
                <Select value={avgGridRegion} onValueChange={setAvgGridRegion}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(GRID_REGIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button size="sm" onClick={handleAddAverageData} className="gap-1" disabled={!floorSpace || !avgAssetName}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
            {floorSpace && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const area = parseFloat(floorSpace) || 0;
                  const at = ASSET_TYPES[assetType];
                  const gf = GRID_REGIONS[avgGridRegion as keyof typeof GRID_REGIONS]?.factor || 0.000177;
                  const gasF = FUEL_TYPES.natural_gas.factor;
                  return `Elec: ${(area * at.electricity).toLocaleString()} kWh + Gas: ${(area * at.gas).toLocaleString()} kWh = ${((area * at.electricity * gf) + (area * at.gas * gasF)).toFixed(4)} tCO₂e`;
                })()}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

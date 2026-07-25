import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Globe, MapPin, CheckCircle, Circle, Upload, Download, FileSpreadsheet, X, Check, AlertCircle, Recycle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

type Method = 'waste_type' | 'average';

interface EndOfLifeFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries?: Scope3Entry[];
}

const METHODS: { key: Method; label: string; description: string }[] = [
  { key: 'waste_type', label: 'Waste-Type-Specific', description: 'You know the material composition of your products (e.g., 60% aluminium, 40% plastic). Apply material-specific disposal factors.' },
  { key: 'average', label: 'Average-Data Method', description: 'Break sold products into constituent materials, apply regional disposal scenario percentages and average treatment factors.' },
];

// Materials that products are made of — DEFRA 2025 factors (tCO₂e per tonne)
const PRODUCT_MATERIALS = [
  { key: 'plastics', label: 'Plastics' },
  { key: 'metals_ferrous', label: 'Metals (Ferrous/Steel)' },
  { key: 'metals_aluminium', label: 'Metals (Aluminium)' },
  { key: 'glass', label: 'Glass' },
  { key: 'paper_cardboard', label: 'Paper & Cardboard' },
  { key: 'wood', label: 'Wood' },
  { key: 'textiles', label: 'Textiles' },
  { key: 'electronics_weee', label: 'Electronics (WEEE)' },
  { key: 'rubber', label: 'Rubber / Tyres' },
  { key: 'concrete', label: 'Concrete / Construction' },
  { key: 'mixed_municipal', label: 'Mixed / Unknown' },
] as const;

const DISPOSAL_METHODS = [
  { key: 'landfill', label: 'Landfill' },
  { key: 'recycling', label: 'Recycling' },
  { key: 'incineration', label: 'Incineration (Energy Recovery)' },
  { key: 'incineration_no_er', label: 'Incineration (No Recovery)' },
  { key: 'composting', label: 'Composting' },
  { key: 'anaerobic', label: 'Anaerobic Digestion' },
] as const;

// DEFRA 2025 material×treatment factors (tCO₂e per tonne)
const EOL_FACTORS: Record<string, Record<string, number>> = {
  plastics:          { landfill: 0.0100, recycling: 0.0214, incineration: 2.2730, incineration_no_er: 2.2730, composting: 0, anaerobic: 0 },
  metals_ferrous:    { landfill: 0.0100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  metals_aluminium:  { landfill: 0.0100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  glass:             { landfill: 0.0100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  paper_cardboard:   { landfill: 1.0418, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0.0062, anaerobic: 0.0100 },
  wood:              { landfill: 0.6100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0.0062, anaerobic: 0.0100 },
  textiles:          { landfill: 0.4467, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  electronics_weee:  { landfill: 0.0214, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  rubber:            { landfill: 0.0100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  concrete:          { landfill: 0.0100, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.0214, composting: 0, anaerobic: 0 },
  mixed_municipal:   { landfill: 0.4467, recycling: 0.0214, incineration: 0.0214, incineration_no_er: 0.4467, composting: 0.0062, anaerobic: 0.0100 },
};

// Average treatment factors when material is unknown
const AVG_TREATMENT_FACTORS: Record<string, { label: string; factor: number }> = {
  landfill:          { label: 'Landfill', factor: 0.4467 },
  recycling:         { label: 'Recycling', factor: 0.0214 },
  incineration:      { label: 'Incineration (Energy Recovery)', factor: 0.0214 },
  incineration_no_er:{ label: 'Incineration (No Recovery)', factor: 0.4467 },
  composting:        { label: 'Composting', factor: 0.0062 },
  anaerobic:         { label: 'Anaerobic Digestion', factor: 0.0100 },
};

export const EndOfLifeForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: EndOfLifeFormProps) => {
  const [selectedMethod, setSelectedMethod] = useState<Method>('waste_type');
  // Waste-type-specific
  const [productName, setProductName] = useState('');
  const [material, setMaterial] = useState('');
  const [disposal, setDisposal] = useState('');
  const [massTonnes, setMassTonnes] = useState('');
  // Average-data
  const [avgMaterial, setAvgMaterial] = useState('');
  const [avgDisposal, setAvgDisposal] = useState('');
  const [avgMassTonnes, setAvgMassTonnes] = useState('');
  const [avgScenarioPct, setAvgScenarioPct] = useState('100');
  // Common
  const [description, setDescription] = useState('');
  const [dataMode, setDataMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  // Bulk import
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Calculations
  const wtFactor = material && disposal ? (EOL_FACTORS[material]?.[disposal] ?? null) : null;
  const avgFactor = avgDisposal ? (AVG_TREATMENT_FACTORS[avgDisposal]?.factor ?? null) : null;

  const calculatedEmission = useMemo(() => {
    if (selectedMethod === 'waste_type') {
      if (massTonnes && wtFactor !== null) return parseFloat(massTonnes) * wtFactor;
      return 0;
    }
    // average
    if (avgMassTonnes && avgFactor !== null) {
      const pct = Math.min(100, Math.max(0, parseFloat(avgScenarioPct) || 100)) / 100;
      return parseFloat(avgMassTonnes) * pct * avgFactor;
    }
    return 0;
  }, [selectedMethod, massTonnes, wtFactor, avgMassTonnes, avgFactor, avgScenarioPct]);

  const canAdd = selectedMethod === 'waste_type'
    ? !!(massTonnes && parseFloat(massTonnes) > 0 && material && disposal)
    : !!(avgMassTonnes && parseFloat(avgMassTonnes) > 0 && avgDisposal);

  const handleAdd = () => {
    if (!canAdd) return;
    const materialLabel = PRODUCT_MATERIALS.find(m => m.key === (selectedMethod === 'waste_type' ? material : avgMaterial))?.label || material || avgMaterial;
    const disposalLabel = selectedMethod === 'waste_type'
      ? (DISPOSAL_METHODS.find(d => d.key === disposal)?.label || disposal)
      : (AVG_TREATMENT_FACTORS[avgDisposal]?.label || avgDisposal);

    const autoDesc = selectedMethod === 'waste_type'
      ? `${productName ? productName + ': ' : ''}${materialLabel} → ${disposalLabel}`
      : `${materialLabel || 'Mixed material'} → ${disposalLabel} (${avgScenarioPct}%)`;

    onAdd({
      categoryCode: 'end_of_life',
      type: selectedMethod === 'waste_type' ? 'waste_type_specific' : 'average_data',
      quantity: selectedMethod === 'waste_type' ? parseFloat(massTonnes) : parseFloat(avgMassTonnes) * (parseFloat(avgScenarioPct) || 100) / 100,
      unit: 'tonnes',
      tco2e: calculatedEmission,
      description: description || autoDesc,
      siteId: dataMode === 'site' ? selectedSiteId : null,
    });

    setProductName(''); setMaterial(''); setDisposal(''); setMassTonnes('');
    setAvgMaterial(''); setAvgDisposal(''); setAvgMassTonnes(''); setAvgScenarioPct('100');
    setDescription('');
    toast.success('Entry added');
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();
    // Waste-Type sheet
    const wtHeaders = ['Product Name', 'Material', 'Disposal Method', 'Mass (tonnes)', 'Description'];
    const wtExample = ['Laptop casing', 'plastics', 'landfill', '100', 'Plastic casings end-of-life'];
    const wtSheet = XLSX.utils.aoa_to_sheet([wtHeaders, wtExample]);
    wtSheet['!cols'] = wtHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, wtSheet, 'Waste-Type-Specific');

    // Average-Data sheet
    const avgHeaders = ['Material', 'Disposal Method', 'Mass (tonnes)', 'Scenario %', 'Description'];
    const avgExample = ['plastics', 'landfill', '1.0', '80', 'Plastic to landfill'];
    const avgSheet = XLSX.utils.aoa_to_sheet([avgHeaders, avgExample]);
    avgSheet['!cols'] = avgHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, avgSheet, 'Average-Data');

    // Reference: Materials
    const matRef = PRODUCT_MATERIALS.map(m => [m.key, m.label]);
    const matSheet = XLSX.utils.aoa_to_sheet([['Key', 'Material'], ...matRef]);
    matSheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, matSheet, 'REF - Materials');

    // Reference: Disposal
    const disRef = DISPOSAL_METHODS.map(d => [d.key, d.label]);
    const disSheet = XLSX.utils.aoa_to_sheet([['Key', 'Disposal Method'], ...disRef]);
    disSheet['!cols'] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, disSheet, 'REF - Disposal');

    // Reference: Factors matrix
    const factorRows: any[][] = [['Material \\ Disposal', ...DISPOSAL_METHODS.map(d => d.label)]];
    PRODUCT_MATERIALS.forEach(m => {
      const row: any[] = [m.label];
      DISPOSAL_METHODS.forEach(d => {
        row.push(EOL_FACTORS[m.key]?.[d.key] ?? 'N/A');
      });
      factorRows.push(row);
    });
    const fSheet = XLSX.utils.aoa_to_sheet(factorRows);
    fSheet['!cols'] = factorRows[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, fSheet, 'REF - Factors (DEFRA 2025)');

    XLSX.writeFile(wb, 'Cat12_EndOfLife_Template.xlsx');
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

        // Parse Waste-Type-Specific sheet
        const wtSheet = wb.Sheets['Waste-Type-Specific'];
        if (wtSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(wtSheet);
          rows.forEach(row => {
            const matKey = String(row['Material'] || '').toLowerCase().trim();
            const disKey = String(row['Disposal Method'] || '').toLowerCase().trim();
            const mass = parseFloat(row['Mass (tonnes)']) || 0;
            if (!mass || !matKey || !disKey) return;
            const resolvedMat = PRODUCT_MATERIALS.find(m => m.key === matKey || m.label.toLowerCase() === matKey)?.key;
            const resolvedDis = DISPOSAL_METHODS.find(d => d.key === disKey || d.label.toLowerCase() === disKey)?.key;
            if (!resolvedMat || !resolvedDis) return;
            const factor = EOL_FACTORS[resolvedMat]?.[resolvedDis] ?? 0;
            const matLabel = PRODUCT_MATERIALS.find(m => m.key === resolvedMat)?.label || resolvedMat;
            const disLabel = DISPOSAL_METHODS.find(d => d.key === resolvedDis)?.label || resolvedDis;
            parsed.push({
              categoryCode: 'end_of_life',
              type: 'waste_type_specific',
              quantity: mass,
              unit: 'tonnes',
              tco2e: mass * factor,
              description: row['Description'] || `${row['Product Name'] || ''} ${matLabel} → ${disLabel}`.trim(),
              siteId: dataMode === 'site' ? selectedSiteId : null,
            });
          });
        }

        // Parse Average-Data sheet
        const avgSheet = wb.Sheets['Average-Data'];
        if (avgSheet) {
          const rows: any[] = XLSX.utils.sheet_to_json(avgSheet);
          rows.forEach(row => {
            const matKey = String(row['Material'] || '').toLowerCase().trim();
            const disKey = String(row['Disposal Method'] || '').toLowerCase().trim();
            const mass = parseFloat(row['Mass (tonnes)']) || 0;
            const pct = parseFloat(row['Scenario %']) || 100;
            if (!mass || !disKey) return;
            const resolvedDis = DISPOSAL_METHODS.find(d => d.key === disKey || d.label.toLowerCase() === disKey)?.key;
            if (!resolvedDis) return;
            const factor = AVG_TREATMENT_FACTORS[resolvedDis]?.factor ?? 0;
            const disLabel = AVG_TREATMENT_FACTORS[resolvedDis]?.label || resolvedDis;
            const effectiveMass = mass * pct / 100;
            const matLabel = PRODUCT_MATERIALS.find(m => m.key === matKey)?.label || matKey || 'Mixed';
            parsed.push({
              categoryCode: 'end_of_life',
              type: 'average_data',
              quantity: effectiveMass,
              unit: 'tonnes',
              tco2e: effectiveMass * factor,
              description: row['Description'] || `${matLabel} → ${disLabel} (${pct}%)`,
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
      'Type': e.type === 'waste_type_specific' ? 'Waste-Type-Specific' : 'Average-Data',
      'Description': e.description,
      'Quantity (tonnes)': e.quantity,
      'tCO₂e': e.tco2e,
      'Data Level': e.siteId ? `Site: ${sites.find(s => s.id === e.siteId)?.name || e.siteId}` : 'Global',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'End-of-Life Entries');
    XLSX.writeFile(wb, 'Cat12_EndOfLife_Export.xlsx');
    toast.success('Exported');
  };

  const totalEntries = entries.reduce((s, e) => s + e.tco2e, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Recycle className="h-4 w-4" /> 12. End-of-Life Treatment of Sold Products
            </CardTitle>
            <CardDescription>Emissions from disposal of products you sold — by material composition and treatment method</CardDescription>
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
        {/* Import Preview Modal */}
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
        <div className="space-y-3">
          {METHODS.map(m => {
            const isActive = selectedMethod === m.key;
            return (
              <div
                key={m.key}
                className={`rounded-lg border-2 p-4 transition-colors cursor-pointer ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/20 opacity-70'}`}
                onClick={() => setSelectedMethod(m.key)}
              >
                <div className="flex items-center gap-2 mb-2">
                  {isActive ? <CheckCircle className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold">{m.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{m.description}</p>

                {/* ── Waste-Type-Specific ── */}
                {m.key === 'waste_type' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Product Name (optional)</Label>
                        <Input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Laptop casing" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Material</Label>
                        <Select value={material} onValueChange={setMaterial}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select material" /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_MATERIALS.map(pm => <SelectItem key={pm.key} value={pm.key}>{pm.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Disposal Method</Label>
                        <Select value={disposal} onValueChange={setDisposal}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select disposal" /></SelectTrigger>
                          <SelectContent>
                            {DISPOSAL_METHODS.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Mass (tonnes)</Label>
                        <Input type="number" value={massTonnes} onChange={e => setMassTonnes(e.target.value)} placeholder="0" className="h-9" />
                      </div>
                    </div>
                    {isActive && wtFactor !== null && massTonnes && parseFloat(massTonnes) > 0 && (
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                        {parseFloat(massTonnes)} t × {wtFactor} tCO₂e/t = <span className="font-semibold text-foreground">{calculatedEmission.toFixed(4)} tCO₂e</span>
                        <span className="ml-2 text-[10px]">(DEFRA 2025)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Average-Data Method ── */}
                {m.key === 'average' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Material (optional)</Label>
                        <Select value={avgMaterial} onValueChange={setAvgMaterial}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Any / Mixed" /></SelectTrigger>
                          <SelectContent>
                            {PRODUCT_MATERIALS.map(pm => <SelectItem key={pm.key} value={pm.key}>{pm.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Treatment Method</Label>
                        <Select value={avgDisposal} onValueChange={setAvgDisposal}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select treatment" /></SelectTrigger>
                          <SelectContent>
                            {DISPOSAL_METHODS.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Total Mass (tonnes)</Label>
                        <Input type="number" value={avgMassTonnes} onChange={e => setAvgMassTonnes(e.target.value)} placeholder="0" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Scenario % going to this treatment</Label>
                        <Input type="number" value={avgScenarioPct} onChange={e => setAvgScenarioPct(e.target.value)} placeholder="100" min="0" max="100" className="h-9" />
                      </div>
                    </div>
                    {isActive && avgFactor !== null && avgMassTonnes && parseFloat(avgMassTonnes) > 0 && (
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                        {parseFloat(avgMassTonnes)} t × {parseFloat(avgScenarioPct) || 100}% × {avgFactor} tCO₂e/t = <span className="font-semibold text-foreground">{calculatedEmission.toFixed(4)} tCO₂e</span>
                        <span className="ml-2 text-[10px]">(DEFRA 2025)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Description + Add */}
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Description (optional)</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Auto-generated if blank" className="h-9" />
          </div>
          <Button onClick={handleAdd} disabled={!canAdd} className="gap-1">
            <Plus className="h-4 w-4" /> Add Entry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

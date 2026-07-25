import { useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Globe, MapPin, CheckCircle, Circle, Upload, Download, FileSpreadsheet, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { SPEND_FACTORS } from '@/lib/emission-factors';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

type Method = 'supplier' | 'waste_type' | 'average' | 'spend';

interface WasteFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries?: Scope3Entry[];
}

const METHODS: { key: Method; label: string; priority: number; description: string }[] = [
  { key: 'supplier', priority: 1, label: 'Supplier-Specific', description: 'Highest accuracy — collect actual Scope 1 & 2 emissions from your waste provider, allocated to your volume' },
  { key: 'waste_type', priority: 2, label: 'Waste-Type-Specific (Recommended)', description: 'Most common — waste tonnage by material × treatment-specific emission factor (e.g. Cardboard→Recycling vs Cardboard→Landfill)' },
  { key: 'average', priority: 3, label: 'Average-Data Method', description: 'Use when you know total weight and general disposal method, but not specific materials' },
  { key: 'spend', priority: 4, label: 'Spend Method', description: 'Lowest accuracy — total waste management spend × EEIO emission factor' },
];

// DEFRA 2025 waste factors — material × treatment (tCO₂e per tonne)
const WASTE_MATERIALS = [
  { key: 'mixed_municipal', label: 'Mixed Municipal Waste' },
  { key: 'paper_cardboard', label: 'Paper & Cardboard' },
  { key: 'plastics', label: 'Plastics' },
  { key: 'metals_ferrous', label: 'Metals (Ferrous)' },
  { key: 'metals_non_ferrous', label: 'Metals (Non-Ferrous/Aluminium)' },
  { key: 'glass', label: 'Glass' },
  { key: 'food_drink', label: 'Food & Drink Waste' },
  { key: 'garden_organic', label: 'Garden / Organic Waste' },
  { key: 'wood', label: 'Wood' },
  { key: 'textiles', label: 'Textiles' },
  { key: 'electrical_weee', label: 'Electrical Items (WEEE)' },
  { key: 'construction', label: 'Construction & Demolition' },
  { key: 'tyres', label: 'Tyres' },
] as const;

const TREATMENT_METHODS = [
  { key: 'landfill', label: 'Landfill' },
  { key: 'recycling', label: 'Recycling (Open-loop)' },
  { key: 'closed_loop', label: 'Recycling (Closed-loop)' },
  { key: 'composting', label: 'Composting' },
  { key: 'anaerobic', label: 'Anaerobic Digestion' },
  { key: 'incineration', label: 'Incineration (Energy Recovery)' },
  { key: 'incineration_no_er', label: 'Incineration (No Recovery)' },
] as const;

// DEFRA 2025 material×treatment factors (tCO₂e per tonne)
const WASTE_FACTORS_MATRIX: Record<string, Record<string, number>> = {
  mixed_municipal:    { landfill: 0.4467, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0062, anaerobic: 0.0100, incineration: 0.0214, incineration_no_er: 0.4467 },
  paper_cardboard:    { landfill: 1.0418, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0062, anaerobic: 0.0100, incineration: 0.0214, incineration_no_er: 0.0214 },
  plastics:           { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 2.2730, incineration_no_er: 2.2730 },
  metals_ferrous:     { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  metals_non_ferrous: { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  glass:              { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  food_drink:         { landfill: 0.5867, recycling: 0.0000, closed_loop: 0.0000, composting: 0.0062, anaerobic: 0.0100, incineration: 0.0214, incineration_no_er: 0.0214 },
  garden_organic:     { landfill: 0.5867, recycling: 0.0000, closed_loop: 0.0000, composting: 0.0062, anaerobic: 0.0100, incineration: 0.0214, incineration_no_er: 0.0214 },
  wood:               { landfill: 0.6100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0062, anaerobic: 0.0100, incineration: 0.0214, incineration_no_er: 0.0214 },
  textiles:           { landfill: 0.4467, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  electrical_weee:    { landfill: 0.0214, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  construction:       { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
  tyres:              { landfill: 0.0100, recycling: 0.0214, closed_loop: 0.0214, composting: 0.0000, anaerobic: 0.0000, incineration: 0.0214, incineration_no_er: 0.0214 },
};

// Average treatment method factors (tCO₂e per tonne) — when material is unknown
const AVERAGE_TREATMENT_FACTORS: Record<string, { label: string; factor: number }> = {
  landfill:           { label: 'Landfill', factor: 0.4467 },
  recycling:          { label: 'Recycling', factor: 0.0214 },
  composting:         { label: 'Composting', factor: 0.0062 },
  anaerobic:          { label: 'Anaerobic Digestion', factor: 0.0100 },
  incineration:       { label: 'Incineration (Energy Recovery)', factor: 0.0214 },
  incineration_no_er: { label: 'Incineration (No Recovery)', factor: 0.4467 },
};

export const WasteForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: WasteFormProps) => {
  const [supplier, setSupplier] = useState('');
  // Supplier-specific
  const [apportionedEmission, setApportionedEmission] = useState('');
  // Waste-type-specific
  const [material, setMaterial] = useState('');
  const [treatment, setTreatment] = useState('');
  const [wasteTonnes, setWasteTonnes] = useState('');
  // Average method
  const [avgTotalWeight, setAvgTotalWeight] = useState('');
  const [avgTreatment, setAvgTreatment] = useState('');
  const [avgProportion, setAvgProportion] = useState('100');
  // Spend
  const [totalSpend, setTotalSpend] = useState('');
  // Common
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);

  const autoMethod = useMemo<Method>(() => {
    if (apportionedEmission && parseFloat(apportionedEmission) > 0) return 'supplier';
    if (wasteTonnes && parseFloat(wasteTonnes) > 0 && material && treatment) return 'waste_type';
    if (avgTotalWeight && parseFloat(avgTotalWeight) > 0 && avgTreatment) return 'average';
    return 'spend';
  }, [apportionedEmission, wasteTonnes, material, treatment, avgTotalWeight, avgTreatment]);

  const activeMethod = selectedMethod || autoMethod;

  const wasteTypeFactor = material && treatment ? (WASTE_FACTORS_MATRIX[material]?.[treatment] ?? null) : null;
  const avgFactor = avgTreatment ? (AVERAGE_TREATMENT_FACTORS[avgTreatment]?.factor ?? null) : null;

  const calculatedEmission = useMemo(() => {
    switch (activeMethod) {
      case 'supplier':
        return apportionedEmission ? parseFloat(apportionedEmission) / 1000 : 0;
      case 'waste_type':
        if (wasteTonnes && wasteTypeFactor !== null) return parseFloat(wasteTonnes) * wasteTypeFactor;
        return 0;
      case 'average':
        if (avgTotalWeight && avgFactor !== null) {
          const proportion = Math.min(100, Math.max(0, parseFloat(avgProportion) || 100)) / 100;
          return parseFloat(avgTotalWeight) * proportion * avgFactor;
        }
        return 0;
      case 'spend':
        if (totalSpend) return parseFloat(totalSpend) * (SPEND_FACTORS.waste?.factor || 0.21);
        return 0;
      default:
        return 0;
    }
  }, [activeMethod, apportionedEmission, wasteTonnes, wasteTypeFactor, avgTotalWeight, avgFactor, avgProportion, totalSpend]);

  const canAdd = activeMethod === 'supplier'
    ? !!(apportionedEmission && parseFloat(apportionedEmission) > 0)
    : activeMethod === 'waste_type'
      ? !!(wasteTonnes && parseFloat(wasteTonnes) > 0 && material && treatment)
      : activeMethod === 'average'
        ? !!(avgTotalWeight && parseFloat(avgTotalWeight) > 0 && avgTreatment)
        : !!(totalSpend && parseFloat(totalSpend) > 0);

  // Export moved to WasteBulkImport

  const handleAdd = () => {
    if (!canAdd) return;
    let type = '';
    let qty = 0;
    let unit = '';

    const materialLabel = WASTE_MATERIALS.find(m => m.key === material)?.label || material;
    const treatmentLabel = TREATMENT_METHODS.find(t => t.key === treatment)?.label || treatment;

    switch (activeMethod) {
      case 'supplier':
        type = 'supplier_specific';
        qty = parseFloat(apportionedEmission);
        unit = 'kg CO₂e';
        break;
      case 'waste_type':
        type = 'waste_type_specific';
        qty = parseFloat(wasteTonnes);
        unit = `tonnes`;
        break;
      case 'average':
        type = 'average_data';
        qty = parseFloat(avgTotalWeight) * (parseFloat(avgProportion) || 100) / 100;
        unit = 'tonnes';
        break;
      case 'spend':
        type = 'spend_based';
        qty = parseFloat(totalSpend);
        unit = '£k';
        break;
    }

    const autoDesc = activeMethod === 'waste_type'
      ? `${materialLabel} → ${treatmentLabel}`
      : activeMethod === 'average'
        ? `Mixed waste → ${AVERAGE_TREATMENT_FACTORS[avgTreatment]?.label || avgTreatment}`
        : '';

    onAdd({
      categoryCode: 'waste',
      type,
      quantity: qty,
      unit,
      tco2e: calculatedEmission,
      description: description || supplier || autoDesc || `Cat 5 - ${METHODS.find(m => m.key === activeMethod)?.label}`,
      siteId: mode === 'site' ? selectedSiteId : null,
    });

    // Reset
    setSupplier(''); setApportionedEmission('');
    setMaterial(''); setTreatment(''); setWasteTonnes('');
    setAvgTotalWeight(''); setAvgTreatment(''); setAvgProportion('100');
    setTotalSpend(''); setDescription(''); setSelectedMethod(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Trash2 className="h-4 w-4" /> 5. Waste Generated in Operations
        </CardTitle>
        <CardDescription>Four calculation methods — highest-quality data is used automatically</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Data level selector */}
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

        {/* Waste Provider name */}
        <div className="space-y-2">
          <Label>Waste Provider / Company Name</Label>
          <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Veolia, Biffa, Suez" />
        </div>

        {/* Four methods */}
        <div className="space-y-3">
          {METHODS.map(m => {
            const isActive = activeMethod === m.key;
            const isManuallySelected = selectedMethod === m.key;
            return (
              <div
                key={m.key}
                className={`rounded-lg border-2 p-4 transition-colors cursor-pointer ${
                  isActive ? 'border-primary/50 bg-primary/5' : 'border-border/50 bg-muted/20 opacity-70'
                }`}
                onClick={() => setSelectedMethod(m.key)}
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {isActive ? <CheckCircle className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-semibold">{m.label}</span>
                  <Badge variant={m.priority === 1 ? 'default' : m.priority === 2 ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                    Priority {m.priority}
                  </Badge>
                  {isActive && activeMethod === autoMethod && !isManuallySelected && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">Auto-selected</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{m.description}</p>

                {/* --- Priority 1: Supplier-Specific --- */}
                {m.key === 'supplier' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Apportioned Emission (kg CO₂e)</Label>
                      <Input type="number" value={apportionedEmission} onChange={e => setApportionedEmission(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    {isActive && apportionedEmission && parseFloat(apportionedEmission) > 0 && (
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground">
                          = <span className="font-semibold text-foreground">{(parseFloat(apportionedEmission) / 1000).toFixed(4)}</span> tCO₂e
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* --- Priority 2: Waste-Type-Specific --- */}
                {m.key === 'waste_type' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Waste Material</Label>
                        <Select value={material} onValueChange={setMaterial}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select material" /></SelectTrigger>
                          <SelectContent>
                            {WASTE_MATERIALS.map(w => (
                              <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Treatment Method</Label>
                        <Select value={treatment} onValueChange={setTreatment}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select treatment" /></SelectTrigger>
                          <SelectContent>
                            {TREATMENT_METHODS.map(t => (
                              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Weight (tonnes)</Label>
                        <Input type="number" value={wasteTonnes} onChange={e => setWasteTonnes(e.target.value)} placeholder="0" className="h-9" />
                      </div>
                    </div>
                    {isActive && wasteTypeFactor !== null && wasteTonnes && parseFloat(wasteTonnes) > 0 && (
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                        {parseFloat(wasteTonnes)} t × {wasteTypeFactor} tCO₂e/t = <span className="font-semibold text-foreground">{calculatedEmission.toFixed(4)} tCO₂e</span>
                        <span className="ml-2 text-[10px]">(DEFRA 2025)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* --- Priority 3: Average-Data Method --- */}
                {m.key === 'average' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Total Waste Weight (tonnes)</Label>
                        <Input type="number" value={avgTotalWeight} onChange={e => setAvgTotalWeight(e.target.value)} placeholder="0" className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Disposal Method</Label>
                        <Select value={avgTreatment} onValueChange={setAvgTreatment}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Select method" /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(AVERAGE_TREATMENT_FACTORS).map(([key, val]) => (
                              <SelectItem key={key} value={key}>{val.label} ({val.factor} tCO₂e/t)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Proportion to this method (%)</Label>
                        <Input type="number" value={avgProportion} onChange={e => setAvgProportion(e.target.value)} placeholder="100" className="h-9" min="0" max="100" />
                      </div>
                    </div>
                    {isActive && avgTotalWeight && avgFactor !== null && parseFloat(avgTotalWeight) > 0 && (
                      <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                        {parseFloat(avgTotalWeight)} t × {parseFloat(avgProportion) || 100}% × {avgFactor} tCO₂e/t = <span className="font-semibold text-foreground">{calculatedEmission.toFixed(4)} tCO₂e</span>
                        <span className="ml-2 text-[10px]">(DEFRA 2025 avg)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* --- Priority 4: Spend-Based --- */}
                {m.key === 'spend' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Total Spend (£/$ thousands)</Label>
                      <Input type="number" value={totalSpend} onChange={e => setTotalSpend(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    {isActive && totalSpend && parseFloat(totalSpend) > 0 && (
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground">
                          £{parseFloat(totalSpend)}k × {SPEND_FACTORS.waste?.factor || 0.21} = <span className="font-semibold text-foreground">{calculatedEmission.toFixed(4)}</span> tCO₂e
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Description + Add */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label>Description / Notes</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Office waste Q1, Packaging recycling" />
          </div>
          <div className="flex items-end gap-3">
            {canAdd && calculatedEmission > 0 && (
              <div className="text-right flex-1">
                <p className="text-2xl font-bold text-primary">{calculatedEmission.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">tCO₂e via {METHODS.find(m => m.key === activeMethod)?.label}</p>
              </div>
            )}
            <Button onClick={handleAdd} disabled={!canAdd || (mode === 'site' && !selectedSiteId)} className="whitespace-nowrap">
              <Plus className="mr-2 h-4 w-4" /> Add Entry
            </Button>
          </div>
        </div>

        <WasteBulkImport onAdd={onAdd} onAddBatch={onAddBatch} sites={sites} mode={mode} selectedSiteId={selectedSiteId} entries={entries} />
      </CardContent>
    </Card>
  );
};

// --- Bulk Import ---
const TEMPLATE_COLUMNS = ['Supplier', 'Method (supplier/waste_type/average/spend)', 'Material', 'Treatment', 'Weight (tonnes)', 'Proportion (%)', 'Apportioned (kg CO2e)', 'Spend (£k)', 'Description'];

const WasteBulkImport = ({ onAdd, onAddBatch, sites, mode, selectedSiteId, entries }: {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  mode: 'global' | 'site';
  selectedSiteId: string | null;
  entries: Scope3Entry[];
}) => {
  const [showImport, setShowImport] = useState(false);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const data = [
      TEMPLATE_COLUMNS,
      ['Veolia', 'waste_type', 'paper_cardboard', 'recycling', '10', '', '', '', 'Cardboard recycling'],
      ['Veolia', 'waste_type', 'food_drink', 'landfill', '5', '', '', '', 'Food waste to landfill'],
      ['Biffa', 'average', '', 'landfill', '50', '60', '', '', '60% of mixed waste to landfill'],
      ['Biffa', 'average', '', 'recycling', '50', '40', '', '', '40% of mixed waste recycled'],
      ['Provider X', 'supplier', '', '', '', '', '2500', '', 'Provider-reported emissions'],
      ['', 'spend', '', '', '', '', '', '15', 'Waste management contract'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));

    // Reference sheet
    const refData = [
      ['--- Materials ---', '', '--- Treatment Methods ---', '', '--- Average Factors ---', ''],
      ['Key', 'Label', 'Key', 'Label', 'Treatment', 'Factor (tCO₂e/t)'],
      ...Array.from({ length: Math.max(WASTE_MATERIALS.length, TREATMENT_METHODS.length, Object.keys(AVERAGE_TREATMENT_FACTORS).length) }, (_, i) => [
        WASTE_MATERIALS[i]?.key || '', WASTE_MATERIALS[i]?.label || '',
        TREATMENT_METHODS[i]?.key || '', TREATMENT_METHODS[i]?.label || '',
        Object.keys(AVERAGE_TREATMENT_FACTORS)[i] || '', Object.values(AVERAGE_TREATMENT_FACTORS)[i]?.factor || '',
      ]),
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = refData[0].map(() => ({ wch: 28 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference');
    XLSX.writeFile(wb, 'scope3_cat5_waste_template.xlsx');
    toast.success('Template downloaded');
  };

  const parseFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const dataRows = rows.slice(1).filter(r => r.some(cell => cell !== undefined && cell !== ''));

        const parsed = dataRows.map(row => {
          const supplierName = String(row[0] || '').trim();
          const methodRaw = String(row[1] || '').trim().toLowerCase();
          const mat = String(row[2] || '').trim().toLowerCase();
          const treat = String(row[3] || '').trim().toLowerCase();
          const weight = parseFloat(row[4]) || 0;
          const proportion = parseFloat(row[5]) || 100;
          const apportioned = parseFloat(row[6]) || 0;
          const spend = parseFloat(row[7]) || 0;
          const desc = String(row[8] || '').trim();

          let method: Method = 'spend';
          if (methodRaw.includes('supplier')) method = 'supplier';
          else if (methodRaw.includes('waste') || methodRaw.includes('type')) method = 'waste_type';
          else if (methodRaw.includes('average') || methodRaw.includes('avg')) method = 'average';
          else if (apportioned > 0) method = 'supplier';
          else if (mat && weight > 0) method = 'waste_type';
          else if (weight > 0) method = 'average';

          let tco2e = 0;
          let unit = '';
          let qty = 0;
          let valid = true;
          let error = '';

          switch (method) {
            case 'supplier':
              if (apportioned <= 0) { valid = false; error = 'Missing apportioned emission'; }
              qty = apportioned; unit = 'kg CO₂e'; tco2e = apportioned / 1000;
              break;
            case 'waste_type': {
              const factor = WASTE_FACTORS_MATRIX[mat]?.[treat];
              if (factor === undefined) { valid = false; error = `Unknown material/treatment: ${mat}/${treat}`; }
              if (weight <= 0) { valid = false; error = 'Missing weight'; }
              qty = weight; unit = 'tonnes'; tco2e = (factor ?? 0) * weight;
              break;
            }
            case 'average': {
              const af = AVERAGE_TREATMENT_FACTORS[treat];
              if (!af) { valid = false; error = `Unknown treatment: ${treat}`; }
              if (weight <= 0) { valid = false; error = 'Missing weight'; }
              const prop = Math.min(100, Math.max(0, proportion)) / 100;
              qty = weight * prop; unit = 'tonnes'; tco2e = (af?.factor ?? 0) * weight * prop;
              break;
            }
            case 'spend':
              if (spend <= 0) { valid = false; error = 'Missing spend'; }
              qty = spend; unit = '£k'; tco2e = spend * (SPEND_FACTORS.waste?.factor || 0.21);
              break;
          }

          return { supplier: supplierName, method, qty, unit, tco2e, description: desc || supplierName, valid, error };
        });

        setParsedRows(parsed);
        setShowImport(true);
        toast.success(`Parsed ${parsed.length} rows`);
      } catch { toast.error('Failed to parse file'); }
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmImport = () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows'); return; }
    setImporting(true);

    const entries: Omit<Scope3Entry, 'id'>[] = validRows.map(r => ({
      categoryCode: 'waste',
      type: r.method === 'supplier' ? 'supplier_specific' : r.method === 'waste_type' ? 'waste_type_specific' : r.method === 'average' ? 'average_data' : 'spend_based',
      quantity: r.qty, unit: r.unit, tco2e: r.tco2e, description: r.description,
      siteId: mode === 'site' ? selectedSiteId : null,
    }));

    if (onAddBatch) onAddBatch(entries); else entries.forEach(e => onAdd(e));
    toast.success(`Imported ${entries.length} waste entries`);
    setParsedRows([]); setShowImport(false); setImporting(false);
  };

  const handleExport = () => {
    if (entries.length === 0) { toast.error('No waste entries to export'); return; }
    const wb = XLSX.utils.book_new();
    const TYPE_TO_METHOD: Record<string, string> = { supplier_specific: 'supplier', waste_type_specific: 'waste_type', average_data: 'average', spend_based: 'spend' };
    const exportData = [
      [...TEMPLATE_COLUMNS, 'tCO₂e', 'Site'],
      ...entries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        const method = TYPE_TO_METHOD[e.type] || e.type;
        const ad = (e as any).activityData || {};
        return [
          e.description,
          method,
          ad.material || '',
          ad.treatment || '',
          method === 'spend' ? '' : e.quantity,
          method === 'average' ? (ad.proportion || '') : '',
          method === 'supplier' ? e.quantity : '',
          method === 'spend' ? e.quantity : '',
          e.description,
          e.tco2e,
          site?.name || 'Global',
        ];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws['!cols'] = exportData[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Waste Data');
    XLSX.writeFile(wb, `scope3_cat5_waste_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${entries.length} waste entries`);
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground">Bulk:</span>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
          <Download className="h-3.5 w-3.5" /> Export {entries.length > 0 && `(${entries.length})`}
        </Button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); e.target.value = ''; }} />
      </div>

      {showImport && parsedRows.length > 0 && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Import Preview ({parsedRows.length} rows)</h4>
            <Button variant="ghost" size="sm" onClick={() => { setShowImport(false); setParsedRows([]); }}><X className="h-4 w-4" /></Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {parsedRows.map((r, i) => (
              <div key={i} className={`flex items-center justify-between p-2 rounded text-xs ${r.valid ? 'bg-muted/50' : 'bg-destructive/10 border border-destructive/30'}`}>
                <div className="flex-1">
                  <span className="font-medium">{r.description || r.supplier}</span>
                  <span className="ml-2 text-muted-foreground">{r.method} • {r.qty.toFixed(2)} {r.unit}</span>
                </div>
                {r.valid ? (
                  <span className="font-semibold text-primary">{r.tco2e.toFixed(4)} tCO₂e</span>
                ) : (
                  <span className="text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {r.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{parsedRows.filter(r => r.valid).length} valid, {parsedRows.filter(r => !r.valid).length} invalid</p>
            <Button size="sm" onClick={confirmImport} disabled={importing || parsedRows.filter(r => r.valid).length === 0} className="gap-1">
              <Check className="h-3.5 w-3.5" /> Import {parsedRows.filter(r => r.valid).length} Entries
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

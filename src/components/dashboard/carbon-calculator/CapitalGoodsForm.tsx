import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, Globe, MapPin, CheckCircle, Circle, Upload, Download, FileSpreadsheet, X, Check, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

type Method = 'supplier' | 'average' | 'spend';

interface CapitalGoodsFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries?: Scope3Entry[];
}

const METHODS: { key: Method; label: string; priority: number; description: string }[] = [
  { key: 'supplier', priority: 1, label: 'Supplier-Specific', description: 'Highest accuracy — use apportioned emissions from suppliers' },
  { key: 'average', priority: 2, label: 'Average Method', description: 'Medium accuracy — quantity × AI-assigned emission factor' },
  { key: 'spend', priority: 3, label: 'Spend Method', description: 'Lowest accuracy — total spend × AI-assigned emission factor' },
];

export const CapitalGoodsForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: CapitalGoodsFormProps) => {
  const [supplier, setSupplier] = useState('');
  const [apportionedEmission, setApportionedEmission] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgEF, setAvgEF] = useState('');
  const [totalSpend, setTotalSpend] = useState('');
  const [spendEF, setSpendEF] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const [selectedMethod, setSelectedMethod] = useState<Method | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const autoMethod = useMemo<Method>(() => {
    if (apportionedEmission && parseFloat(apportionedEmission) > 0) return 'supplier';
    if (quantity && parseFloat(quantity) > 0) return 'average';
    return 'spend';
  }, [apportionedEmission, quantity]);

  const activeMethod = selectedMethod || autoMethod;

  const calculatedEmission = useMemo(() => {
    switch (activeMethod) {
      case 'supplier':
        return apportionedEmission ? parseFloat(apportionedEmission) / 1000 : 0;
      case 'average':
        return 0; // EF assigned by AI later
      case 'spend':
        return 0; // EF assigned by AI later
      default:
        return 0;
    }
  }, [activeMethod, apportionedEmission]);

  const canAdd = activeMethod === 'supplier'
    ? calculatedEmission > 0
    : activeMethod === 'average'
      ? !!(quantity && parseFloat(quantity) > 0)
      : !!(totalSpend && parseFloat(totalSpend) > 0);

  const handleExport = () => {
    if (entries.length === 0) {
      toast.error('No entries to export');
      return;
    }
    const wb = XLSX.utils.book_new();
    const exportData = [
      ['Supplier/Description', 'Method', 'Quantity', 'Unit', 'tCO₂e', 'Site'],
      ...entries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return [e.description, e.type, e.quantity, e.unit, e.tco2e, site?.name || 'Global'];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    ws['!cols'] = exportData[0].map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Capital Goods');
    XLSX.writeFile(wb, 'scope3_cat2_capital_goods.xlsx');
    toast.success(`Exported ${entries.length} entries`);
  };

  const handleAdd = async () => {
    if (!canAdd) return;

    let type = '';
    let qty = 0;
    let unit = '';

    switch (activeMethod) {
      case 'supplier':
        type = 'supplier_specific';
        qty = parseFloat(apportionedEmission);
        unit = 'kg CO₂e';
        break;
      case 'average':
        type = 'average_method';
        qty = parseFloat(quantity);
        unit = 'units';
        break;
      case 'spend':
        type = 'spend_based';
        qty = parseFloat(totalSpend);
        unit = '$';
        break;
    }

    let tco2e = activeMethod === 'supplier' ? calculatedEmission : 0;
    let efSource = '';

    // For average/spend methods, call AI to get emission factor
    if (activeMethod !== 'supplier') {
      setIsCalculating(true);
      try {
        const { data, error } = await supabase.functions.invoke('assign-emission-factor', {
          body: {
            entries: [{
              supplier: supplier || 'Unknown',
              description: description || supplier || 'General',
              method: activeMethod,
              quantity: activeMethod === 'average' ? parseFloat(quantity) : undefined,
              totalSpend: activeMethod === 'spend' ? parseFloat(totalSpend) : undefined,
              category: 'capital_goods',
            }],
          },
        });

        if (error) throw error;
        if (data?.results?.[0]) {
          const result = data.results[0];
          tco2e = result.tco2e;
          efSource = result.emission_factor_source;
          toast.success(`AI assigned EF: ${result.emission_factor} kg CO₂e/${activeMethod === 'average' ? 'unit' : '$'} (${efSource})`);
        } else {
          throw new Error('No result from AI');
        }
      } catch (err) {
        console.error('AI EF assignment failed:', err);
        toast.error('Failed to assign emission factor. Entry saved with 0 tCO₂e.');
      } finally {
        setIsCalculating(false);
      }
    }

    onAdd({
      categoryCode: 'capital_goods',
      type,
      quantity: qty,
      unit,
      tco2e,
      description: description || supplier || `Cat 2 - ${METHODS.find(m => m.key === activeMethod)?.label}`,
      siteId: mode === 'site' ? selectedSiteId : null,
    });

    setSupplier('');
    setApportionedEmission('');
    setQuantity('');
    setAvgEF('');
    setTotalSpend('');
    setSpendEF('');
    setDescription('');
    setSelectedMethod(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="h-4 w-4" /> 2. Capital Goods
        </CardTitle>
        <div className="flex items-center justify-between">
          <CardDescription>Three calculation methods — highest-quality data is used automatically</CardDescription>
          {entries.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-1 ml-2">
              <Download className="h-3.5 w-3.5" /> Export ({entries.length})
            </Button>
          )}
        </div>
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

        {/* Supplier name */}
        <div className="space-y-2">
          <Label>Supplier / Company Name</Label>
          <Input value={supplier} onChange={e => setSupplier(e.target.value)} placeholder="e.g. Acme Corp" />
        </div>

        {/* Three methods */}
        <div className="space-y-3">
          {METHODS.map(m => {
            const isActive = activeMethod === m.key;
            const isManuallySelected = selectedMethod === m.key;
            return (
              <div
                key={m.key}
                className={`rounded-lg border-2 p-4 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/50 bg-muted/20 opacity-70'
                }`}
                onClick={() => setSelectedMethod(m.key)}
              >
                <div className="flex items-center gap-2 mb-3">
                  {isActive ? (
                    <CheckCircle className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{m.label}</span>
                  <Badge variant={m.priority === 1 ? 'default' : m.priority === 2 ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                    Priority {m.priority}
                  </Badge>
                  {isActive && activeMethod === autoMethod && !isManuallySelected && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30">
                      Auto-selected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-3">{m.description}</p>

                {m.key === 'supplier' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Apportioned Emission (kg CO₂e)</Label>
                      <Input type="number" value={apportionedEmission} onChange={e => setApportionedEmission(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    {isActive && apportionedEmission && (
                      <div className="flex items-end">
                        <p className="text-xs text-muted-foreground">
                          = <span className="font-semibold text-foreground">{(parseFloat(apportionedEmission) / 1000).toFixed(4)}</span> tCO₂e
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {m.key === 'average' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    <div className="flex items-end">
                      <Badge variant="secondary" className="text-[10px] px-2 py-1 gap-1">
                        <AlertCircle className="h-3 w-3" /> Emission factor assigned by AI
                      </Badge>
                    </div>
                  </div>
                )}

                {m.key === 'spend' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Total Spend ($)</Label>
                      <Input type="number" value={totalSpend} onChange={e => setTotalSpend(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    <div className="flex items-end">
                      <Badge variant="secondary" className="text-[10px] px-2 py-1 gap-1">
                        <AlertCircle className="h-3 w-3" /> Emission factor assigned by AI
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Description + calculated total */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div className="space-y-2">
            <Label>Description / Notes</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Manufacturing equipment" />
          </div>
          <div className="flex items-end gap-3">
            {activeMethod === 'supplier' && calculatedEmission > 0 && (
              <div className="text-right flex-1">
                <p className="text-2xl font-bold text-primary">{calculatedEmission.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">tCO₂e via {METHODS.find(m => m.key === activeMethod)?.label}</p>
              </div>
            )}
            {activeMethod !== 'supplier' && canAdd && (
              <div className="text-right flex-1">
                <p className="text-sm font-semibold text-muted-foreground">tCO₂e pending</p>
                <p className="text-xs text-muted-foreground">AI will assign emission factor</p>
              </div>
            )}
            <Button onClick={handleAdd} disabled={!canAdd || isCalculating || (mode === 'site' && !selectedSiteId)} className="whitespace-nowrap">
              {isCalculating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</> : <><Plus className="mr-2 h-4 w-4" /> Add Entry</>}
            </Button>
          </div>
        </div>
        {/* Bulk Import Section */}
        <BulkImportSection onAdd={onAdd} onAddBatch={onAddBatch} sites={sites} mode={mode} selectedSiteId={selectedSiteId} />
      </CardContent>
    </Card>
  );
};

// --- Bulk Import Component ---

interface ParsedRow {
  supplier: string;
  method: Method;
  apportionedEmission?: number;
  quantity?: number;
  emissionFactor?: number;
  totalSpend?: number;
  spendEF?: number;
  description: string;
  tco2e: number;
  valid: boolean;
  error?: string;
}

const TEMPLATE_COLUMNS = [
  'Supplier',
  'Method (supplier/average/spend)',
  'Apportioned Emission (kg CO2e)',
  'Quantity',
  'Total Spend ($)',
  'Description',
];

const BulkImportSection = ({ onAdd, onAddBatch, sites, mode, selectedSiteId }: {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch?: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  mode: 'global' | 'site';
  selectedSiteId: string | null;
}) => {
  const [showImport, setShowImport] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const sampleData = [
      TEMPLATE_COLUMNS,
      ['Acme Corp', 'supplier', '5000', '', '', 'Manufacturing equipment'],
      ['Widget Inc', 'average', '', '100', '', 'Machinery parts'],
      ['Office Depot', 'spend', '', '', '25000', 'IT equipment'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    ws['!cols'] = TEMPLATE_COLUMNS.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Capital Goods');
    XLSX.writeFile(wb, 'scope3_cat2_template.xlsx');
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

        const parsed: ParsedRow[] = dataRows.map((row) => {
          const supplier = String(row[0] || '').trim();
          const methodRaw = String(row[1] || '').trim().toLowerCase();
          const apportioned = parseFloat(row[2]) || 0;
          const qty = parseFloat(row[3]) || 0;
          const spend = parseFloat(row[4]) || 0;
          const desc = String(row[5] || '').trim();

          let method: Method = 'spend';
          if (methodRaw === 'supplier' || methodRaw === 'supplier-specific') method = 'supplier';
          else if (methodRaw === 'average') method = 'average';
          else if (methodRaw === 'spend') method = 'spend';
          else if (apportioned > 0) method = 'supplier';
          else if (qty > 0) method = 'average';

          let tco2e = 0;
          let valid = true;
          let error: string | undefined;

          switch (method) {
            case 'supplier':
              if (apportioned > 0) { tco2e = apportioned / 1000; }
              else { valid = false; error = 'Missing apportioned emission'; }
              break;
            case 'average':
              if (qty > 0) { tco2e = 0; }
              else { valid = false; error = 'Missing quantity'; }
              break;
            case 'spend':
              if (spend > 0) { tco2e = 0; }
              else { valid = false; error = 'Missing total spend'; }
              break;
          }

          return { supplier, method, apportionedEmission: apportioned, quantity: qty, totalSpend: spend, description: desc || supplier, tco2e, valid, error };
        });

        setParsedRows(parsed);
        if (parsed.length === 0) toast.error('No data rows found');
        else toast.success(`Parsed ${parsed.length} rows`);
      } catch (err) {
        toast.error('Failed to parse file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportAll = async () => {
    const validRows = parsedRows.filter(r => r.valid);
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }

    setImporting(true);

    const allNewEntries: Omit<Scope3Entry, 'id'>[] = [];

    const supplierRows = validRows.filter(r => r.method === 'supplier');
    const aiRows = validRows.filter(r => r.method !== 'supplier');

    supplierRows.forEach(row => {
      allNewEntries.push({ categoryCode: 'capital_goods', type: 'supplier_specific', quantity: row.apportionedEmission || 0, unit: 'kg CO₂e', tco2e: row.tco2e, description: row.description, siteId: mode === 'site' ? selectedSiteId : null });
    });

    if (aiRows.length > 0) {
      try {
        const { data, error } = await supabase.functions.invoke('assign-emission-factor', {
          body: {
            entries: aiRows.map(row => ({
              supplier: row.supplier || 'Unknown',
              description: row.description || row.supplier || 'General',
              method: row.method,
              quantity: row.method === 'average' ? row.quantity : undefined,
              totalSpend: row.method === 'spend' ? row.totalSpend : undefined,
              category: 'capital_goods',
            })),
          },
        });

        if (error) throw error;

        aiRows.forEach((row, i) => {
          const result = data?.results?.[i];
          const tco2e = result?.tco2e || 0;
          const type = row.method === 'average' ? 'average_method' : 'spend_based';
          const qty = row.method === 'average' ? (row.quantity || 0) : (row.totalSpend || 0);
          const unit = row.method === 'average' ? 'units' : '$';
          allNewEntries.push({ categoryCode: 'capital_goods', type, quantity: qty, unit, tco2e, description: row.description, siteId: mode === 'site' ? selectedSiteId : null });
        });

        toast.success(`Imported ${validRows.length} entries (${aiRows.length} with AI-assigned EF)`);
      } catch (err) {
        console.error('AI bulk EF failed:', err);
        aiRows.forEach(row => {
          const type = row.method === 'average' ? 'average_method' : 'spend_based';
          const qty = row.method === 'average' ? (row.quantity || 0) : (row.totalSpend || 0);
          const unit = row.method === 'average' ? 'units' : '$';
          allNewEntries.push({ categoryCode: 'capital_goods', type, quantity: qty, unit, tco2e: 0, description: row.description, siteId: mode === 'site' ? selectedSiteId : null });
        });
        toast.warning(`Imported ${validRows.length} entries but AI EF assignment failed.`);
      }
    } else {
      toast.success(`Imported ${validRows.length} entries`);
    }

    // Add all entries at once using batch method
    if (onAddBatch) {
      onAddBatch(allNewEntries);
    } else {
      allNewEntries.forEach(entry => onAdd(entry));
    }

    setParsedRows([]);
    setShowImport(false);
    setImporting(false);
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;
  const totalTco2e = parsedRows.filter(r => r.valid).reduce((s, r) => s + r.tco2e, 0);
  const aiPendingCount = parsedRows.filter(r => r.valid && r.method !== 'supplier').length;

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Bulk Import</span>
          <span className="text-xs text-muted-foreground">CSV / Excel</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
            <Download className="h-3.5 w-3.5" /> Template
          </Button>
          <Button variant={showImport ? 'secondary' : 'outline'} size="sm" onClick={() => { setShowImport(!showImport); setParsedRows([]); }} className="gap-1">
            <Upload className="h-3.5 w-3.5" /> {showImport ? 'Cancel' : 'Import'}
          </Button>
        </div>
      </div>

      {showImport && (
        <div className="space-y-3">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
          {parsedRows.length === 0 ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border">
                <div className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">{validCount} valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{invalidCount} errors</span>
                  </div>
                )}
                <div className="ml-auto text-right">
                  {totalTco2e > 0 && <span className="text-sm font-bold text-primary">{totalTco2e.toFixed(4)} tCO₂e</span>}
                  {aiPendingCount > 0 && <span className="text-xs text-muted-foreground ml-2">+ {aiPendingCount} pending AI EF</span>}
                </div>
              </div>

              <div className="max-h-60 overflow-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Supplier</th>
                      <th className="text-left p-2">Method</th>
                      <th className="text-right p-2">tCO₂e</th>
                      <th className="text-left p-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr key={i} className={`border-t ${!row.valid ? 'bg-destructive/5' : ''}`}>
                        <td className="p-2">
                          {row.valid ? <Check className="h-3.5 w-3.5 text-green-600" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        </td>
                        <td className="p-2">{row.supplier || '—'}</td>
                        <td className="p-2 capitalize">{row.method}</td>
                        <td className="p-2 text-right font-mono">{row.valid ? row.tco2e.toFixed(4) : '—'}</td>
                        <td className="p-2">{row.error ? <span className="text-destructive">{row.error}</span> : row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setParsedRows([]); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
                <Button size="sm" onClick={handleImportAll} disabled={validCount === 0 || importing || (mode === 'site' && !selectedSiteId)} className="gap-1">
                  {importing ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating...</> : <><Check className="h-3.5 w-3.5" /> Import {validCount} Entries</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

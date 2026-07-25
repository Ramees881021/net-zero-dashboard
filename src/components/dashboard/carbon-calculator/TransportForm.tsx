import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Truck, ShoppingCart, Globe, MapPin, Check, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { SPEND_FACTORS } from '@/lib/emission-factors';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

// Freight transport emission factors (tCO₂e per tonne.km) — DEFRA 2025
const FREIGHT_MODES = {
  road_hgv_avg: { label: 'Road – HGV (all, avg laden)', factor: 0.000105, unit: 'tonne.km', source: 'DEFRA 2025' },
  road_hgv_rigid: { label: 'Road – HGV Rigid', factor: 0.000148, unit: 'tonne.km', source: 'DEFRA 2025' },
  road_hgv_artic: { label: 'Road – HGV Articulated', factor: 0.000089, unit: 'tonne.km', source: 'DEFRA 2025' },
  road_van: { label: 'Road – Van', factor: 0.000583, unit: 'tonne.km', source: 'DEFRA 2025' },
  rail_freight: { label: 'Rail Freight', factor: 0.000025, unit: 'tonne.km', source: 'DEFRA 2025' },
  sea_container: { label: 'Sea – Container Ship', factor: 0.000016, unit: 'tonne.km', source: 'DEFRA 2025' },
  sea_bulk: { label: 'Sea – Bulk Carrier', factor: 0.000005, unit: 'tonne.km', source: 'DEFRA 2025' },
  sea_tanker: { label: 'Sea – Tanker', factor: 0.000005, unit: 'tonne.km', source: 'DEFRA 2025' },
  sea_ro_ro: { label: 'Sea – Ro-Ro Ferry', factor: 0.000168, unit: 'tonne.km', source: 'DEFRA 2025' },
  air_domestic: { label: 'Air Freight – Domestic', factor: 0.002459, unit: 'tonne.km', source: 'DEFRA 2025' },
  air_short_haul: { label: 'Air Freight – Short-Haul', factor: 0.001217, unit: 'tonne.km', source: 'DEFRA 2025' },
  air_long_haul: { label: 'Air Freight – Long-Haul', factor: 0.000606, unit: 'tonne.km', source: 'DEFRA 2025' },
  courier_parcel: { label: 'Courier / Parcel Delivery', factor: 0.000890, unit: 'tonne.km', source: 'DEFRA 2025 (estimated)' },
} as const;

interface TransportFormProps {
  direction: 'upstream' | 'downstream';
  categoryCode: string;
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
}

export const TransportForm = ({
  direction,
  categoryCode,
  onAdd,
  onAddBatch,
  sites,
  entries,
}: TransportFormProps) => {
  const [method, setMethod] = useState<'activity' | 'spend'>('activity');

  // Activity state
  const [freightMode, setFreightMode] = useState('');
  const [weight, setWeight] = useState('');
  const [distance, setDistance] = useState('');
  const [desc, setDesc] = useState('');
  const [dataMode, setDataMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites[0]?.id || null);

  // Spend state
  const [spend, setSpend] = useState('');
  const [spendDesc, setSpendDesc] = useState('');

  // Import preview
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);

  const dirLabel = direction === 'upstream' ? 'Upstream' : 'Downstream';
  const spendFactor = SPEND_FACTORS.upstream_transport; // 0.18 tCO₂e/£k

  const selectedMode = freightMode ? FREIGHT_MODES[freightMode as keyof typeof FREIGHT_MODES] : null;

  const handleAddActivity = () => {
    if (!freightMode || !weight || !distance || !selectedMode) return;
    const w = parseFloat(weight);
    const d = parseFloat(distance);
    const tonneKm = w * d;
    const tco2e = tonneKm * selectedMode.factor;
    onAdd({
      categoryCode,
      type: freightMode,
      quantity: tonneKm,
      unit: 'tonne.km',
      tco2e,
      description: desc || `${dirLabel}: ${selectedMode.label} – ${w}t × ${d}km`,
      siteId: dataMode === 'site' ? selectedSiteId : null,
    });
    setWeight(''); setDistance(''); setDesc('');
  };

  const handleAddSpend = () => {
    if (!spend) return;
    const s = parseFloat(spend);
    onAdd({
      categoryCode,
      type: 'spend_based',
      quantity: s,
      unit: '£k',
      tco2e: s * spendFactor.factor,
      description: spendDesc || `${dirLabel} transport spend`,
      siteId: dataMode === 'site' ? selectedSiteId : null,
    });
    setSpend(''); setSpendDesc('');
  };

  // ── Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Activity sheet
    const actHeaders = ['Transport Mode', 'Weight (tonnes)', 'Distance (km)', 'Description', 'Site Name (optional)'];
    const actExample = ['Road – HGV (all, avg laden)', '10', '500', 'Supplier delivery from Manchester', ''];
    const actWs = XLSX.utils.aoa_to_sheet([actHeaders, actExample]);
    actWs['!cols'] = actHeaders.map(() => ({ wch: 30 }));
    XLSX.utils.book_append_sheet(wb, actWs, 'Activity-Based');

    // Spend sheet
    const spendHeaders = ['Spend (£k)', 'Description', 'Site Name (optional)'];
    const spendExample = ['150', 'Annual freight costs', ''];
    const spendWs = XLSX.utils.aoa_to_sheet([spendHeaders, spendExample]);
    spendWs['!cols'] = spendHeaders.map(() => ({ wch: 30 }));
    XLSX.utils.book_append_sheet(wb, spendWs, 'Spend-Based');

    // Reference sheet
    const refData: string[][] = [['Transport Mode', 'Factor (tCO₂e/tonne.km)', 'Source']];
    Object.entries(FREIGHT_MODES).forEach(([, v]) => {
      refData.push([v.label, String(v.factor), v.source]);
    });
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference');

    XLSX.writeFile(wb, `${categoryCode}_transport_template.xlsx`);
    toast.success('Template downloaded');
  };

  // ── Import ──
  const MODE_LABEL_MAP: Record<string, string> = {};
  Object.entries(FREIGHT_MODES).forEach(([key, v]) => {
    MODE_LABEL_MAP[v.label.toLowerCase()] = key;
  });

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const parsed: Omit<Scope3Entry, 'id'>[] = [];

        // Parse Activity sheet
        const actSheet = wb.Sheets['Activity-Based'] || wb.Sheets[wb.SheetNames[0]];
        if (actSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(actSheet);
          rows.forEach((row: any) => {
            const modeLabel = String(row['Transport Mode'] || '').trim();
            const modeKey = MODE_LABEL_MAP[modeLabel.toLowerCase()];
            if (!modeKey) return;
            const mode = FREIGHT_MODES[modeKey as keyof typeof FREIGHT_MODES];
            const w = parseFloat(row['Weight (tonnes)'] || 0);
            const d = parseFloat(row['Distance (km)'] || 0);
            if (!w || !d) return;
            const tonneKm = w * d;
            const description = String(row['Description'] || `${dirLabel}: ${mode.label}`);
            const siteName = String(row['Site Name (optional)'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            parsed.push({
              categoryCode,
              type: modeKey,
              quantity: tonneKm,
              unit: 'tonne.km',
              tco2e: tonneKm * mode.factor,
              description,
              siteId: siteMatch?.id || null,
            });
          });
        }

        // Parse Spend sheet
        const spendSheet = wb.Sheets['Spend-Based'];
        if (spendSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(spendSheet);
          rows.forEach((row: any) => {
            const s = parseFloat(row['Spend (£k)'] || 0);
            if (!s) return;
            const description = String(row['Description'] || `${dirLabel} transport spend`);
            const siteName = String(row['Site Name (optional)'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            parsed.push({
              categoryCode,
              type: 'spend_based',
              quantity: s,
              unit: '£k',
              tco2e: s * spendFactor.factor,
              description,
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

  // ── Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.info('No entries to export'); return; }
    const wb = XLSX.utils.book_new();

    const actEntries = entries.filter(e => e.type !== 'spend_based');
    const spendEntries = entries.filter(e => e.type === 'spend_based');

    if (actEntries.length > 0) {
      const rows = actEntries.map(e => {
        const mode = FREIGHT_MODES[e.type as keyof typeof FREIGHT_MODES];
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return {
          'Transport Mode': mode?.label || e.type,
          'Tonne.km': e.quantity,
          'Factor (tCO₂e/tonne.km)': mode?.factor || '',
          'Description': e.description,
          'tCO₂e': parseFloat(e.tco2e.toFixed(6)),
          'Site': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Activity-Based');
    }

    if (spendEntries.length > 0) {
      const rows = spendEntries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return {
          'Spend (£k)': e.quantity,
          'Description': e.description,
          'tCO₂e': parseFloat(e.tco2e.toFixed(6)),
          'Site': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Spend-Based');
    }

    XLSX.writeFile(wb, `${categoryCode}_transport_export.xlsx`);
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <div className="space-y-4">
      {/* Bulk Operations Bar */}
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
                    <span className="font-medium">🚛 {e.description || e.type}</span>
                    <span className="text-muted-foreground ml-2">{e.quantity.toLocaleString()} {e.unit}</span>
                  </div>
                  <span className="font-semibold">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { onAddBatch(importPreview); setImportPreview(null); toast.success(`Imported ${importPreview.length} entries`); }} className="gap-1">
                <Check className="h-4 w-4" /> Confirm Import
              </Button>
              <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Method toggle */}
      <div className="flex gap-2">
        <Button
          variant={method === 'activity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('activity')}
          className="gap-1"
        >
          <Truck className="h-4 w-4" /> Activity-Based (tonne.km)
        </Button>
        <Button
          variant={method === 'spend' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('spend')}
          className="gap-1"
        >
          <ShoppingCart className="h-4 w-4" /> Spend-Based
        </Button>
      </div>

      {/* Data level selector */}
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

      {method === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4" /> {dirLabel} Transportation — Activity-Based
            </CardTitle>
            <CardDescription>
              Weight × Distance × Mode-specific emission factor (tCO₂e per tonne.km, DEFRA 2025)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Transport Mode</Label>
                <Select value={freightMode} onValueChange={setFreightMode}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREIGHT_MODES).map(([key, m]) => (
                      <SelectItem key={key} value={key}>
                        {m.label}
                        <span className="text-muted-foreground ml-1 text-xs">({m.factor})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Weight (tonnes)</Label>
                <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Distance (km)</Label>
                <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder={`e.g. ${direction === 'upstream' ? 'Supplier delivery' : 'Customer shipment'}`} />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleAddActivity}
                  disabled={!freightMode || !weight || !distance || (dataMode === 'site' && !selectedSiteId)}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
              {selectedMode && weight && distance && (
                <p className="col-span-full text-xs text-muted-foreground">
                  {parseFloat(weight).toLocaleString()} t × {parseFloat(distance).toLocaleString()} km
                  = {(parseFloat(weight) * parseFloat(distance)).toLocaleString()} tonne.km
                  × {selectedMode.factor} = <strong>{(parseFloat(weight) * parseFloat(distance) * selectedMode.factor).toFixed(4)} tCO₂e</strong>
                  &nbsp;· Source: {selectedMode.source}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {method === 'spend' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> {dirLabel} Transportation — Spend-Based
            </CardTitle>
            <CardDescription>
              Factor: {spendFactor.factor} tCO₂e per £k spent ({spendFactor.source})
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total Spend (£/$ thousands)</Label>
              <Input type="number" value={spend} onChange={e => setSpend(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={spendDesc} onChange={e => setSpendDesc(e.target.value)} placeholder={`e.g. ${direction === 'upstream' ? 'Inbound logistics' : 'Outbound shipping'} costs`} />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddSpend} disabled={!spend || (dataMode === 'site' && !selectedSiteId)} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
            {spend && (
              <p className="col-span-full text-xs text-muted-foreground">
                = {(parseFloat(spend) * spendFactor.factor).toFixed(3)} tCO₂e · Factor: {spendFactor.factor} tCO₂e/£k · Source: {spendFactor.source}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

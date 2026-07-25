import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Zap, Thermometer, Pencil, Check, X, Download, Upload, FileDown, Eraser } from 'lucide-react';
import { GRID_REGIONS } from '@/lib/emission-factors';
import { getGridFactorForSite } from '@/lib/country-emission-factors';
import { useScope2BulkOperations } from '@/hooks/useScope2BulkOperations';
import type { Site } from './SiteManager';

export interface Scope2Entry {
  id: string;
  subCategory: 'electricity' | 'heat_steam';
  gridRegion: string;
  quantity: number;
  unit: string;
  method: 'location' | 'market';
  tco2e: number;
  description: string;
  renewablePercentage: number;
  emissionFactor?: number;
  emissionFactorSource?: string;
}

interface Scope2FormProps {
  entries: Scope2Entry[];
  onChange: (entries: Scope2Entry[]) => void;
  site?: Site | null;
}

const genId = () => crypto.randomUUID();

export const Scope2Form = ({ entries, onChange, site }: Scope2FormProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Scope2Entry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { downloadTemplate, exportData, importData } = useScope2BulkOperations();
  const totalScope2 = entries.reduce((sum, e) => sum + e.tco2e, 0);
  const siteGridFactor = site ? getGridFactorForSite(site.country, site.state) : null;

  const handleImport = async (file: File) => {
    const result = await importData(file);
    if (result.success && result.entries.length > 0) {
      onChange([...entries, ...result.entries]);
    }
  };

  const addElectricity = (kwh: number, renewablePct: number, method: 'location' | 'market', desc: string, customRegion?: string) => {
    let factor = 0;
    let regionLabel = '';

    if (siteGridFactor) {
      factor = siteGridFactor.factor;
      regionLabel = siteGridFactor.label;
    } else if (customRegion) {
      const grid = GRID_REGIONS[customRegion as keyof typeof GRID_REGIONS];
      if (grid) { factor = grid.factor; regionLabel = grid.label; }
    }
    if (factor === 0) return;

    const netKwh = method === 'market' ? kwh * (1 - renewablePct / 100) : kwh;
    onChange([...entries, {
      id: genId(), subCategory: 'electricity', gridRegion: regionLabel,
      quantity: kwh, unit: 'kWh', method, tco2e: netKwh * factor, description: desc,
      renewablePercentage: renewablePct,
      emissionFactor: factor, emissionFactorSource: `IEA/DEFRA 2025 – Grid Electricity (${regionLabel})`,
    }]);
  };

  const addHeatSteam = (kwh: number, factor: number, desc: string) => {
    onChange([...entries, {
      id: genId(), subCategory: 'heat_steam', gridRegion: '',
      quantity: kwh, unit: 'kWh', method: 'location', tco2e: kwh * factor,
      description: desc, renewablePercentage: 0,
      emissionFactor: factor, emissionFactorSource: 'UK DEFRA 2025 – Heat & Steam',
    }]);
  };

  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const startEdit = (entry: Scope2Entry) => { setEditingId(entry.id); setEditDraft({ ...entry }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const saveEdit = () => {
    if (!editDraft) return;
    // Recalculate
    let tco2e = editDraft.tco2e;
    if (editDraft.subCategory === 'electricity') {
      let factor = siteGridFactor?.factor || 0;
      if (!factor) {
        // Try to find factor from gridRegion label
        const regionEntry = Object.entries(GRID_REGIONS).find(([, r]) => r.label === editDraft.gridRegion);
        if (regionEntry) factor = regionEntry[1].factor;
      }
      if (factor) {
        const netKwh = editDraft.method === 'market' ? editDraft.quantity * (1 - editDraft.renewablePercentage / 100) : editDraft.quantity;
        tco2e = netKwh * factor;
      }
    } else {
      // heat_steam - keep manual factor, just recalc with quantity
      // We don't store the factor, so keep existing tco2e ratio
      const oldEntry = entries.find(e => e.id === editDraft.id);
      if (oldEntry && oldEntry.quantity > 0) {
        const impliedFactor = oldEntry.tco2e / oldEntry.quantity;
        tco2e = editDraft.quantity * impliedFactor;
      }
    }
    onChange(entries.map(e => e.id === editDraft.id ? { ...editDraft, tco2e } : e));
    cancelEdit();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Scope 2: Indirect Energy Emissions</h3>
          <p className="text-sm text-muted-foreground">Emissions from purchased electricity, heat, steam, and cooling</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-right mr-2">
            <p className="text-2xl font-bold" style={{ color: 'hsl(199, 89%, 48%)' }}>{totalScope2.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">tCO₂e total</p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1">
            <Download className="h-4 w-4" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1">
            <Upload className="h-4 w-4" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportData(entries)} disabled={entries.length === 0} className="gap-1">
            <FileDown className="h-4 w-4" /> Export
          </Button>
          {entries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onChange([])}
            >
              <Eraser className="h-4 w-4" /> Clear All
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleImport(e.target.files[0]); e.target.value = ''; } }}
          />
        </div>
      </div>

      {siteGridFactor && (
        <div className="text-xs bg-muted/40 border rounded-lg p-3 flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span>Grid factor for <strong>{siteGridFactor.label}</strong>: {(siteGridFactor.factor * 1000000).toFixed(0)} gCO₂e/kWh · Source: {siteGridFactor.source}</span>
        </div>
      )}

      <ElectricityForm onAdd={addElectricity} siteGridFactor={siteGridFactor} />
      <HeatSteamForm onAdd={addHeatSteam} />

      {entries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Scope 2 Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id}>
                  {editingId === e.id && editDraft ? (
                    <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity (kWh)</Label>
                          <Input type="number" className="h-8" value={editDraft.quantity} onChange={ev => setEditDraft({ ...editDraft, quantity: parseFloat(ev.target.value) || 0 })} />
                        </div>
                        {editDraft.subCategory === 'electricity' && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Method</Label>
                              <Select value={editDraft.method} onValueChange={v => setEditDraft({ ...editDraft, method: v as any })}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="location">Location-based</SelectItem>
                                  <SelectItem value="market">Market-based</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Renewable %</Label>
                              <Input type="number" className="h-8" min="0" max="100" value={editDraft.renewablePercentage} onChange={ev => setEditDraft({ ...editDraft, renewablePercentage: parseFloat(ev.target.value) || 0 })} />
                            </div>
                          </>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input className="h-8" value={editDraft.description} onChange={ev => setEditDraft({ ...editDraft, description: ev.target.value })} />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={saveEdit} className="gap-1"><Check className="h-3.5 w-3.5" /> Save</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{e.description || e.subCategory}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.quantity.toLocaleString()} {e.unit}
                          {e.subCategory === 'electricity' && ` · ${e.method}-based`}
                          {e.gridRegion && ` · ${e.gridRegion}`}
                          {e.renewablePercentage > 0 && ` · ${e.renewablePercentage}% renewable`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{e.tco2e.toFixed(3)} tCO₂e</span>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeEntry(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ElectricityForm = ({ onAdd, siteGridFactor }: {
  onAdd: (kwh: number, renewablePct: number, method: 'location' | 'market', desc: string, customRegion?: string) => void;
  siteGridFactor: { factor: number; source: string; label: string } | null;
}) => {
  const [region, setRegion] = useState('');
  const [kwh, setKwh] = useState('');
  const [renewable, setRenewable] = useState('0');
  const [method, setMethod] = useState<'location' | 'market'>('location');
  const [desc, setDesc] = useState('');
  const activeFactor = siteGridFactor?.factor || (region ? GRID_REGIONS[region as keyof typeof GRID_REGIONS]?.factor : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Purchased Electricity</CardTitle>
        <CardDescription>
          {siteGridFactor ? `Grid factor auto-set from site country: ${siteGridFactor.label}` : 'Select grid region or add a country to your site'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {!siteGridFactor && (
          <div className="space-y-2">
            <Label>Grid Region (fallback)</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>{Object.entries(GRID_REGIONS).map(([key, r]) => <SelectItem key={key} value={key}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Consumption (kWh)</Label>
          <Input type="number" value={kwh} onChange={e => setKwh(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Renewable %</Label>
          <Input type="number" min="0" max="100" value={renewable} onChange={e => setRenewable(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={v => setMethod(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="location">Location-based</SelectItem>
              <SelectItem value="market">Market-based</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. HQ Office" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (kwh && (siteGridFactor || region)) { onAdd(parseFloat(kwh), parseFloat(renewable || '0'), method, desc, region || undefined); setKwh(''); setDesc(''); } }} disabled={!kwh || (!siteGridFactor && !region)} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        {activeFactor && kwh && (
          <p className="col-span-full text-xs text-muted-foreground">
            = {(parseFloat(kwh) * activeFactor).toFixed(4)} tCO₂e · Factor: {(activeFactor * 1000000).toFixed(0)} gCO₂e/kWh
            {method === 'market' && parseFloat(renewable || '0') > 0 && ` · Net kWh after RECs: ${(parseFloat(kwh) * (1 - parseFloat(renewable || '0') / 100)).toLocaleString()}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const HeatSteamForm = ({ onAdd }: { onAdd: (kwh: number, factor: number, desc: string) => void }) => {
  const [kwh, setKwh] = useState('');
  const [factor, setFactor] = useState('0.000185');
  const [desc, setDesc] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Thermometer className="h-4 w-4" /> Purchased Heat/Steam/Cooling</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Energy (kWh)</Label>
          <Input type="number" value={kwh} onChange={e => setKwh(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Emission Factor (tCO₂e/kWh)</Label>
          <Input type="number" value={factor} onChange={e => setFactor(e.target.value)} step="0.000001" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. District heating" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (kwh) { onAdd(parseFloat(kwh), parseFloat(factor), desc); setKwh(''); setDesc(''); } }} disabled={!kwh} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

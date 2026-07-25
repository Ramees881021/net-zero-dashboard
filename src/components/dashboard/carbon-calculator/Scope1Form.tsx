import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Flame, Truck, Factory, Snowflake, Pencil, Check, X, Download, Upload, FileDown, Eraser } from 'lucide-react';
import { FUEL_TYPES, VEHICLE_TYPES, REFRIGERANT_TYPES } from '@/lib/emission-factors';
import { useScope1BulkOperations } from '@/hooks/useScope1BulkOperations';

export interface Scope1Entry {
  id: string;
  subCategory: 'stationary' | 'mobile' | 'process' | 'fugitive';
  type: string;
  quantity: number;
  unit: string;
  tco2e: number;
  description: string;
  emissionFactor?: number;
  emissionFactorSource?: string;
}

interface Scope1FormProps {
  entries: Scope1Entry[];
  onChange: (entries: Scope1Entry[]) => void;
}

const genId = () => crypto.randomUUID();

// Recalculate tCO2e for a given entry
const recalcScope1 = (entry: Scope1Entry): Scope1Entry => {
  let tco2e = 0;
  if (entry.subCategory === 'stationary') {
    const fuel = FUEL_TYPES[entry.type as keyof typeof FUEL_TYPES];
    if (fuel) tco2e = entry.quantity * fuel.factor;
  } else if (entry.subCategory === 'mobile') {
    const vehicle = VEHICLE_TYPES[entry.type as keyof typeof VEHICLE_TYPES];
    if (vehicle) tco2e = entry.quantity * vehicle.factor;
  } else if (entry.subCategory === 'fugitive') {
    const ref = REFRIGERANT_TYPES[entry.type as keyof typeof REFRIGERANT_TYPES];
    if (ref) tco2e = (entry.quantity / 1000) * ref.gwp;
  } else if (entry.subCategory === 'process') {
    tco2e = entry.quantity;
  }
  return { ...entry, tco2e };
};

export const Scope1Form = ({ entries, onChange }: Scope1FormProps) => {
  const [activeSection, setActiveSection] = useState<string>('stationary');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Scope1Entry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { downloadTemplate, exportData, importData } = useScope1BulkOperations();

  const handleImport = async (file: File) => {
    const result = await importData(file);
    if (result.success && result.entries.length > 0) {
      onChange([...entries, ...result.entries]);
    }
  };

  const addEntry = (subCategory: Scope1Entry['subCategory'], type: string, quantity: number, description: string) => {
    let tco2e = 0;
    let unit = '';
    let emissionFactor: number | undefined;
    let emissionFactorSource: string | undefined;

    if (subCategory === 'stationary') {
      const fuel = FUEL_TYPES[type as keyof typeof FUEL_TYPES];
      if (fuel) { tco2e = quantity * fuel.factor; unit = fuel.unit; emissionFactor = fuel.factor; emissionFactorSource = `UK DEFRA 2025 – Stationary Combustion (${fuel.label})`; }
    } else if (subCategory === 'mobile') {
      const vehicle = VEHICLE_TYPES[type as keyof typeof VEHICLE_TYPES];
      if (vehicle) { tco2e = quantity * vehicle.factor; unit = vehicle.unit; emissionFactor = vehicle.factor; emissionFactorSource = `UK DEFRA 2025 – Mobile Combustion (${vehicle.label})`; }
    } else if (subCategory === 'fugitive') {
      const ref = REFRIGERANT_TYPES[type as keyof typeof REFRIGERANT_TYPES];
      if (ref) { tco2e = (quantity / 1000) * ref.gwp; unit = 'kg leaked'; emissionFactor = ref.gwp; emissionFactorSource = `IPCC AR6 – Refrigerant GWP (${ref.label})`; }
    } else if (subCategory === 'process') {
      tco2e = quantity; unit = 'tCO2e (direct)'; emissionFactorSource = 'Direct measurement';
    }

    onChange([...entries, { id: genId(), subCategory, type, quantity, unit, tco2e, description, emissionFactor, emissionFactorSource }]);
  };

  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const startEdit = (entry: Scope1Entry) => {
    setEditingId(entry.id);
    setEditDraft({ ...entry });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (!editDraft) return;
    const updated = recalcScope1(editDraft);
    onChange(entries.map(e => e.id === updated.id ? updated : e));
    setEditingId(null);
    setEditDraft(null);
  };

  const totalScope1 = entries.reduce((sum, e) => sum + e.tco2e, 0);

  const sections = [
    { key: 'stationary', label: 'Stationary Combustion', icon: Flame, desc: 'Boilers, furnaces, generators' },
    { key: 'mobile', label: 'Mobile Combustion', icon: Truck, desc: 'Fleet vehicles' },
    { key: 'process', label: 'Process Emissions', icon: Factory, desc: 'Industrial processes' },
    { key: 'fugitive', label: 'Fugitive Emissions', icon: Snowflake, desc: 'Refrigerants & gas leaks' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold">Scope 1: Direct Emissions</h3>
          <p className="text-sm text-muted-foreground">Emissions from sources your company owns or controls</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-right mr-2">
            <p className="text-2xl font-bold text-primary">{totalScope1.toFixed(2)}</p>
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) { handleImport(e.target.files[0]); e.target.value = ''; } }}
          />
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        {sections.map(s => {
          const count = entries.filter(e => e.subCategory === s.key).length;
          return (
            <Button
              key={s.key}
              variant={activeSection === s.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(s.key)}
              className="gap-2"
            >
              <s.icon className="h-4 w-4" />
              {s.label}
              {count > 0 && <span className="text-xs opacity-70">({count})</span>}
            </Button>
          );
        })}
        {entries.filter(e => e.subCategory === activeSection).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
            onClick={() => onChange(entries.filter(e => e.subCategory !== activeSection))}
          >
            <Eraser className="h-4 w-4" />
            Clear {sections.find(s => s.key === activeSection)?.label}
          </Button>
        )}
      </div>

      {activeSection === 'stationary' && (
        <StationaryForm onAdd={(type, qty, desc) => addEntry('stationary', type, qty, desc)} />
      )}
      {activeSection === 'mobile' && (
        <MobileForm onAdd={(type, qty, desc) => addEntry('mobile', type, qty, desc)} />
      )}
      {activeSection === 'process' && (
        <ProcessForm onAdd={(qty, desc) => addEntry('process', 'direct', qty, desc)} />
      )}
      {activeSection === 'fugitive' && (
        <FugitiveForm onAdd={(type, qty, desc) => addEntry('fugitive', type, qty, desc)} />
      )}

      {/* Entries list */}
      {entries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Scope 1 Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entries.map(e => (
                <div key={e.id}>
                  {editingId === e.id && editDraft ? (
                    <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          {editDraft.subCategory === 'stationary' ? (
                            <Select value={editDraft.type} onValueChange={v => setEditDraft({ ...editDraft, type: v })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(FUEL_TYPES).map(([k, f]) => <SelectItem key={k} value={k}>{f.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : editDraft.subCategory === 'mobile' ? (
                            <Select value={editDraft.type} onValueChange={v => setEditDraft({ ...editDraft, type: v })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(VEHICLE_TYPES).map(([k, v2]) => <SelectItem key={k} value={k}>{v2.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : editDraft.subCategory === 'fugitive' ? (
                            <Select value={editDraft.type} onValueChange={v => setEditDraft({ ...editDraft, type: v })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>{Object.entries(REFRIGERANT_TYPES).map(([k, r]) => <SelectItem key={k} value={k}>{r.label}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input value={editDraft.type} disabled className="h-8" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Quantity</Label>
                          <Input type="number" className="h-8" value={editDraft.quantity} onChange={ev => setEditDraft({ ...editDraft, quantity: parseFloat(ev.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input className="h-8" value={editDraft.description} onChange={ev => setEditDraft({ ...editDraft, description: ev.target.value })} />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button size="sm" onClick={saveEdit} className="gap-1"><Check className="h-3.5 w-3.5" /> Save</Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Updated: {recalcScope1(editDraft).tco2e.toFixed(4)} tCO₂e
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{e.description || e.type}</p>
                        <p className="text-xs text-muted-foreground capitalize">{e.subCategory} · {e.quantity} {e.unit}</p>
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

// Sub-forms
const StationaryForm = ({ onAdd }: { onAdd: (type: string, qty: number, desc: string) => void }) => {
  const [type, setType] = useState('');
  const [qty, setQty] = useState('');
  const [desc, setDesc] = useState('');
  const fuel = type ? FUEL_TYPES[type as keyof typeof FUEL_TYPES] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4" /> Add Stationary Combustion</CardTitle>
        <CardDescription>Fuel burned in boilers, furnaces, generators</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Fuel Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select fuel" /></SelectTrigger>
            <SelectContent>
              {Object.entries(FUEL_TYPES).map(([key, f]) => (
                <SelectItem key={key} value={key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Quantity {fuel ? `(${fuel.unit})` : ''}</Label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Main boiler" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (type && qty) { onAdd(type, parseFloat(qty), desc); setQty(''); setDesc(''); } }} disabled={!type || !qty} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        {fuel && qty && (
          <p className="col-span-full text-xs text-muted-foreground">
            = {(parseFloat(qty) * fuel.factor).toFixed(4)} tCO₂e · Factor: {fuel.factor} tCO₂e/{fuel.unit} · Source: {fuel.source}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const MobileForm = ({ onAdd }: { onAdd: (type: string, qty: number, desc: string) => void }) => {
  const [type, setType] = useState('');
  const [qty, setQty] = useState('');
  const [desc, setDesc] = useState('');
  const vehicle = type ? VEHICLE_TYPES[type as keyof typeof VEHICLE_TYPES] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Truck className="h-4 w-4" /> Add Mobile Combustion</CardTitle>
        <CardDescription>Company-owned/controlled vehicles</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Vehicle Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
            <SelectContent>
              {Object.entries(VEHICLE_TYPES).map(([key, v]) => (
                <SelectItem key={key} value={key}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Distance (km)</Label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Vehicle Name/ID</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Delivery Van #1" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (type && qty) { onAdd(type, parseFloat(qty), desc); setQty(''); setDesc(''); } }} disabled={!type || !qty} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        {vehicle && qty && (
          <p className="col-span-full text-xs text-muted-foreground">
            = {(parseFloat(qty) * vehicle.factor).toFixed(4)} tCO₂e · Factor: {vehicle.factor} tCO₂e/km · Source: {vehicle.source}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ProcessForm = ({ onAdd }: { onAdd: (qty: number, desc: string) => void }) => {
  const [qty, setQty] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Factory className="h-4 w-4" /> Add Process Emissions</CardTitle>
        <CardDescription>Direct emissions from industrial processes (cement, chemicals, steel)</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Emissions (tCO₂e)</Label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Process Description</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Cement kiln" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (qty) { onAdd(parseFloat(qty), desc); setQty(''); setDesc(''); } }} disabled={!qty} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const FugitiveForm = ({ onAdd }: { onAdd: (type: string, qty: number, desc: string) => void }) => {
  const [type, setType] = useState('');
  const [qty, setQty] = useState('');
  const [desc, setDesc] = useState('');
  const ref = type ? REFRIGERANT_TYPES[type as keyof typeof REFRIGERANT_TYPES] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Snowflake className="h-4 w-4" /> Add Fugitive Emissions</CardTitle>
        <CardDescription>Refrigerant leaks, SF6 from electrical equipment</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Refrigerant/Gas Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {Object.entries(REFRIGERANT_TYPES).map(([key, r]) => (
                <SelectItem key={key} value={key}>{r.label} (GWP: {r.gwp})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amount Leaked (kg)</Label>
          <Input type="number" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label>Equipment</Label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. AC Unit #3" />
        </div>
        <div className="flex items-end">
          <Button onClick={() => { if (type && qty) { onAdd(type, parseFloat(qty), desc); setQty(''); setDesc(''); } }} disabled={!type || !qty} className="w-full">
            <Plus className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        {ref && qty && (
          <p className="col-span-full text-xs text-muted-foreground">
            = {((parseFloat(qty) / 1000) * ref.gwp).toFixed(4)} tCO₂e · GWP: {ref.gwp} · {parseFloat(qty)} kg leaked
          </p>
        )}
      </CardContent>
    </Card>
  );
};

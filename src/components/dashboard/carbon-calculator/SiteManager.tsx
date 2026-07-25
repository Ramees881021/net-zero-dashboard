import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, MapPin, Building2, Download, Upload, FileSpreadsheet, X, Check } from 'lucide-react';
import { COUNTRIES, US_STATES, CA_PROVINCES, AU_STATES, IN_REGIONS, getGridFactorForSite } from '@/lib/country-emission-factors';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export interface Site {
  id: string;
  name: string;
  country: string; // country code
  state: string;   // state code (for US) or free text
}

interface SiteManagerProps {
  sites: Site[];
  onChange: (sites: Site[]) => void;
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
}

const genId = () => crypto.randomUUID();

const getCountryName = (code: string) => COUNTRIES.find(c => c.code === code)?.name || code;
const getCountryCode = (name: string) => {
  const c = COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase() || c.code.toLowerCase() === name.toLowerCase());
  return c?.code || name;
};
const getStateName = (countryCode: string, stateCode: string) => {
  if (countryCode === 'US') return US_STATES.find(s => s.code === stateCode)?.name || stateCode;
  if (countryCode === 'CA') return CA_PROVINCES.find(p => p.code === stateCode)?.name || stateCode;
  if (countryCode === 'AU') return AU_STATES.find(s => s.code === stateCode)?.name || stateCode;
  if (countryCode === 'IN') return IN_REGIONS.find(r => r.code === stateCode)?.name || stateCode;
  return stateCode;
};
const resolveStateCode = (countryCode: string, stateInput: string) => {
  if (!stateInput) return '';
  const lower = stateInput.toLowerCase().trim();
  const lookups: Record<string, { code: string; name: string }[]> = {
    US: US_STATES, CA: CA_PROVINCES, AU: AU_STATES, IN: IN_REGIONS,
  };
  const list = lookups[countryCode];
  if (!list) return stateInput;
  const match = list.find(s => s.code.toLowerCase() === lower || s.name.toLowerCase() === lower);
  return match?.code || stateInput;
};
const hasSubRegions = (code: string) => ['US', 'CA', 'AU', 'IN'].includes(code);
const getSubRegions = (code: string) => {
  if (code === 'US') return US_STATES.map(s => ({ code: s.code, name: s.name }));
  if (code === 'CA') return CA_PROVINCES.map(p => ({ code: p.code, name: p.name }));
  if (code === 'AU') return AU_STATES.map(s => ({ code: s.code, name: s.name }));
  if (code === 'IN') return IN_REGIONS.map(r => ({ code: r.code, name: r.name }));
  return [];
};

// ── Bulk operations ──

const downloadTemplate = () => {
  const wb = XLSX.utils.book_new();

  // Sites sheet
  const header = ['Site Name', 'Country (code or name)', 'State / Region (code or name, optional)'];
  const examples = [
    ['HQ London', 'GB', ''],
    ['Detroit Plant', 'US', 'MI'],
    ['Sydney Office', 'AU', 'NSW'],
    ['Mumbai Warehouse', 'IN', 'MH'],
    ['Toronto Office', 'CA', 'ON'],
    ['Berlin Lab', 'DE', 'Berlin'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...examples]);
  ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sites');

  // Country reference
  const countryRef = COUNTRIES.map(c => [c.code, c.name]);
  const wsCountry = XLSX.utils.aoa_to_sheet([['Code', 'Country Name'], ...countryRef]);
  wsCountry['!cols'] = [{ wch: 8 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsCountry, 'Country Codes');

  // Sub-region references
  const regionData: [string, string, string][] = [];
  [
    { code: 'US', label: 'US States', list: US_STATES },
    { code: 'CA', label: 'CA Provinces', list: CA_PROVINCES },
    { code: 'AU', label: 'AU States', list: AU_STATES },
    { code: 'IN', label: 'IN Regions', list: IN_REGIONS },
  ].forEach(({ code, list }) => {
    list.forEach(r => regionData.push([code, r.code, r.name]));
  });
  const wsRegion = XLSX.utils.aoa_to_sheet([['Country', 'Region Code', 'Region Name'], ...regionData]);
  wsRegion['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsRegion, 'Region Codes');

  XLSX.writeFile(wb, 'Sites_Template.xlsx');
  toast.success('Template downloaded');
};

const exportSites = (sites: Site[]) => {
  if (sites.length === 0) { toast.error('No sites to export'); return; }
  const wb = XLSX.utils.book_new();
  const rows = sites.map(s => [
    s.name,
    getCountryName(s.country),
    s.country,
    hasSubRegions(s.country) && s.state ? getStateName(s.country, s.state) : s.state,
    s.state,
    (() => { const gf = getGridFactorForSite(s.country, s.state); return gf ? (gf.factor * 1000000).toFixed(0) : ''; })(),
  ]);
  const ws = XLSX.utils.aoa_to_sheet([
    ['Site Name', 'Country', 'Country Code', 'State/Region', 'State Code', 'Grid Factor (gCO₂e/kWh)'],
    ...rows,
  ]);
  ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Sites');
  XLSX.writeFile(wb, 'Sites_Export.xlsx');
  toast.success(`Exported ${sites.length} sites`);
};

const parseSitesFromFile = (file: File): Promise<Omit<Site, 'id'>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const rows = raw.slice(1).filter(r => r[0]); // skip header, skip empty

        const parsed: Omit<Site, 'id'>[] = rows.map(r => {
          const name = String(r[0] || '').trim();
          const countryInput = String(r[1] || '').trim();
          const stateInput = String(r[2] || '').trim();
          const country = getCountryCode(countryInput);
          const state = resolveStateCode(country, stateInput);
          return { name, country, state };
        }).filter(s => s.name && s.country);

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
};

export const SiteManager = ({ sites, onChange, selectedSiteId, onSelectSite }: SiteManagerProps) => {
  const [newName, setNewName] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newState, setNewState] = useState('');
  const [importPreview, setImportPreview] = useState<Omit<Site, 'id'>[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addSite = () => {
    if (!newName.trim() || !newCountry) return;
    const newSite: Site = { id: genId(), name: newName.trim(), country: newCountry, state: newState };
    const updated = [...sites, newSite];
    onChange(updated);
    if (!selectedSiteId) onSelectSite(newSite.id);
    setNewName('');
    setNewCountry('');
    setNewState('');
  };

  const removeSite = (id: string) => {
    const updated = sites.filter(s => s.id !== id);
    onChange(updated);
    if (selectedSiteId === id) {
      onSelectSite(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSitesFromFile(file);
      if (parsed.length === 0) { toast.error('No valid sites found in file'); return; }
      setImportPreview(parsed);
    } catch {
      toast.error('Failed to parse file');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    const newSites: Site[] = importPreview.map(s => ({ ...s, id: genId() }));
    const updated = [...sites, ...newSites];
    onChange(updated);
    if (!selectedSiteId && newSites.length > 0) onSelectSite(newSites[0].id);
    toast.success(`Imported ${newSites.length} sites`);
    setImportPreview(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Sites / Business Units
            </CardTitle>
            <CardDescription>
              Add your sites or business units. Emission factors are determined by country (and state for US). All site data rolls up to your global total.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportSites(sites)} disabled={sites.length === 0}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import preview */}
        {importPreview && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Import Preview ({importPreview.length} sites)</h4>
              <div className="flex gap-2">
                <Button size="sm" onClick={confirmImport}>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Confirm Import
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setImportPreview(null)}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 px-2">Site Name</th>
                    <th className="text-left py-1 px-2">Country</th>
                    <th className="text-left py-1 px-2">State / Region</th>
                    <th className="text-left py-1 px-2">Grid Factor</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((s, i) => {
                    const gf = getGridFactorForSite(s.country, s.state);
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-1 px-2 font-medium">{s.name}</td>
                        <td className="py-1 px-2">{getCountryName(s.country)}</td>
                        <td className="py-1 px-2">{hasSubRegions(s.country) && s.state ? getStateName(s.country, s.state) : s.state || '—'}</td>
                        <td className="py-1 px-2 text-muted-foreground">{gf ? `${(gf.factor * 1000000).toFixed(0)} g/kWh` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add new site form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Site / Business Unit Name</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. HQ London, Detroit Plant"
              onKeyDown={e => e.key === 'Enter' && addSite()}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Country</Label>
            <Select value={newCountry} onValueChange={v => { setNewCountry(v); setNewState(''); }}>
              <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {COUNTRIES.map(c => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasSubRegions(newCountry) ? (
            <div className="space-y-1">
              <Label className="text-xs">State / Province / Region</Label>
              <Select value={newState} onValueChange={setNewState}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {getSubRegions(newCountry).map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">State / Region (optional)</Label>
              <Input
                value={newState}
                onChange={e => setNewState(e.target.value)}
                placeholder="e.g. Bavaria, Ontario"
              />
            </div>
          )}
          <div className="flex items-end">
            <Button onClick={addSite} disabled={!newName.trim() || !newCountry} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add Site
            </Button>
          </div>
        </div>

        {/* Grid factor preview */}
        {newCountry && (
          <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
            {(() => {
              const gf = getGridFactorForSite(newCountry, newState);
              if (!gf) return 'Select a country to see the grid emission factor';
              return `Grid emission factor: ${gf.factor * 1000000} gCO₂e/kWh (${gf.label}) · Source: ${gf.source}`;
            })()}
          </div>
        )}

        {/* Site list / selector */}
        {sites.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sites.map(site => {
              const gf = getGridFactorForSite(site.country, site.state);
              return (
                <div
                  key={site.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedSiteId === site.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 hover:bg-muted/60'
                  }`}
                  onClick={() => onSelectSite(site.id)}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium">{site.name}</span>
                    <span className="text-muted-foreground ml-1">
                      · {hasSubRegions(site.country) && site.state ? `${getStateName(site.country, site.state)}, ` : ''}{getCountryName(site.country)}
                    </span>
                    {gf && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({(gf.factor * 1000000).toFixed(0)} g/kWh)
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-1"
                    onClick={e => {
                      e.stopPropagation();
                      removeSite(site.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {sites.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Add at least one site to start entering Scope 1 & 2 emissions data.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

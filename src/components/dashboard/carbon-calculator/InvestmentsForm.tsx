import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Download, Upload, FileSpreadsheet, X, Eye } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SPEND_FACTORS } from '@/lib/emission-factors';
import { toast } from 'sonner';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';

// ── PCAF Data Quality Scores ──
const PCAF_SCORES: Record<string, { label: string; description: string }> = {
  '1': { label: 'Score 1 – Verified', description: 'Audited emissions from investee' },
  '2': { label: 'Score 2 – Reported', description: 'Unaudited emissions from investee' },
  '3': { label: 'Score 3 – Physical Activity', description: 'Estimated from production data' },
  '4': { label: 'Score 4 – Economic (Revenue)', description: 'Estimated from revenue-based factors' },
  '5': { label: 'Score 5 – Economic (Assets)', description: 'Estimated from asset-class factors' },
};

// ── Investment type definitions ──
const INVESTMENT_TYPES: Record<string, { label: string }> = {
  listed_equity: { label: 'Listed Equity' },
  private_equity: { label: 'Private Equity / Unlisted' },
  corporate_bonds: { label: 'Corporate Bonds' },
  sovereign_bonds: { label: 'Sovereign Bonds' },
  project_finance: { label: 'Project Finance' },
  real_estate: { label: 'Real Estate / Property' },
  joint_venture: { label: 'Joint Venture' },
};

// ── Sector EEIO factors (tCO₂e per $1,000 invested) ──
const SECTOR_FACTORS: Record<string, { label: string; factor: number; source: string }> = {
  oil_gas: { label: 'Oil & Gas', factor: 0.82, source: 'PCAF/USEEIO' },
  mining: { label: 'Mining & Metals', factor: 0.71, source: 'PCAF/USEEIO' },
  utilities: { label: 'Utilities / Power Gen', factor: 0.65, source: 'PCAF/USEEIO' },
  manufacturing: { label: 'Manufacturing', factor: 0.52, source: 'USEEIO v2.0' },
  construction: { label: 'Construction', factor: 0.45, source: 'USEEIO v2.0' },
  transport: { label: 'Transportation', factor: 0.40, source: 'USEEIO v2.0' },
  agriculture: { label: 'Agriculture & Food', factor: 0.55, source: 'USEEIO v2.0' },
  chemicals: { label: 'Chemicals', factor: 0.60, source: 'USEEIO v2.0' },
  real_estate_sector: { label: 'Real Estate', factor: 0.18, source: 'PCAF' },
  financial: { label: 'Financial Services', factor: 0.12, source: 'USEEIO v2.0' },
  tech: { label: 'Technology / IT', factor: 0.20, source: 'USEEIO v2.0' },
  healthcare: { label: 'Healthcare', factor: 0.28, source: 'USEEIO v2.0' },
  retail: { label: 'Retail / Consumer', factor: 0.35, source: 'USEEIO v2.0' },
  other: { label: 'Other / Mixed', factor: 0.43, source: 'USEEIO v2.0' },
};

type Method = 'reported' | 'activity' | 'spend';

interface InvestmentsFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
}

export const InvestmentsForm = ({ onAdd, onAddBatch, sites, entries }: InvestmentsFormProps) => {
  const [method, setMethod] = useState<Method>('reported');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);

  // ── Method A: Reported Data ──
  const [investeeName, setInvesteeName] = useState('');
  const [investeeEmissions, setInvesteeEmissions] = useState('');
  const [investmentValue, setInvestmentValue] = useState('');
  const [evic, setEvic] = useState('');
  const [investmentType, setInvestmentType] = useState('listed_equity');
  const [pcafScore, setPcafScore] = useState('1');
  const [includeScope3, setIncludeScope3] = useState(false);
  const [investeeScope3, setInvesteeScope3] = useState('');

  // ── Method B: Activity-Based ──
  const [actInvesteeName, setActInvesteeName] = useState('');
  const [productionVolume, setProductionVolume] = useState('');
  const [productionUnit, setProductionUnit] = useState('tonnes');
  const [sectorEF, setSectorEF] = useState('');
  const [ownershipPct, setOwnershipPct] = useState('');
  const [actInvestmentType, setActInvestmentType] = useState('listed_equity');
  const [actPcafScore, setActPcafScore] = useState('3');

  // ── Method C: Spend-Based ──
  const [spendInvesteeName, setSpendInvesteeName] = useState('');
  const [spendValue, setSpendValue] = useState('');
  const [sector, setSector] = useState('manufacturing');
  const [spendInvestmentType, setSpendInvestmentType] = useState('listed_equity');
  const [spendPcafScore, setSpendPcafScore] = useState('5');

  const resetReported = () => { setInvesteeName(''); setInvesteeEmissions(''); setInvestmentValue(''); setEvic(''); setInvestmentType('listed_equity'); setPcafScore('1'); setIncludeScope3(false); setInvesteeScope3(''); };
  const resetActivity = () => { setActInvesteeName(''); setProductionVolume(''); setProductionUnit('tonnes'); setSectorEF(''); setOwnershipPct(''); setActInvestmentType('listed_equity'); setActPcafScore('3'); };
  const resetSpend = () => { setSpendInvesteeName(''); setSpendValue(''); setSector('manufacturing'); setSpendInvestmentType('listed_equity'); setSpendPcafScore('5'); };

  const handleAddReported = () => {
    const emissions = parseFloat(investeeEmissions);
    const invest = parseFloat(investmentValue);
    const totalValue = parseFloat(evic);
    if (!investeeName || !emissions || !invest || !totalValue) { toast.error('Fill all required fields'); return; }

    const attributionFactor = invest / totalValue;
    let tco2e = emissions * attributionFactor;
    const scope3Val = parseFloat(investeeScope3) || 0;
    if (includeScope3 && scope3Val > 0) tco2e += scope3Val * attributionFactor;

    onAdd({
      categoryCode: 'investments',
      type: `reported_${investmentType}`,
      quantity: invest,
      unit: '$',
      tco2e,
      description: `${investeeName} | ${INVESTMENT_TYPES[investmentType]?.label} | ${(attributionFactor * 100).toFixed(1)}% share | PCAF ${pcafScore}`,
      siteId: null,
    });
    resetReported();
    toast.success(`Added ${tco2e.toFixed(2)} tCO₂e for ${investeeName}`);
  };

  const handleAddActivity = () => {
    const volume = parseFloat(productionVolume);
    const ef = parseFloat(sectorEF);
    const ownership = parseFloat(ownershipPct);
    if (!actInvesteeName || !volume || !ef || !ownership) { toast.error('Fill all required fields'); return; }

    const tco2e = volume * ef * (ownership / 100);
    onAdd({
      categoryCode: 'investments',
      type: `activity_${actInvestmentType}`,
      quantity: volume,
      unit: productionUnit,
      tco2e,
      description: `${actInvesteeName} | ${INVESTMENT_TYPES[actInvestmentType]?.label} | ${ownership}% ownership | PCAF ${actPcafScore}`,
      siteId: null,
    });
    resetActivity();
    toast.success(`Added ${tco2e.toFixed(2)} tCO₂e for ${actInvesteeName}`);
  };

  const handleAddSpend = () => {
    const value = parseFloat(spendValue);
    if (!spendInvesteeName || !value) { toast.error('Fill all required fields'); return; }

    const sf = SECTOR_FACTORS[sector];
    const tco2e = (value / 1000) * sf.factor;
    onAdd({
      categoryCode: 'investments',
      type: `spend_${spendInvestmentType}`,
      quantity: value,
      unit: '$',
      tco2e,
      description: `${spendInvesteeName} | ${INVESTMENT_TYPES[spendInvestmentType]?.label} | ${sf.label} sector | PCAF ${spendPcafScore}`,
      siteId: null,
    });
    resetSpend();
    toast.success(`Added ${tco2e.toFixed(2)} tCO₂e for ${spendInvesteeName}`);
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Reported Data
    const reportedData = [
      ['Investee Name', 'Investee Scope 1+2 (tCO₂e)', 'Your Investment ($)', 'EVIC / Total Value ($)', 'Investment Type', 'PCAF Score', 'Include Scope 3?', 'Investee Scope 3 (tCO₂e)'],
      ['Example Corp', 100000, 50000000, 1000000000, 'listed_equity', 1, 'no', ''],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(reportedData);
    ws1['!cols'] = reportedData[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws1, 'Reported Data');

    // Sheet 2: Activity-Based
    const activityData = [
      ['Investee Name', 'Production Volume', 'Unit', 'Sector Emission Factor (tCO₂e/unit)', 'Ownership %', 'Investment Type', 'PCAF Score'],
      ['Steel Co', 1000000, 'tonnes', 1.85, 5, 'private_equity', 3],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(activityData);
    ws2['!cols'] = activityData[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Activity-Based');

    // Sheet 3: Spend-Based
    const spendData = [
      ['Investee Name', 'Investment Value ($)', 'Sector Key', 'Investment Type', 'PCAF Score'],
      ['Tech Fund', 10000000, 'tech', 'listed_equity', 5],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(spendData);
    ws3['!cols'] = spendData[0].map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Spend-Based');

    // Reference sheets
    const invTypeRef = Object.entries(INVESTMENT_TYPES).map(([k, v]) => [k, v.label]);
    const ws4 = XLSX.utils.aoa_to_sheet([['Key', 'Label'], ...invTypeRef]);
    XLSX.utils.book_append_sheet(wb, ws4, 'Ref Investment Types');

    const sectorRef = Object.entries(SECTOR_FACTORS).map(([k, v]) => [k, v.label, v.factor, v.source]);
    const ws5 = XLSX.utils.aoa_to_sheet([['Key', 'Sector', 'Factor (tCO₂e/$1000)', 'Source'], ...sectorRef]);
    XLSX.utils.book_append_sheet(wb, ws5, 'Ref Sector Factors');

    const pcafRef = Object.entries(PCAF_SCORES).map(([k, v]) => [k, v.label, v.description]);
    const ws6 = XLSX.utils.aoa_to_sheet([['Score', 'Label', 'Description'], ...pcafRef]);
    XLSX.utils.book_append_sheet(wb, ws6, 'Ref PCAF Scores');

    XLSX.writeFile(wb, 'Cat15_Investments_Template.xlsx');
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

        // Parse Reported Data sheet
        const ws1 = wb.Sheets['Reported Data'];
        if (ws1) {
          const rows: any[] = XLSX.utils.sheet_to_json(ws1);
          rows.forEach(r => {
            const name = r['Investee Name'];
            const emissions = parseFloat(r['Investee Scope 1+2 (tCO₂e)']);
            const invest = parseFloat(r['Your Investment ($)']);
            const totalVal = parseFloat(r['EVIC / Total Value ($)']);
            if (!name || !emissions || !invest || !totalVal) return;
            const attribution = invest / totalVal;
            let tco2e = emissions * attribution;
            const incS3 = String(r['Include Scope 3?'] || '').toLowerCase() === 'yes';
            const s3Val = parseFloat(r['Investee Scope 3 (tCO₂e)']) || 0;
            if (incS3 && s3Val > 0) tco2e += s3Val * attribution;
            const invType = r['Investment Type'] || 'listed_equity';
            const pcaf = r['PCAF Score'] || '1';
            parsed.push({
              categoryCode: 'investments', type: `reported_${invType}`, quantity: invest, unit: '$', tco2e,
              description: `${name} | ${INVESTMENT_TYPES[invType]?.label || invType} | ${(attribution * 100).toFixed(1)}% share | PCAF ${pcaf}`,
              siteId: null,
            });
          });
        }

        // Parse Activity-Based sheet
        const ws2 = wb.Sheets['Activity-Based'];
        if (ws2) {
          const rows: any[] = XLSX.utils.sheet_to_json(ws2);
          rows.forEach(r => {
            const name = r['Investee Name'];
            const volume = parseFloat(r['Production Volume']);
            const unit = r['Unit'] || 'tonnes';
            const ef = parseFloat(r['Sector Emission Factor (tCO₂e/unit)']);
            const ownership = parseFloat(r['Ownership %']);
            if (!name || !volume || !ef || !ownership) return;
            const tco2e = volume * ef * (ownership / 100);
            const invType = r['Investment Type'] || 'private_equity';
            const pcaf = r['PCAF Score'] || '3';
            parsed.push({
              categoryCode: 'investments', type: `activity_${invType}`, quantity: volume, unit, tco2e,
              description: `${name} | ${INVESTMENT_TYPES[invType]?.label || invType} | ${ownership}% ownership | PCAF ${pcaf}`,
              siteId: null,
            });
          });
        }

        // Parse Spend-Based sheet
        const ws3 = wb.Sheets['Spend-Based'];
        if (ws3) {
          const rows: any[] = XLSX.utils.sheet_to_json(ws3);
          rows.forEach(r => {
            const name = r['Investee Name'];
            const value = parseFloat(r['Investment Value ($)']);
            const sectorKey = r['Sector Key'] || 'other';
            if (!name || !value) return;
            const sf = SECTOR_FACTORS[sectorKey] || SECTOR_FACTORS.other;
            const tco2e = (value / 1000) * sf.factor;
            const invType = r['Investment Type'] || 'listed_equity';
            const pcaf = r['PCAF Score'] || '5';
            parsed.push({
              categoryCode: 'investments', type: `spend_${invType}`, quantity: value, unit: '$', tco2e,
              description: `${name} | ${INVESTMENT_TYPES[invType]?.label || invType} | ${sf.label} sector | PCAF ${pcaf}`,
              siteId: null,
            });
          });
        }

        if (parsed.length === 0) { toast.error('No valid rows found'); return; }
        setImportPreview(parsed);
      } catch { toast.error('Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = () => {
    if (!importPreview) return;
    onAddBatch(importPreview);
    toast.success(`Imported ${importPreview.length} investment entries`);
    setImportPreview(null);
  };

  // ── Bulk: Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.error('No entries to export'); return; }
    const wb = XLSX.utils.book_new();
    const data = entries.map(e => ({
      Description: e.description,
      Method: e.type.split('_')[0],
      'Investment Type': e.type.split('_').slice(1).join('_'),
      Quantity: e.quantity,
      Unit: e.unit,
      'tCO₂e': e.tco2e,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = Object.keys(data[0]).map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Investments');
    XLSX.writeFile(wb, 'Cat15_Investments_Export.xlsx');
    toast.success('Exported');
  };

  const methods: { key: Method; label: string; description: string; pcaf: string }[] = [
    { key: 'reported', label: 'A. Reported Data', description: 'Verified/reported Scope 1+2 from investee', pcaf: 'PCAF 1–2' },
    { key: 'activity', label: 'B. Physical Activity', description: 'Production volume × sector EF × ownership %', pcaf: 'PCAF 3' },
    { key: 'spend', label: 'C. Spend / Revenue', description: 'Investment value × sector EEIO factor', pcaf: 'PCAF 4–5' },
  ];

  return (
    <div className="space-y-4">
      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Template
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1">
          <Upload className="h-3.5 w-3.5" /> Import Data
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
          <Download className="h-3.5 w-3.5" /> Export Data
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
      </div>

      {/* Import preview modal */}
      {importPreview && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1"><Eye className="h-4 w-4" /> Import Preview ({importPreview.length} entries)</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setImportPreview(null)}><X className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-auto space-y-1 mb-3">
              {importPreview.map((e, i) => (
                <div key={i} className="flex justify-between text-xs p-2 rounded bg-muted/50">
                  <span className="truncate mr-2">{e.description}</span>
                  <span className="font-medium shrink-0">{e.tco2e.toFixed(3)} tCO₂e</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Total: {importPreview.reduce((s, e) => s + e.tco2e, 0).toFixed(2)} tCO₂e</p>
              <Button size="sm" onClick={confirmImport}>Add All</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Method selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {methods.map(m => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={`text-left p-3 rounded-lg border transition-colors ${method === m.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
          >
            <p className="text-sm font-medium">{m.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
            <p className="text-xs text-muted-foreground opacity-70">{m.pcaf}</p>
          </button>
        ))}
      </div>

      {/* Method A: Reported Data */}
      {method === 'reported' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Reported Data Method</CardTitle>
            <p className="text-xs text-muted-foreground">Your Share = Investee Scope 1+2 × (Your Investment / EVIC)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investee Name *</Label>
                <Input value={investeeName} onChange={e => setInvesteeName(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Investment Type</Label>
                <Select value={investmentType} onValueChange={setInvestmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVESTMENT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investee Scope 1+2 Emissions (tCO₂e) *</Label>
                <Input type="number" value={investeeEmissions} onChange={e => setInvesteeEmissions(e.target.value)} placeholder="100000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Your Investment Value ($) *</Label>
                <Input type="number" value={investmentValue} onChange={e => setInvestmentValue(e.target.value)} placeholder="50000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">EVIC / Total Company Value ($) *</Label>
                <Input type="number" value={evic} onChange={e => setEvic(e.target.value)} placeholder="1000000000" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">PCAF Data Quality Score</Label>
                <Select value={pcafScore} onValueChange={setPcafScore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PCAF_SCORES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Include Investee Scope 3?</Label>
                <Select value={includeScope3 ? 'yes' : 'no'} onValueChange={v => setIncludeScope3(v === 'yes')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">No (standard)</SelectItem>
                    <SelectItem value="yes">Yes (optional, encouraged)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {includeScope3 && (
                <div className="space-y-1">
                  <Label className="text-xs">Investee Scope 3 (tCO₂e)</Label>
                  <Input type="number" value={investeeScope3} onChange={e => setInvesteeScope3(e.target.value)} placeholder="0" />
                </div>
              )}
            </div>
            {investeeEmissions && investmentValue && evic && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                Attribution: {((parseFloat(investmentValue) / parseFloat(evic)) * 100).toFixed(2)}% →{' '}
                <span className="font-semibold">
                  {(parseFloat(investeeEmissions) * (parseFloat(investmentValue) / parseFloat(evic))).toFixed(2)} tCO₂e
                </span>
              </div>
            )}
            <Button onClick={handleAddReported} className="gap-1"><Plus className="h-4 w-4" /> Add Investment</Button>
          </CardContent>
        </Card>
      )}

      {/* Method B: Activity-Based */}
      {method === 'activity' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Physical Activity-Based Method</CardTitle>
            <p className="text-xs text-muted-foreground">Your Share = (Production Volume × Sector EF) × Ownership %</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investee Name *</Label>
                <Input value={actInvesteeName} onChange={e => setActInvesteeName(e.target.value)} placeholder="e.g. Steel Co" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Investment Type</Label>
                <Select value={actInvestmentType} onValueChange={setActInvestmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVESTMENT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Production Volume *</Label>
                <Input type="number" value={productionVolume} onChange={e => setProductionVolume(e.target.value)} placeholder="1000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={productionUnit} onValueChange={setProductionUnit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tonnes">Tonnes</SelectItem>
                    <SelectItem value="MWh">MWh</SelectItem>
                    <SelectItem value="units">Units</SelectItem>
                    <SelectItem value="m3">m³</SelectItem>
                    <SelectItem value="barrels">Barrels</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sector EF (tCO₂e/unit) *</Label>
                <Input type="number" step="0.001" value={sectorEF} onChange={e => setSectorEF(e.target.value)} placeholder="1.85" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ownership % *</Label>
                <Input type="number" value={ownershipPct} onChange={e => setOwnershipPct(e.target.value)} placeholder="5" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">PCAF Data Quality Score</Label>
                <Select value={actPcafScore} onValueChange={setActPcafScore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PCAF_SCORES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {productionVolume && sectorEF && ownershipPct && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                {parseFloat(productionVolume).toLocaleString()} {productionUnit} × {sectorEF} tCO₂e/{productionUnit} × {ownershipPct}% ={' '}
                <span className="font-semibold">
                  {(parseFloat(productionVolume) * parseFloat(sectorEF) * (parseFloat(ownershipPct) / 100)).toFixed(2)} tCO₂e
                </span>
              </div>
            )}
            <Button onClick={handleAddActivity} className="gap-1"><Plus className="h-4 w-4" /> Add Investment</Button>
          </CardContent>
        </Card>
      )}

      {/* Method C: Spend-Based */}
      {method === 'spend' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Economic (Spend/Revenue) Method</CardTitle>
            <p className="text-xs text-muted-foreground">Your Share = Investment Value ($) × Sector EEIO Factor</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investee / Fund Name *</Label>
                <Input value={spendInvesteeName} onChange={e => setSpendInvesteeName(e.target.value)} placeholder="e.g. Tech Growth Fund" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Investment Type</Label>
                <Select value={spendInvestmentType} onValueChange={setSpendInvestmentType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INVESTMENT_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Investment Value ($) *</Label>
                <Input type="number" value={spendValue} onChange={e => setSpendValue(e.target.value)} placeholder="10000000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sector</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECTOR_FACTORS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label} ({v.factor} tCO₂e/$1k)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PCAF Data Quality Score</Label>
                <Select value={spendPcafScore} onValueChange={setSpendPcafScore}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PCAF_SCORES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {spendValue && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                ${parseFloat(spendValue).toLocaleString()} × {SECTOR_FACTORS[sector].factor} tCO₂e/$1k ={' '}
                <span className="font-semibold">
                  {((parseFloat(spendValue) / 1000) * SECTOR_FACTORS[sector].factor).toFixed(2)} tCO₂e
                </span>
              </div>
            )}
            <Button onClick={handleAddSpend} className="gap-1"><Plus className="h-4 w-4" /> Add Investment</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

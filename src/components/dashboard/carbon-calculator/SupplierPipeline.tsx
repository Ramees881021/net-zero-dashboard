import { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, X, Eye, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface RawSupplier {
  supplier_name: string;
  description: string;
  optional_spend: string;
  optional_contact: string;
}

interface ClassifiedSupplier extends RawSupplier {
  ai_category: string;
  ai_confidence: number;
  current_category: string;
  auto_routed: boolean;
  user_override_category?: string;
}

interface ClassificationStats {
  total: number;
  auto_classified: number;
  needs_review: number;
  category_breakdown: Record<string, number>;
}

interface SupplierPipelineProps {
  onComplete?: () => void;
}

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SCOPE3_CATEGORIES.map(c => [c.code, c.label])
);
CATEGORY_LABELS['review_queue'] = 'Needs Review';

const SHORT_LABELS: Record<string, string> = {
  purchased_goods: 'Cat 1 – PG&S',
  capital_goods: 'Cat 2 – CG',
  fuel_energy: 'Cat 3 – Fuel',
  upstream_transport: 'Cat 4 – Transport↑',
  waste: 'Cat 5 – Waste',
  business_travel: 'Cat 6 – Travel',
  employee_commuting: 'Cat 7 – Commute',
  upstream_leased: 'Cat 8 – Leased↑',
  downstream_transport: 'Cat 9 – Transport↓',
  processing_sold: 'Cat 10 – Processing',
  use_sold: 'Cat 11 – Use',
  end_of_life: 'Cat 12 – End-of-Life',
  downstream_leased: 'Cat 13 – Leased↓',
  franchises: 'Cat 14 – Franchises',
  investments: 'Cat 15 – Investments',
  review_queue: 'Review',
};

export const SupplierPipeline = ({ onComplete }: SupplierPipelineProps) => {
  const [step, setStep] = useState<'upload' | 'classifying' | 'review' | 'saving' | 'done'>('upload');
  const [rawSuppliers, setRawSuppliers] = useState<RawSupplier[]>([]);
  const [classified, setClassified] = useState<ClassifiedSupplier[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ClassifiedSupplier[]>([]);
  const [stats, setStats] = useState<ClassificationStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          toast.error('File must have a header row + at least 1 data row');
          return;
        }

        const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
        const nameIdx = headers.findIndex((h: string) => h.includes('supplier') || h.includes('name') || h.includes('company'));
        const descIdx = headers.findIndex((h: string) => h.includes('description') || h.includes('desc'));
        const spendIdx = headers.findIndex((h: string) => h.includes('spend') || h.includes('cost') || h.includes('value'));
        const contactIdx = headers.findIndex((h: string) => h.includes('contact') || h.includes('email'));

        if (nameIdx === -1) {
          toast.error('Missing required column: supplier_name (or similar)');
          return;
        }

        const suppliers: RawSupplier[] = rows.slice(1)
          .filter(r => r.some(cell => cell !== undefined && cell !== ''))
          .map(row => ({
            supplier_name: String(row[nameIdx] || '').trim(),
            description: descIdx >= 0 ? String(row[descIdx] || '').trim() : '',
            optional_spend: spendIdx >= 0 ? String(row[spendIdx] || '').trim() : '',
            optional_contact: contactIdx >= 0 ? String(row[contactIdx] || '').trim() : '',
          }))
          .filter(s => s.supplier_name.length > 0);

        if (suppliers.length === 0) {
          toast.error('No valid supplier rows found');
          return;
        }

        setRawSuppliers(suppliers);
        toast.success(`Parsed ${suppliers.length} suppliers`);
      } catch (err) {
        toast.error('Failed to parse file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleClassify = async () => {
    if (rawSuppliers.length === 0) return;
    setStep('classifying');
    const batchSize = 50;
    const totalBatches = Math.ceil(rawSuppliers.length / batchSize);
    setProgressMsg(`Classifying ${rawSuppliers.length} suppliers in ${totalBatches} batch${totalBatches > 1 ? 'es' : ''}…`);
    try {
      const { data, error } = await supabase.functions.invoke('classify-suppliers', {
        body: { action: 'classify', suppliers: rawSuppliers },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setClassified(data.classified || []);
      setReviewQueue(data.review_queue || []);
      setStats(data.stats || null);
      setStep('review');
      toast.success(`Classified ${data.stats?.auto_classified || 0} suppliers automatically`);
    } catch (err: any) {
      toast.error(err.message || 'Classification failed');
      setStep('upload');
    }
  };

  const handleOverride = (index: number, isReview: boolean, newCategory: string) => {
    if (isReview) {
      setReviewQueue(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], current_category: newCategory, user_override_category: newCategory };
        return updated;
      });
    } else {
      setClassified(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], current_category: newCategory, user_override_category: newCategory };
        return updated;
      });
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setStep('saving');

    try {
      const allSuppliers = [...classified, ...reviewQueue].filter(
        s => s.current_category !== 'review_queue'
      );

      if (allSuppliers.length === 0) {
        toast.error('No suppliers to save. Resolve review items first.');
        setStep('review');
        setSaving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('classify-suppliers', {
        body: { action: 'save', suppliers: allSuppliers },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      toast.success(`Saved ${data.saved} suppliers to database`);
      setStep('done');
      onComplete?.();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
      setStep('review');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseCSV(file);
  }, [parseCSV]);

  const handleReset = () => {
    setStep('upload');
    setRawSuppliers([]);
    setClassified([]);
    setReviewQueue([]);
    setStats(null);
  };

  // Group classified suppliers by category for display
  const classifiedByCategory = classified.reduce<Record<string, ClassifiedSupplier[]>>((acc, s) => {
    const cat = s.current_category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const CategorySelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 text-[10px] w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SCOPE3_CATEGORIES.map(c => (
          <SelectItem key={c.code} value={c.code} className="text-xs">
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload Supplier List
            </CardTitle>
            <CardDescription>Upload a CSV/Excel file with supplier_name, description columns. AI will classify into Scope 3 sub-categories.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drop CSV/Excel here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">
                Required: supplier_name, description. Optional: spend, contact
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={e => e.target.files?.[0] && parseCSV(e.target.files[0])}
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={(e) => {
                e.stopPropagation();
                const wb = XLSX.utils.book_new();
                const data = [
                  ['supplier_name', 'description', 'optional_spend', 'optional_contact'],
                  ['Acme Materials', 'Industrial solvents supplier', '$45,000', 'procurement@acme.com'],
                  ['Gamma Robotics', 'Assembly line automation equipment', '$250,000', 'sales@gamma.io'],
                  ['Beta Software', 'Cloud ERP subscription', '$18,000', 'accounts@beta.com'],
                  ['Delta Logistics', 'Freight and warehousing service', '$120,000', ''],
                  ['Omega Machinery', 'CNC milling machines', '$500,000', 'info@omega.com'],
                  ['GreenWaste Co', 'Industrial waste disposal and recycling', '$30,000', ''],
                  ['TravelCorp', 'Corporate travel management agency', '$80,000', ''],
                ];
                const ws = XLSX.utils.aoa_to_sheet(data);
                ws['!cols'] = [{ wch: 22 }, { wch: 38 }, { wch: 16 }, { wch: 28 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
                XLSX.writeFile(wb, 'supplier_upload_template.xlsx');
                toast.success('Sample template downloaded');
              }}
            >
              <Download className="h-3.5 w-3.5" /> Download Sample Template
            </Button>

            {rawSuppliers.length > 0 && (
              <>
                <div className="border rounded-lg overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rawSuppliers.slice(0, 5).map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">{s.supplier_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.description || '—'}</TableCell>
                          <TableCell className="text-xs">{s.optional_spend || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rawSuppliers.length > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      + {rawSuppliers.length - 5} more rows
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleClassify} className="gap-1">
                    <Eye className="h-4 w-4" /> Classify {rawSuppliers.length} Suppliers with AI
                  </Button>
                  <Button variant="outline" onClick={() => setRawSuppliers([])}>
                    <X className="h-4 w-4" /> Clear
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Classifying */}
      {step === 'classifying' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
            <p className="font-medium">AI is classifying {rawSuppliers.length} suppliers into Scope 3 categories…</p>
            <p className="text-xs text-muted-foreground mt-1">{progressMsg || 'This usually takes a few seconds'}</p>
            {rawSuppliers.length > 50 && (
              <p className="text-xs text-muted-foreground mt-2">
                Processing in batches of 50. Large lists may take up to a minute.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step: Review */}
      {(step === 'review' || step === 'saving') && (
        <>
          {/* Stats */}
          {stats && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <Badge variant="outline" className="text-[10px] mt-1">Total</Badge>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{stats.auto_classified}</p>
                  <Badge variant="default" className="text-[10px] mt-1">Auto-Classified</Badge>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-2xl font-bold">{stats.needs_review}</p>
                  <Badge variant="destructive" className="text-[10px] mt-1">Needs Review</Badge>
                </Card>
              </div>
              {stats.category_breakdown && Object.keys(stats.category_breakdown).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stats.category_breakdown).map(([code, count]) => (
                    <Badge key={code} variant="secondary" className="text-[10px]">
                      {SHORT_LABELS[code] || code}: {count}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Auto-classified grouped by category */}
          {Object.entries(classifiedByCategory).map(([catCode, suppliers]) => (
            <Card key={catCode}>
              <CardHeader>
                <CardTitle className="text-sm">
                  ✅ {CATEGORY_LABELS[catCode] || catCode} ({suppliers.length})
                </CardTitle>
                <CardDescription>Confidence ≥ 85%. Use dropdown to reassign.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto max-h-60">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suppliers.map((s) => {
                        const globalIdx = classified.findIndex(c => c === s);
                        return (
                          <TableRow key={globalIdx}>
                            <TableCell className="font-medium text-xs">{s.supplier_name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.description}</TableCell>
                            <TableCell>
                              <CategorySelect
                                value={s.current_category}
                                onChange={(v) => handleOverride(globalIdx, false, v)}
                              />
                            </TableCell>
                            <TableCell className="text-right text-xs">{(s.ai_confidence * 100).toFixed(0)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Review queue */}
          {reviewQueue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">⚠️ Needs Review ({reviewQueue.length})</CardTitle>
                <CardDescription>Low confidence — assign the correct Scope 3 category.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto max-h-80">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>AI Guess</TableHead>
                        <TableHead>Assign</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reviewQueue.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-xs">{s.supplier_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{s.description}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {SHORT_LABELS[s.ai_category] || s.ai_category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <CategorySelect
                              value={s.current_category === 'review_queue' ? s.ai_category : s.current_category}
                              onChange={(v) => handleOverride(i, true, v)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-xs">{(s.ai_confidence * 100).toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={handleSaveAll} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save All to Supplier Database
            </Button>
            <Button variant="outline" onClick={handleReset}>Start Over</Button>
          </div>
        </>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-2xl">✅</p>
            <p className="font-semibold">Suppliers classified and saved!</p>
            <p className="text-sm text-muted-foreground">
              Suppliers are now organised by Scope 3 sub-category in the database.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleReset}>Upload More</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

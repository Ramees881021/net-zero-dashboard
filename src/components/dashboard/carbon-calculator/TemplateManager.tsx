import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Upload, FileSpreadsheet, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { useRef } from 'react';

interface TemplateManagerProps {
  category: string;
}

export const TemplateManager = ({ category }: TemplateManagerProps) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [reimporting, setReimporting] = useState(false);
  const [reimportResults, setReimportResults] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPG = category === 'purchased_goods';
  const label = isPG ? 'Purchased Goods & Services' : 'Capital Goods';

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('classify-suppliers', {
        body: { action: 'generate-template', category },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setSuppliers(data.suppliers || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [category]);

  const downloadTemplate = () => {
    if (suppliers.length === 0) {
      toast.error('No suppliers in this category yet');
      return;
    }

    const wb = XLSX.utils.book_new();

    if (isPG) {
      const headers = ['supplier_name', 'description', 'spend_usd', 'quantity', 'unit'];
      const data = [
        headers,
        ...suppliers.map(s => [s.name_display, s.description || '', '', '', '']),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 25 },
        { wch: 35 },
        { wch: 15 },
        { wch: 12 },
        { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Purchased Goods');
      XLSX.writeFile(wb, `template_purchased_goods_${suppliers.length}_suppliers.xlsx`);
    } else {
      const headers = ['supplier_name', 'description', 'asset_value_usd', 'lifespan_years', 'purchase_date'];
      const data = [
        headers,
        ...suppliers.map(s => [s.name_display, s.description || '', '', '', '']),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [
        { wch: 25 },
        { wch: 35 },
        { wch: 18 },
        { wch: 15 },
        { wch: 15 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Capital Goods');
      XLSX.writeFile(wb, `template_capital_goods_${suppliers.length}_suppliers.xlsx`);
    }

    toast.success(`Template downloaded with ${suppliers.length} pre-filled suppliers`);
  };

  const handleReimport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setReimporting(true);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (rows.length < 2) {
          toast.error('File must have header + data rows');
          setReimporting(false);
          return;
        }

        const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim().replace(/\s+/g, '_'));

        // Validate headers
        const requiredHeaders = isPG
          ? ['supplier_name', 'description']
          : ['supplier_name', 'description'];

        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          toast.error(`Missing required headers: ${missingHeaders.join(', ')}`);
          setReimporting(false);
          return;
        }

        const entries = rows.slice(1)
          .filter(r => r.some(cell => cell !== undefined && cell !== ''))
          .map(row => {
            const entry: any = {};
            headers.forEach((h: string, i: number) => {
              entry[h] = row[i] ?? null;
            });
            return entry;
          });

        const { data: result, error } = await supabase.functions.invoke('classify-suppliers', {
          body: { action: 'reimport', entries, category },
        });

        if (error) throw error;
        if (result.error) throw new Error(result.error);

        setReimportResults(result);
        toast.success(`Imported ${result.imported} entries`);
        fetchSuppliers(); // Refresh
      } catch (err: any) {
        toast.error(err.message || 'Re-import failed');
      } finally {
        setReimporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> {label} Template
          </CardTitle>
          <CardDescription>
            {suppliers.length} suppliers pre-filled, sorted A→Z. Download, fill in data, then re-import.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : suppliers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No suppliers in this category yet. Upload and classify suppliers first.
            </p>
          ) : (
            <>
              <div className="border rounded-lg overflow-auto max-h-48">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Confidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.slice(0, 5).map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-xs">{s.name_display}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{s.description || '—'}</TableCell>
                        <TableCell className="text-right text-xs">{s.ai_confidence ? `${(s.ai_confidence * 100).toFixed(0)}%` : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {suppliers.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-2">+ {suppliers.length - 5} more</p>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button onClick={downloadTemplate} className="gap-1">
                  <Download className="h-4 w-4" /> Download Template ({suppliers.length})
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={reimporting}
                  className="gap-1"
                >
                  {reimporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Re-Import Filled Template
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleReimport(e.target.files[0])}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Reimport Results */}
      {reimportResults && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Re-Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" /> {reimportResults.imported} imported
              </Badge>
              {reimportResults.mismatches?.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {reimportResults.mismatches.length} mismatches
                </Badge>
              )}
              {reimportResults.new_classified > 0 && (
                <Badge variant="secondary">{reimportResults.new_classified} new suppliers added</Badge>
              )}
            </div>

            {reimportResults.mismatches?.length > 0 && (
              <div className="border rounded-lg p-3 bg-destructive/5">
                <p className="text-xs font-medium mb-2">⚠️ Category Mismatches</p>
                {reimportResults.mismatches.map((m: any, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground">
                    <strong>{m.supplier_name}</strong>: Expected "{m.expected}", got "{m.got}"
                  </p>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" onClick={() => setReimportResults(null)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

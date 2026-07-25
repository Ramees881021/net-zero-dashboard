import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { GRID_REGIONS } from '@/lib/emission-factors';
import type { Scope2Entry } from '@/components/dashboard/carbon-calculator/Scope2Form';

const GRID_LABELS: Record<string, { factor: number; label: string }> = Object.fromEntries(
  Object.entries(GRID_REGIONS).map(([k, v]) => [v.label.toLowerCase(), { factor: v.factor, label: v.label }])
);

export const useScope2BulkOperations = () => {

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const headers = ['sub_category', 'quantity_kwh', 'grid_region', 'method', 'renewable_percent', 'emission_factor', 'description'];
    const sampleRows = [
      ['electricity', '150000', 'UK Grid', 'location', '0', '', 'HQ Office electricity'],
      ['electricity', '80000', 'US Average', 'market', '30', '', 'Warehouse electricity'],
      ['heat_steam', '25000', '', '', '', '0.000185', 'District heating'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];

    // Reference sheet
    const refRows: string[][] = [
      ['Sub-Categories', 'electricity, heat_steam'],
      ['Methods', 'location, market'],
      ['', ''],
      ['Grid Region', 'Factor (gCO₂e/kWh)', 'Source'],
      ...Object.entries(GRID_REGIONS).map(([, r]) => [r.label, (r.factor * 1000000).toFixed(0), r.source]),
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Scope 2 Data');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    XLSX.writeFile(wb, 'scope2_template.xlsx');
    toast.success('Scope 2 template downloaded');
  }, []);

  const exportData = useCallback((entries: Scope2Entry[]) => {
    if (entries.length === 0) {
      toast.error('No Scope 2 entries to export');
      return;
    }

    const rows = entries.map(e => ({
      'Sub-Category': e.subCategory,
      'Quantity (kWh)': e.quantity,
      'Grid Region': e.gridRegion,
      'Method': e.method,
      'Renewable %': e.renewablePercentage,
      'tCO₂e': e.tco2e,
      'Description': e.description,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Scope 2 Data');
    XLSX.writeFile(wb, `scope2_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${entries.length} Scope 2 entries`);
  }, []);

  const importData = useCallback((file: File): Promise<{ success: boolean; entries: Scope2Entry[] }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

          if (rows.length < 2) {
            toast.error('File must have header row + data rows');
            resolve({ success: false, entries: [] });
            return;
          }

          const headers = rows[0].map((h: any) => String(h || '').toLowerCase().trim().replace(/\s+/g, '_'));
          const subCatIdx = headers.indexOf('sub_category');
          const qtyIdx = headers.indexOf('quantity_kwh');
          const regionIdx = headers.indexOf('grid_region');
          const methodIdx = headers.indexOf('method');
          const renewIdx = headers.indexOf('renewable_percent');
          const efIdx = headers.indexOf('emission_factor');
          const descIdx = headers.indexOf('description');

          if (subCatIdx === -1 || qtyIdx === -1) {
            toast.error('Missing required columns: sub_category, quantity_kwh');
            resolve({ success: false, entries: [] });
            return;
          }

          const entries: Scope2Entry[] = [];
          const errors: string[] = [];

          rows.slice(1).forEach((row, idx) => {
            if (!row.some(cell => cell !== undefined && cell !== '')) return;

            const rawSubCat = String(row[subCatIdx] || '').toLowerCase().trim();
            const rawQty = parseFloat(row[qtyIdx]);
            const rawRegion = String(row[regionIdx] ?? '').trim();
            const rawMethod = String(row[methodIdx] ?? 'location').toLowerCase().trim();
            const rawRenew = parseFloat(row[renewIdx] ?? '0') || 0;
            const rawEF = parseFloat(row[efIdx] ?? '');
            const desc = String(row[descIdx] ?? '');

            if (!['electricity', 'heat_steam'].includes(rawSubCat)) {
              errors.push(`Row ${idx + 2}: Invalid sub_category "${rawSubCat}". Use: electricity, heat_steam`);
              return;
            }
            if (isNaN(rawQty) || rawQty <= 0) {
              errors.push(`Row ${idx + 2}: Invalid quantity`);
              return;
            }

            let tco2e = 0;
            let gridRegion = '';

            if (rawSubCat === 'electricity') {
              // Find grid factor from region label
              const regionMatch = GRID_LABELS[rawRegion.toLowerCase()];
              if (!regionMatch) {
                errors.push(`Row ${idx + 2}: Unknown grid_region "${rawRegion}". See Reference sheet.`);
                return;
              }
              gridRegion = regionMatch.label;
              const method = rawMethod === 'market' ? 'market' : 'location';
              const netKwh = method === 'market' ? rawQty * (1 - rawRenew / 100) : rawQty;
              tco2e = netKwh * regionMatch.factor;

              entries.push({
                id: crypto.randomUUID(),
                subCategory: 'electricity',
                gridRegion,
                quantity: rawQty,
                unit: 'kWh',
                method,
                tco2e,
                description: desc,
                renewablePercentage: rawRenew,
              });
            } else {
              // heat_steam
              const factor = !isNaN(rawEF) && rawEF > 0 ? rawEF : 0.000185;
              tco2e = rawQty * factor;

              entries.push({
                id: crypto.randomUUID(),
                subCategory: 'heat_steam',
                gridRegion: '',
                quantity: rawQty,
                unit: 'kWh',
                method: 'location',
                tco2e,
                description: desc,
                renewablePercentage: 0,
              });
            }
          });

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`);
            resolve({ success: false, entries: [] });
            return;
          }

          toast.success(`Imported ${entries.length} Scope 2 entries`);
          resolve({ success: true, entries });
        } catch (err) {
          console.error('Import error:', err);
          toast.error('Failed to parse file. Please use the provided template.');
          resolve({ success: false, entries: [] });
        }
      };
      reader.onerror = () => {
        toast.error('Failed to read file');
        resolve({ success: false, entries: [] });
      };
      reader.readAsArrayBuffer(file);
    });
  }, []);

  return { downloadTemplate, exportData, importData };
};

import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FUEL_TYPES, VEHICLE_TYPES, REFRIGERANT_TYPES } from '@/lib/emission-factors';
import type { Scope1Entry } from '@/components/dashboard/carbon-calculator/Scope1Form';

const SUB_CATEGORIES = ['stationary', 'mobile', 'process', 'fugitive'] as const;

const TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(FUEL_TYPES).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(VEHICLE_TYPES).map(([k, v]) => [k, v.label])),
  ...Object.fromEntries(Object.entries(REFRIGERANT_TYPES).map(([k, v]) => [k, v.label])),
  direct: 'Direct Input',
};

const LABEL_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_LABELS).map(([k, v]) => [v.toLowerCase(), k])
);

const recalc = (subCategory: string, type: string, quantity: number): { tco2e: number; unit: string } => {
  if (subCategory === 'stationary') {
    const fuel = FUEL_TYPES[type as keyof typeof FUEL_TYPES];
    if (fuel) return { tco2e: quantity * fuel.factor, unit: fuel.unit };
  } else if (subCategory === 'mobile') {
    const vehicle = VEHICLE_TYPES[type as keyof typeof VEHICLE_TYPES];
    if (vehicle) return { tco2e: quantity * vehicle.factor, unit: vehicle.unit };
  } else if (subCategory === 'fugitive') {
    const ref = REFRIGERANT_TYPES[type as keyof typeof REFRIGERANT_TYPES];
    if (ref) return { tco2e: (quantity / 1000) * ref.gwp, unit: 'kg leaked' };
  } else if (subCategory === 'process') {
    return { tco2e: quantity, unit: 'tCO2e (direct)' };
  }
  return { tco2e: 0, unit: '' };
};

export const useScope1BulkOperations = () => {

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Main data sheet
    const headers = ['sub_category', 'type', 'quantity', 'description'];
    const sampleRows = [
      ['stationary', 'Natural Gas', '50000', 'Main office boiler'],
      ['mobile', 'Diesel Car (avg)', '12000', 'Fleet car #1'],
      ['process', 'Direct Input', '5.2', 'Cement kiln'],
      ['fugitive', 'R-134a (HFC)', '3.5', 'AC Unit #1'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 30 }];

    // Reference sheet with valid types per sub-category
    const refRows: string[][] = [['Sub-Category', 'Valid Types']];
    refRows.push(['stationary', Object.values(FUEL_TYPES).map(f => f.label).join(', ')]);
    refRows.push(['mobile', Object.values(VEHICLE_TYPES).map(v => v.label).join(', ')]);
    refRows.push(['process', 'Direct Input (quantity = tCO₂e)']);
    refRows.push(['fugitive', Object.values(REFRIGERANT_TYPES).map(r => r.label).join(', ')]);
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols'] = [{ wch: 15 }, { wch: 100 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Scope 1 Data');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    XLSX.writeFile(wb, 'scope1_template.xlsx');
    toast.success('Scope 1 template downloaded');
  }, []);

  const exportData = useCallback((entries: Scope1Entry[]) => {
    if (entries.length === 0) {
      toast.error('No Scope 1 entries to export');
      return;
    }

    const rows = entries.map(e => ({
      'Sub-Category': e.subCategory,
      'Type': TYPE_LABELS[e.type] || e.type,
      'Quantity': e.quantity,
      'Unit': e.unit,
      'tCO₂e': e.tco2e,
      'Description': e.description,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Scope 1 Data');
    XLSX.writeFile(wb, `scope1_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${entries.length} Scope 1 entries`);
  }, []);

  const importData = useCallback((file: File): Promise<{ success: boolean; entries: Scope1Entry[] }> => {
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
          const typeIdx = headers.indexOf('type');
          const qtyIdx = headers.indexOf('quantity');
          const descIdx = headers.indexOf('description');

          if (subCatIdx === -1 || typeIdx === -1 || qtyIdx === -1) {
            toast.error('Missing required columns: sub_category, type, quantity');
            resolve({ success: false, entries: [] });
            return;
          }

          const entries: Scope1Entry[] = [];
          const errors: string[] = [];

          rows.slice(1).forEach((row, idx) => {
            if (!row.some(cell => cell !== undefined && cell !== '')) return; // skip empty

            const rawSubCat = String(row[subCatIdx] || '').toLowerCase().trim();
            const rawType = String(row[typeIdx] || '').trim();
            const rawQty = parseFloat(row[qtyIdx]);
            const desc = String(row[descIdx] ?? '');

            if (!SUB_CATEGORIES.includes(rawSubCat as any)) {
              errors.push(`Row ${idx + 2}: Invalid sub_category "${rawSubCat}". Use: ${SUB_CATEGORIES.join(', ')}`);
              return;
            }
            if (isNaN(rawQty) || rawQty <= 0) {
              errors.push(`Row ${idx + 2}: Invalid quantity`);
              return;
            }

            // Resolve type label to key
            let typeKey = LABEL_TO_KEY[rawType.toLowerCase()] || rawType;
            if (rawSubCat === 'process') typeKey = 'direct';

            const { tco2e, unit } = recalc(rawSubCat, typeKey, rawQty);
            if (tco2e === 0 && rawSubCat !== 'process') {
              errors.push(`Row ${idx + 2}: Unknown type "${rawType}" for ${rawSubCat}`);
              return;
            }

            entries.push({
              id: crypto.randomUUID(),
              subCategory: rawSubCat as Scope1Entry['subCategory'],
              type: typeKey,
              quantity: rawQty,
              unit,
              tco2e,
              description: desc,
            });
          });

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`);
            resolve({ success: false, entries: [] });
            return;
          }

          toast.success(`Imported ${entries.length} Scope 1 entries`);
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

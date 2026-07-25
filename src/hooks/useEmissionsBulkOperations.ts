import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SCOPE3_CATEGORIES } from '@/lib/emission-factors';

export const CDP_SCORES = ['A', 'A-', 'B', 'B-', 'C', 'C-', 'D', 'D-', 'Not Rated'];
export const SBTI_STATUSES = ['Committed', 'Targets Set', 'Near-term Targets', 'Long-term Targets', 'None'];
const SCOPE3_STATUS_OPTIONS = ['Calculated', 'Not Applicable', 'Not Calculated'];

interface EmissionsRow {
  reporting_year: number;
  scope_1_emissions: number | null;
  scope_2_location_based: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
  revenue: number | null;
  cdp_score: string | null;
  ecovadis_score: number | null;
  sbti_target_status: string | null;
  scope3_breakdown: Record<string, { value: number | null; status: string }>;
}

export const useEmissionsBulkOperations = (userId: string | undefined, currencySymbol: string) => {
  
  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    
    // Build header row
    const headers = [
      'Reporting Year',
      'Scope 1 Emissions (tCO₂e)',
      'Scope 2 Location-based (tCO₂e)',
      'Scope 2 Market-based (tCO₂e)',
      'Scope 3 Total (tCO₂e)',
      `Revenue (${currencySymbol})`,
      'CDP Score',
      'EcoVadis Score (0-100)',
      'SBTi Status',
    ];

    // Add Scope 3 sub-category columns (value + status pairs)
    SCOPE3_CATEGORIES.forEach(cat => {
      headers.push(`S3 ${cat.label} (tCO₂e)`);
      headers.push(`S3 ${cat.label} Status`);
    });

    // Create sample row
    const sampleRow: any = {
      'Reporting Year': new Date().getFullYear() - 1,
      'Scope 1 Emissions (tCO₂e)': '',
      'Scope 2 Location-based (tCO₂e)': '',
      'Scope 2 Market-based (tCO₂e)': '',
      'Scope 3 Total (tCO₂e)': '',
      [`Revenue (${currencySymbol})`]: '',
      'CDP Score': '',
      'EcoVadis Score (0-100)': '',
      'SBTi Status': '',
    };
    SCOPE3_CATEGORIES.forEach(cat => {
      sampleRow[`S3 ${cat.label} (tCO₂e)`] = '';
      sampleRow[`S3 ${cat.label} Status`] = 'Calculated';
    });
    
    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    
    // Set column widths
    const cols = [
      { wch: 15 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 22 },
      { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    ];
    SCOPE3_CATEGORIES.forEach(() => {
      cols.push({ wch: 30 }, { wch: 18 });
    });
    ws['!cols'] = cols;

    // Dropdown options sheet
    const maxLen = Math.max(CDP_SCORES.length, SBTI_STATUSES.length, SCOPE3_STATUS_OPTIONS.length);
    const validationData: string[][] = [['CDP Scores', 'SBTi Status', 'Scope 3 Category Status']];
    for (let i = 0; i < maxLen; i++) {
      validationData.push([
        CDP_SCORES[i] || '',
        SBTI_STATUSES[i] || '',
        SCOPE3_STATUS_OPTIONS[i] || '',
      ]);
    }
    const wsValidation = XLSX.utils.aoa_to_sheet(validationData);
    
    XLSX.utils.book_append_sheet(wb, ws, 'Emissions Data');
    XLSX.utils.book_append_sheet(wb, wsValidation, 'Dropdown Options');
    
    XLSX.writeFile(wb, `emissions_template_${currencySymbol}.xlsx`);
    toast.success('Template downloaded successfully');
  }, [currencySymbol]);

  const exportData = useCallback(async () => {
    if (!userId) {
      toast.error('Please log in to export data');
      return;
    }

    const { data, error } = await supabase
      .from('emissions_data')
      .select('*')
      .eq('user_id', userId)
      .order('reporting_year', { ascending: true });

    if (error) {
      toast.error('Failed to export data');
      return;
    }

    if (!data || data.length === 0) {
      toast.error('No emissions data to export');
      return;
    }

    const exportRows = data.map(row => {
      const base: any = {
        'Reporting Year': row.reporting_year,
        'Scope 1 Emissions (tCO₂e)': row.scope_1_emissions ?? '',
        'Scope 2 Location-based (tCO₂e)': (row as any).scope_2_location_based ?? '',
        'Scope 2 Market-based (tCO₂e)': row.scope_2_emissions ?? '',
        'Scope 3 Total (tCO₂e)': row.scope_3_emissions ?? '',
        [`Revenue (${currencySymbol})`]: row.revenue ?? '',
        'CDP Score': row.cdp_score ?? '',
        'EcoVadis Score (0-100)': row.ecovadis_score ?? '',
        'SBTi Status': row.sbti_target_status ?? '',
      };

      const breakdown = (row as any).scope3_breakdown || {};
      SCOPE3_CATEGORIES.forEach(cat => {
        const entry = breakdown[cat.code];
        const status = entry?.status || 'calculated';
        base[`S3 ${cat.label} (tCO₂e)`] = status === 'calculated' ? (entry?.value ?? '') : '';
        base[`S3 ${cat.label} Status`] = status === 'not_applicable' ? 'Not Applicable' 
          : status === 'not_calculated' ? 'Not Calculated' : 'Calculated';
      });

      return base;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    
    const cols = [
      { wch: 15 }, { wch: 22 }, { wch: 28 }, { wch: 28 }, { wch: 22 },
      { wch: 18 }, { wch: 12 }, { wch: 20 }, { wch: 20 },
    ];
    SCOPE3_CATEGORIES.forEach(() => {
      cols.push({ wch: 30 }, { wch: 18 });
    });
    ws['!cols'] = cols;

    XLSX.utils.book_append_sheet(wb, ws, 'Emissions Data');
    XLSX.writeFile(wb, `emissions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${data.length} records successfully`);
  }, [userId, currencySymbol]);

  const importData = useCallback(async (file: File): Promise<{ success: boolean; count: number }> => {
    if (!userId) {
      toast.error('Please log in to import data');
      return { success: false, count: 0 };
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (jsonData.length === 0) {
            toast.error('No data found in the file');
            resolve({ success: false, count: 0 });
            return;
          }

          const rows: EmissionsRow[] = [];
          const errors: string[] = [];

          jsonData.forEach((row: any, index: number) => {
            const reportingYear = parseInt(row['Reporting Year']);
            
            if (isNaN(reportingYear) || reportingYear < 1900 || reportingYear > 2100) {
              errors.push(`Row ${index + 2}: Invalid reporting year`);
              return;
            }

            const cdpScore = row['CDP Score']?.toString().trim() || null;
            if (cdpScore && !CDP_SCORES.includes(cdpScore)) {
              errors.push(`Row ${index + 2}: Invalid CDP Score "${cdpScore}"`);
              return;
            }

            const sbtiStatus = row['SBTi Status']?.toString().trim() || null;
            if (sbtiStatus && !SBTI_STATUSES.includes(sbtiStatus)) {
              errors.push(`Row ${index + 2}: Invalid SBTi Status "${sbtiStatus}"`);
              return;
            }

            const ecovadisRaw = row['EcoVadis Score (0-100)'];
            let ecovadisScore: number | null = null;
            if (ecovadisRaw !== '' && ecovadisRaw !== undefined && ecovadisRaw !== null) {
              ecovadisScore = parseInt(ecovadisRaw);
              if (isNaN(ecovadisScore) || ecovadisScore < 0 || ecovadisScore > 100) {
                errors.push(`Row ${index + 2}: EcoVadis Score must be between 0 and 100`);
                return;
              }
            }

            const revenueKey = Object.keys(row).find(k => k.startsWith('Revenue'));
            const revenue = revenueKey && row[revenueKey] !== '' ? parseFloat(row[revenueKey]) : null;

            // Parse Scope 3 breakdown
            const breakdown: Record<string, { value: number | null; status: string }> = {};
            let breakdownTotal = 0;

            SCOPE3_CATEGORIES.forEach(cat => {
              const valKey = `S3 ${cat.label} (tCO₂e)`;
              const statusKey = `S3 ${cat.label} Status`;
              const rawStatus = row[statusKey]?.toString().trim() || 'Calculated';
              
              let status = 'calculated';
              if (rawStatus === 'Not Applicable') status = 'not_applicable';
              else if (rawStatus === 'Not Calculated') status = 'not_calculated';

              let value: number | null = null;
              if (status === 'calculated' && row[valKey] !== '' && row[valKey] !== undefined && row[valKey] !== null) {
                value = parseFloat(row[valKey]);
                if (!isNaN(value)) breakdownTotal += value;
                else value = null;
              }

              breakdown[cat.code] = { value, status };
            });

            // Parse scope 3 total - use "Scope 3 Total" or "Scope 3 Emissions" header
            const s3Key = Object.keys(row).find(k => k.includes('Scope 3'));
            const scope3Val = s3Key && row[s3Key] !== '' ? parseFloat(row[s3Key]) : null;

            // Auto-set scope 3 total from breakdown if breakdown has values but total doesn't
            const finalScope3 = scope3Val ?? (breakdownTotal > 0 ? breakdownTotal : null);

            rows.push({
              reporting_year: reportingYear,
              scope_1_emissions: row['Scope 1 Emissions (tCO₂e)'] !== '' ? parseFloat(row['Scope 1 Emissions (tCO₂e)']) : null,
              scope_2_location_based: row['Scope 2 Location-based (tCO₂e)'] !== '' ? parseFloat(row['Scope 2 Location-based (tCO₂e)']) : null,
              scope_2_emissions: row['Scope 2 Market-based (tCO₂e)'] !== '' ? parseFloat(row['Scope 2 Market-based (tCO₂e)']) : null,
              scope_3_emissions: finalScope3,
              revenue: revenue,
              cdp_score: cdpScore,
              ecovadis_score: ecovadisScore,
              sbti_target_status: sbtiStatus,
              scope3_breakdown: breakdown,
            });
          });

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`);
            resolve({ success: false, count: 0 });
            return;
          }

          let successCount = 0;
          
          for (const row of rows) {
            const { data: existing } = await supabase
              .from('emissions_data')
              .select('id')
              .eq('user_id', userId)
              .eq('reporting_year', row.reporting_year)
              .maybeSingle();

            const payload = {
              user_id: userId,
              ...row,
            };

            let error;
            if (existing) {
              ({ error } = await supabase
                .from('emissions_data')
                .update(payload)
                .eq('id', existing.id));
            } else {
              ({ error } = await supabase
                .from('emissions_data')
                .insert(payload));
            }

            if (!error) successCount++;
          }

          if (successCount === rows.length) {
            toast.success(`Successfully imported ${successCount} records`);
            resolve({ success: true, count: successCount });
          } else {
            toast.warning(`Imported ${successCount} of ${rows.length} records`);
            resolve({ success: true, count: successCount });
          }
        } catch (err) {
          console.error('Import error:', err);
          toast.error('Failed to parse the file. Please use the provided template.');
          resolve({ success: false, count: 0 });
        }
      };

      reader.onerror = () => {
        toast.error('Failed to read the file');
        resolve({ success: false, count: 0 });
      };

      reader.readAsArrayBuffer(file);
    });
  }, [userId]);

  return {
    downloadTemplate,
    exportData,
    importData,
  };
};

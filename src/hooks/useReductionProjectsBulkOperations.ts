import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VALID_SCOPE_TYPES = ['scope_1_2', 'scope_3'] as const;
const VALID_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;

const SCOPE_LABELS: Record<string, string> = {
  scope_1_2: 'Scope 1 & 2',
  scope_3: 'Scope 3',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const LABEL_TO_SCOPE: Record<string, string> = Object.fromEntries(
  Object.entries(SCOPE_LABELS).map(([k, v]) => [v.toLowerCase(), k])
);
const LABEL_TO_STATUS: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([k, v]) => [v.toLowerCase(), k])
);

export const useReductionProjectsBulkOperations = (userId: string | undefined) => {

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const headers = ['Name', 'Description', 'Scope Type', 'Status', 'Project Cost ($)', 'Annual Emission Savings (tCO₂e)', 'Start Year', 'End Year'];
    const sampleRows = [
      ['Solar PV Installation', 'Rooftop solar panels at HQ', 'Scope 1 & 2', 'Planned', 150000, 200, 2025, 2030],
      ['Supplier Engagement Programme', 'Top 20 suppliers decarbonisation', 'Scope 3', 'In Progress', 50000, 500, 2025, 2028],
      ['LED Lighting Retrofit', 'Replace all fluorescent lighting', 'Scope 1 & 2', 'Completed', 25000, 45, 2024, 2035],
      ['Fleet Electrification', 'Replace diesel vans with EVs', 'Scope 1 & 2', 'Planned', 300000, 350, 2025, 2032],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    ws['!cols'] = [
      { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
    ];

    // Reference sheet
    const refRows: string[][] = [
      ['Field', 'Valid Values'],
      ['Scope Type', Object.values(SCOPE_LABELS).join(', ')],
      ['Status', Object.values(STATUS_LABELS).join(', ')],
      ['Project Cost ($)', 'Numeric value, e.g. 150000'],
      ['Annual Emission Savings (tCO₂e)', 'Numeric value, e.g. 200'],
      ['Start Year', 'e.g. 2025'],
      ['End Year', 'e.g. 2030'],
    ];
    const wsRef = XLSX.utils.aoa_to_sheet(refRows);
    wsRef['!cols'] = [{ wch: 30 }, { wch: 60 }];

    XLSX.utils.book_append_sheet(wb, ws, 'Reduction Projects');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    XLSX.writeFile(wb, 'emission_reduction_projects_template.xlsx');
    toast.success('Template downloaded');
  }, []);

  const exportData = useCallback(async () => {
    if (!userId) { toast.error('Please log in to export'); return; }

    const { data, error } = await supabase
      .from('emission_reduction_projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) { toast.error('Failed to export data'); return; }
    if (!data || data.length === 0) { toast.error('No projects to export'); return; }

    const rows = data.map((p: any) => ({
      'Name': p.name,
      'Description': p.description || '',
      'Scope Type': SCOPE_LABELS[p.scope_type] || p.scope_type,
      'Status': STATUS_LABELS[p.status] || p.status,
      'Project Cost ($)': p.project_cost,
      'Annual Emission Savings (tCO₂e)': p.annual_emission_savings,
      'MAC ($/tCO₂e)': p.annual_emission_savings > 0 ? Math.round(p.project_cost / p.annual_emission_savings) : 0,
      'Start Year': p.start_year,
      'End Year': p.end_year,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
      { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Reduction Projects');
    XLSX.writeFile(wb, `emission_reduction_projects_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${data.length} projects`);
  }, [userId]);

  const importData = useCallback(async (file: File): Promise<{ success: boolean; count: number }> => {
    if (!userId) { toast.error('Please log in to import'); return { success: false, count: 0 }; }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const ws = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(ws);

          if (jsonData.length === 0) {
            toast.error('No data found in the file');
            resolve({ success: false, count: 0 });
            return;
          }

          const rows: any[] = [];
          const errors: string[] = [];

          jsonData.forEach((row: any, idx: number) => {
            const name = row['Name']?.toString().trim();
            const description = row['Description']?.toString().trim() || null;
            const rawScope = row['Scope Type']?.toString().trim() || '';
            const rawStatus = row['Status']?.toString().trim() || '';
            const costKey = Object.keys(row).find(k => k.startsWith('Project Cost'));
            const savingsKey = Object.keys(row).find(k => k.startsWith('Annual Emission'));
            const cost = parseFloat(costKey ? row[costKey] : 0) || 0;
            const savings = parseFloat(savingsKey ? row[savingsKey] : 0) || 0;
            const startYear = parseInt(row['Start Year']) || null;
            const endYear = parseInt(row['End Year']) || null;

            if (!name) { errors.push(`Row ${idx + 2}: Name is required`); return; }

            const scopeType = LABEL_TO_SCOPE[rawScope.toLowerCase()] || rawScope.toLowerCase().replace(/\s+/g, '_');
            if (!VALID_SCOPE_TYPES.includes(scopeType as any)) {
              errors.push(`Row ${idx + 2}: Invalid Scope Type "${rawScope}". Use: ${Object.values(SCOPE_LABELS).join(', ')}`);
              return;
            }

            const status = LABEL_TO_STATUS[rawStatus.toLowerCase()] || rawStatus.toLowerCase().replace(/\s+/g, '_');
            if (!VALID_STATUSES.includes(status as any)) {
              errors.push(`Row ${idx + 2}: Invalid Status "${rawStatus}". Use: ${Object.values(STATUS_LABELS).join(', ')}`);
              return;
            }

            rows.push({
              user_id: userId,
              name,
              description,
              scope_type: scopeType,
              status,
              project_cost: cost,
              annual_emission_savings: savings,
              start_year: startYear,
              end_year: endYear,
            });
          });

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`);
            resolve({ success: false, count: 0 });
            return;
          }

          const { error } = await supabase.from('emission_reduction_projects').insert(rows);
          if (error) {
            console.error('Import error:', error);
            toast.error('Failed to import projects');
            resolve({ success: false, count: 0 });
            return;
          }

          toast.success(`Imported ${rows.length} projects`);
          resolve({ success: true, count: rows.length });
        } catch (err) {
          console.error('Import error:', err);
          toast.error('Failed to parse file. Please use the provided template.');
          resolve({ success: false, count: 0 });
        }
      };
      reader.onerror = () => { toast.error('Failed to read file'); resolve({ success: false, count: 0 }); };
      reader.readAsArrayBuffer(file);
    });
  }, [userId]);

  return { downloadTemplate, exportData, importData };
};

import { useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientRow {
  company_name: string;
  country: string;
  revenue: number;
}

export const useClientsBulkOperations = (
  userId: string | undefined,
  currencySymbol: string,
  selectedYear: number,
  emissionIntensity: number
) => {

  const downloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    const templateData = [
      {
        'Company Name': '',
        'Country': '',
        [`Revenue (${currencySymbol})`]: '',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 30 }, // Company Name
      { wch: 20 }, // Country
      { wch: 20 }, // Revenue
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Client Data');

    XLSX.writeFile(wb, `clients_template_${selectedYear}_${currencySymbol}.xlsx`);
    toast.success('Template downloaded successfully');
  }, [currencySymbol, selectedYear]);

  const exportData = useCallback(async () => {
    if (!userId) {
      toast.error('Please log in to export data');
      return;
    }

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('user_id', userId)
      .eq('reporting_year', selectedYear)
      .order('company_name', { ascending: true });

    if (error) {
      toast.error('Failed to export data');
      return;
    }

    if (!data || data.length === 0) {
      toast.error('No client data to export');
      return;
    }

    const exportRows = data.map(row => ({
      'Company Name': row.company_name,
      'Country': row.country,
      [`Revenue (${currencySymbol})`]: row.revenue,
      'Apportioned Emissions (tCO₂e)': row.apportioned_emissions ?? '',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);

    ws['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 28 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Client Data');
    XLSX.writeFile(wb, `clients_export_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${data.length} client records successfully`);
  }, [userId, currencySymbol, selectedYear]);

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

          const rows: ClientRow[] = [];
          const errors: string[] = [];

          jsonData.forEach((row: any, index: number) => {
            const companyName = row['Company Name']?.toString().trim();
            const country = row['Country']?.toString().trim();
            
            // Parse revenue dynamically for different currency columns
            const revenueKey = Object.keys(row).find(k => k.startsWith('Revenue'));
            const revenueRaw = revenueKey ? row[revenueKey] : null;

            if (!companyName) {
              errors.push(`Row ${index + 2}: Company Name is required`);
              return;
            }

            if (!country) {
              errors.push(`Row ${index + 2}: Country is required`);
              return;
            }

            if (revenueRaw === '' || revenueRaw === undefined || revenueRaw === null) {
              errors.push(`Row ${index + 2}: Revenue is required`);
              return;
            }

            const revenue = parseFloat(revenueRaw);
            if (isNaN(revenue) || revenue < 0) {
              errors.push(`Row ${index + 2}: Invalid revenue value`);
              return;
            }

            rows.push({
              company_name: companyName,
              country: country,
              revenue: revenue,
            });
          });

          if (errors.length > 0) {
            toast.error(`Validation errors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`);
            resolve({ success: false, count: 0 });
            return;
          }

          // Insert all clients with calculated apportioned emissions
          const clientsToInsert = rows.map(row => ({
            user_id: userId,
            company_name: row.company_name,
            country: row.country,
            revenue: row.revenue,
            apportioned_emissions: row.revenue * emissionIntensity,
            reporting_year: selectedYear,
          }));

          const { error } = await supabase
            .from('clients')
            .insert(clientsToInsert);

          if (error) {
            console.error('Import error:', error);
            toast.error('Failed to import clients');
            resolve({ success: false, count: 0 });
            return;
          }

          toast.success(`Successfully imported ${rows.length} clients`);
          resolve({ success: true, count: rows.length });
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
  }, [userId, selectedYear, emissionIntensity]);

  return {
    downloadTemplate,
    exportData,
    importData,
  };
};

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Loader2, Users, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useClientsBulkOperations } from '@/hooks/useClientsBulkOperations';

interface Client {
  id: string;
  company_name: string;
  country: string;
  revenue: number;
  apportioned_emissions: number | null;
  reporting_year: number;
}

interface EmissionsData {
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
  revenue: number | null;
}

export const ClientsTab = () => {
  const { user } = useAuth();
  const { selectedYear, currencySymbol } = useDashboard();
  const [clients, setClients] = useState<Client[]>([]);
  const [emissions, setEmissions] = useState<EmissionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    company_name: '',
    country: '',
    revenue: '',
  });

  // Calculate emission intensity early for bulk operations hook
  const totalEmissions = (emissions?.scope_1_emissions || 0) + 
                         (emissions?.scope_2_emissions || 0) + 
                         (emissions?.scope_3_emissions || 0);
  const totalRevenue = emissions?.revenue || 0;
  const emissionIntensity = totalRevenue > 0 ? totalEmissions / totalRevenue : 0;

  const { downloadTemplate, exportData, importData } = useClientsBulkOperations(
    user?.id,
    currencySymbol,
    selectedYear,
    emissionIntensity
  );

  const fetchData = async () => {
    if (!user) return;

    const [clientsRes, emissionsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('reporting_year', selectedYear)
        .order('company_name'),
      supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('reporting_year', selectedYear)
        .maybeSingle(),
    ]);

    if (clientsRes.data) setClients(clientsRes.data);
    if (emissionsRes.data) setEmissions(emissionsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [user, selectedYear]);


  const calculateApportionedEmissions = (clientRevenue: number) => {
    return clientRevenue * emissionIntensity;
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    const clientRevenue = parseFloat(formData.revenue);
    const apportioned = calculateApportionedEmissions(clientRevenue);

    const { error } = await supabase.from('clients').insert({
      user_id: user.id,
      company_name: formData.company_name,
      country: formData.country,
      revenue: clientRevenue,
      apportioned_emissions: apportioned,
      reporting_year: selectedYear,
    });

    if (error) {
      toast.error('Failed to add client');
    } else {
      toast.success('Client added');
      setFormData({ company_name: '', country: '', revenue: '' });
      setShowForm(false);
      fetchData();
    }
    setSaving(false);
  };

  const handleDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    
    if (error) {
      toast.error('Failed to delete client');
    } else {
      toast.success('Client deleted');
      setClients(clients.filter(c => c.id !== id));
    }
  };

  const handleClearAllClients = async () => {
    if (!user || clients.length === 0) return;
    
    setClearing(true);
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('user_id', user.id)
      .eq('reporting_year', selectedYear);

    if (error) {
      toast.error('Failed to clear clients');
    } else {
      toast.success(`All client data for ${selectedYear} cleared successfully`);
      setClients([]);
    }
    setClearing(false);
    setShowClearConfirm(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const result = await importData(file);
    setImporting(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Refresh data if import was successful
    if (result.success) {
      fetchData();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Client Management</h1>
          <p className="text-muted-foreground">Track apportioned emissions for your clients</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Bulk Operations */}
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={downloadTemplate}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download Template
          </Button>
          
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import Data
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            size="sm"
            onClick={exportData}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>

          {clients.length > 0 && (
            <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={clearing}>
                  {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all {clients.length} client(s) for {selectedYear}. 
                    This action cannot be undone and will affect calculations across all sections.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleClearAllClients}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Clear All Clients
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Users className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <p>
              Apportioned emissions are calculated as: (Your Total Emissions / Your Revenue) × Client Revenue.
              This allocates your carbon footprint proportionally to each client based on their revenue share.
              Current intensity: {(emissionIntensity * 1000000).toFixed(2)} tCO₂e/M{currencySymbol}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Add Client Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Client</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddClient} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Revenue ({currencySymbol})</Label>
                <Input
                  type="number"
                  value={formData.revenue}
                  onChange={(e) => setFormData({ ...formData, revenue: e.target.value })}
                  required
                />
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Client
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Clients List */}
      <Card>
        <CardHeader>
          <CardTitle>Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No clients added yet. Add your first client above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-left py-3 px-4 font-medium">Country</th>
                    <th className="text-right py-3 px-4 font-medium">Revenue ({currencySymbol})</th>
                    <th className="text-right py-3 px-4 font-medium">Apportioned Emissions (tCO₂e)</th>
                    <th className="text-right py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">{client.company_name}</td>
                      <td className="py-3 px-4">{client.country}</td>
                      <td className="py-3 px-4 text-right">{client.revenue.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right">
                        {(client.apportioned_emissions || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Loader2, TrendingDown, DollarSign, Leaf, BarChart3, Edit2, X, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { useReductionProjectsBulkOperations } from '@/hooks/useReductionProjectsBulkOperations';
import { useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  ComposedChart, Line, Area, ReferenceLine
} from 'recharts';

interface Project {
  id: string;
  name: string;
  description: string | null;
  scope_type: string;
  status: string;
  project_cost: number;
  annual_emission_savings: number;
  start_year: number | null;
  end_year: number | null;
}

interface Props {
  baseScope12: number;
  baseScope3: number;
  baseYear: number;
  nearTermYear: number;
  netZeroYear: number;
  scope12ReductionPercent: number;
  scope3ReductionPercent: number;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  in_progress: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  completed: 'bg-green-500/10 text-green-700 border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-700 border-red-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const MACC_COLORS = ['#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#ffb74d', '#ff9800', '#f44336'];

export const EmissionReductionProjects = ({
  baseScope12, baseScope3, baseYear, nearTermYear, netZeroYear,
  scope12ReductionPercent, scope3ReductionPercent,
}: Props) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { downloadTemplate, exportData, importData } = useReductionProjectsBulkOperations(user?.id);
  const [form, setForm] = useState({
    name: '', description: '', scope_type: 'scope_1_2', status: 'planned',
    project_cost: 0, annual_emission_savings: 0, start_year: baseYear + 1, end_year: nearTermYear,
  });

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('emission_reduction_projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    if (data) setProjects(data as Project[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const resetForm = () => {
    setForm({
      name: '', description: '', scope_type: 'scope_1_2', status: 'planned',
      project_cost: 0, annual_emission_savings: 0, start_year: baseYear + 1, end_year: nearTermYear,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    const payload = { ...form, user_id: user.id };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('emission_reduction_projects').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('emission_reduction_projects').insert(payload));
    }

    if (error) toast.error('Failed to save project');
    else { toast.success(editingId ? 'Project updated' : 'Project added'); resetForm(); fetchProjects(); }
    setSaving(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importData(file);
    if (result.success) fetchProjects();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleEdit = (p: Project) => {
    setForm({
      name: p.name, description: p.description || '', scope_type: p.scope_type, status: p.status,
      project_cost: p.project_cost, annual_emission_savings: p.annual_emission_savings,
      start_year: p.start_year || baseYear + 1, end_year: p.end_year || nearTermYear,
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('emission_reduction_projects').delete().eq('id', id);
    if (error) toast.error('Failed to delete'); else { toast.success('Project deleted'); fetchProjects(); }
  };

  const scope12Projects = useMemo(() => projects.filter(p => p.scope_type === 'scope_1_2' && p.status !== 'cancelled'), [projects]);
  const scope3Projects = useMemo(() => projects.filter(p => p.scope_type === 'scope_3' && p.status !== 'cancelled'), [projects]);

  // MACC data: sorted by marginal abatement cost ascending
  const maccData = useMemo(() => {
    const activeProjects = projects.filter(p => p.status !== 'cancelled' && p.annual_emission_savings > 0);
    return activeProjects
      .map(p => ({
        name: p.name,
        mac: p.project_cost / p.annual_emission_savings,
        savings: p.annual_emission_savings,
        cost: p.project_cost,
        scope_type: p.scope_type,
      }))
      .sort((a, b) => a.mac - b.mac);
  }, [projects]);

  // Net-zero impact analysis
  const impactAnalysis = useMemo(() => {
    const totalScope12Savings = scope12Projects.reduce((s, p) => s + p.annual_emission_savings, 0);
    const totalScope3Savings = scope3Projects.reduce((s, p) => s + p.annual_emission_savings, 0);
    const requiredScope12 = baseScope12 * (scope12ReductionPercent / 100);
    const requiredScope3 = baseScope3 * (scope3ReductionPercent / 100);
    const scope12Coverage = requiredScope12 > 0 ? (totalScope12Savings * (nearTermYear - baseYear)) / requiredScope12 * 100 : 0;
    const scope3Coverage = requiredScope3 > 0 ? (totalScope3Savings * (nearTermYear - baseYear)) / requiredScope3 * 100 : 0;
    const totalCost = projects.filter(p => p.status !== 'cancelled').reduce((s, p) => s + p.project_cost, 0);

    return { totalScope12Savings, totalScope3Savings, requiredScope12, requiredScope3, scope12Coverage, scope3Coverage, totalCost };
  }, [scope12Projects, scope3Projects, baseScope12, baseScope3, scope12ReductionPercent, scope3ReductionPercent, nearTermYear, baseYear, projects]);

  // Pathway impact chart data
  const pathwayData = useMemo(() => {
    const data = [];
    for (let year = baseYear; year <= netZeroYear; year++) {
      const yearsFromBase = year - baseYear;
      // BAU pathway (without projects)
      let bauScope12 = baseScope12;
      let bauScope3 = baseScope3;
      if (year <= nearTermYear) {
        const p = (year - baseYear) / (nearTermYear - baseYear);
        bauScope12 = baseScope12 * (1 - p * (scope12ReductionPercent / 100));
        bauScope3 = baseScope3 * (1 - p * (scope3ReductionPercent / 100));
      } else {
        const ntScope12 = baseScope12 * (1 - scope12ReductionPercent / 100);
        const ntScope3 = baseScope3 * (1 - scope3ReductionPercent / 100);
        const p = (year - nearTermYear) / (netZeroYear - nearTermYear);
        bauScope12 = ntScope12 * (1 - p * 0.95);
        bauScope3 = ntScope3 * (1 - p * 0.9);
      }

      // With projects: cumulative savings
      let projectScope12Savings = 0;
      let projectScope3Savings = 0;
      scope12Projects.forEach(proj => {
        const sy = proj.start_year || baseYear + 1;
        const ey = proj.end_year || netZeroYear;
        if (year >= sy && year <= ey) projectScope12Savings += proj.annual_emission_savings;
      });
      scope3Projects.forEach(proj => {
        const sy = proj.start_year || baseYear + 1;
        const ey = proj.end_year || netZeroYear;
        if (year >= sy && year <= ey) projectScope3Savings += proj.annual_emission_savings;
      });

      data.push({
        year,
        'Target Pathway': Math.max(0, Math.round(bauScope12 + bauScope3)),
        'With Projects': Math.max(0, Math.round(bauScope12 + bauScope3 - projectScope12Savings - projectScope3Savings)),
      });
    }
    return data;
  }, [baseYear, netZeroYear, nearTermYear, baseScope12, baseScope3, scope12ReductionPercent, scope3ReductionPercent, scope12Projects, scope3Projects]);

  const renderProjectTable = (scopeProjects: Project[], scopeLabel: string) => (
    <div className="space-y-3">
      {scopeProjects.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No {scopeLabel} projects yet. Add one to get started.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2">Project</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-right py-2 px-2">Cost</th>
                <th className="text-right py-2 px-2">Savings/yr (tCO₂e)</th>
                <th className="text-right py-2 px-2">MAC ($/tCO₂e)</th>
                <th className="text-right py-2 px-2">Years</th>
                <th className="text-right py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scopeProjects.map(p => {
                const mac = p.annual_emission_savings > 0 ? p.project_cost / p.annual_emission_savings : 0;
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </td>
                    <td className="py-2 px-2">
                      <Badge variant="outline" className={STATUS_COLORS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                    </td>
                    <td className="py-2 px-2 text-right">${p.project_cost.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right font-medium text-green-600">{p.annual_emission_savings.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">${mac.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{p.start_year}–{p.end_year}</td>
                    <td className="py-2 px-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Leaf className="h-5 w-5 text-green-600" />Emission Reduction Projects</h2>
          <p className="text-sm text-muted-foreground">Track carbon reduction initiatives and their impact on your net-zero journey</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Project
          </Button>
        </div>
      </div>
      {/* Add/Edit Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{editingId ? 'Edit' : 'Add'} Reduction Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Project Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Solar PV Installation" />
              </div>
              <div className="space-y-1.5">
                <Label>Scope Type</Label>
                <Select value={form.scope_type} onValueChange={v => setForm({ ...form, scope_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scope_1_2">Scope 1 & 2</SelectItem>
                    <SelectItem value="scope_3">Scope 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Project Cost ($)</Label>
                <Input type="number" value={form.project_cost} onChange={e => setForm({ ...form, project_cost: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1.5">
                <Label>Annual Emission Savings (tCO₂e)</Label>
                <Input type="number" value={form.annual_emission_savings} onChange={e => setForm({ ...form, annual_emission_savings: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Start Year</Label>
                  <Input type="number" value={form.start_year} onChange={e => setForm({ ...form, start_year: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Year</Label>
                  <Input type="number" value={form.end_year} onChange={e => setForm({ ...form, end_year: parseInt(e.target.value) })} />
                </div>
              </div>
              <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Brief description of the project..." />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <Save className="h-4 w-4 mr-1" /> {editingId ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" size="sm" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto text-primary mb-1" />
            <div className="text-2xl font-bold text-primary">{impactAnalysis.totalScope12Savings.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Scope 1&2 Savings/yr (tCO₂e)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto text-orange-600 mb-1" />
            <div className="text-2xl font-bold text-orange-600">{impactAnalysis.totalScope3Savings.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Scope 3 Savings/yr (tCO₂e)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <div className="text-2xl font-bold">${(impactAnalysis.totalCost / 1000).toFixed(0)}k</div>
            <div className="text-xs text-muted-foreground">Total Investment</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <div className="text-2xl font-bold text-green-600">
              {Math.min(100, Math.round((impactAnalysis.scope12Coverage + impactAnalysis.scope3Coverage) / 2))}%
            </div>
            <div className="text-xs text-muted-foreground">Near-Term Target Coverage</div>
          </CardContent>
        </Card>
      </div>

      {/* Near-term & Long-term Impact */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Near-Term Impact ({nearTermYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Scope 1&2 Target Coverage</span>
                  <span className="font-medium">{Math.min(100, impactAnalysis.scope12Coverage).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, impactAnalysis.scope12Coverage)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {impactAnalysis.totalScope12Savings.toLocaleString()} / {Math.round(impactAnalysis.requiredScope12 / (nearTermYear - baseYear)).toLocaleString()} tCO₂e/yr needed
                </p>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Scope 3 Target Coverage</span>
                  <span className="font-medium">{Math.min(100, impactAnalysis.scope3Coverage).toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${Math.min(100, impactAnalysis.scope3Coverage)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {impactAnalysis.totalScope3Savings.toLocaleString()} / {Math.round(impactAnalysis.requiredScope3 / (nearTermYear - baseYear)).toLocaleString()} tCO₂e/yr needed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Long-Term Net-Zero Impact ({netZeroYear})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pathwayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO₂e`, '']} />
                  <Legend />
                  <ReferenceLine x={nearTermYear} stroke="hsl(var(--primary))" strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="Target Pathway" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" fillOpacity={0.3} strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="With Projects" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Project Tables by Scope */}
      <Tabs defaultValue="scope_1_2">
        <TabsList>
          <TabsTrigger value="scope_1_2">Scope 1 & 2 Projects ({scope12Projects.length})</TabsTrigger>
          <TabsTrigger value="scope_3">Scope 3 Projects ({scope3Projects.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="scope_1_2">
          <Card>
            <CardContent className="pt-4">{renderProjectTable(projects.filter(p => p.scope_type === 'scope_1_2'), 'Scope 1 & 2')}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="scope_3">
          <Card>
            <CardContent className="pt-4">{renderProjectTable(projects.filter(p => p.scope_type === 'scope_3'), 'Scope 3')}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MACC Curve */}
      {maccData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Marginal Abatement Cost Curve (MACC)</CardTitle>
            <CardDescription>Projects ranked by cost-effectiveness — cheapest abatement first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maccData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                  <YAxis
                    yAxisId="mac"
                    label={{ value: '$/tCO₂e', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="savings"
                    orientation="right"
                    label={{ value: 'tCO₂e saved/yr', angle: 90, position: 'insideRight', style: { fontSize: 11 } }}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'Abatement Cost') return [`$${value.toFixed(0)}/tCO₂e`, name];
                      return [`${value.toLocaleString()} tCO₂e`, name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="savings" dataKey="savings" name="Annual Savings" fill="hsl(var(--chart-1))" fillOpacity={0.4} />
                  <Bar yAxisId="mac" dataKey="mac" name="Abatement Cost">
                    {maccData.map((_, i) => (
                      <Cell key={i} fill={MACC_COLORS[i % MACC_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

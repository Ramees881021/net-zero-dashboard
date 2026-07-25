import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, History, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  entry_id: string;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  reason: string | null;
  created_at: string;
}

interface EntryDetails {
  emission_factor: number | null;
  emission_factor_source: string | null;
  description: string | null;
  category: string;
  scope: number;
  amount_tco2e: number;
  activity_data: Record<string, any> | null;
  data_quality: string | null;
}

export const AuditTrailTab = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [entryDetailsCache, setEntryDetailsCache] = useState<Record<string, EntryDetails | null>>({});
  const [loadingDetails, setLoadingDetails] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('carbon_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (!error && data) {
        setLogs(data as AuditLogEntry[]);
      }
      setLoading(false);
    };
    fetchLogs();
  }, [user]);

  const handleToggleExpand = async (log: AuditLogEntry) => {
    if (expandedLogId === log.id) {
      setExpandedLogId(null);
      return;
    }
    setExpandedLogId(log.id);

    if (entryDetailsCache[log.entry_id] !== undefined) return;

    setLoadingDetails(log.id);
    const { data } = await supabase
      .from('carbon_calc_entries')
      .select('emission_factor, emission_factor_source, description, category, scope, amount_tco2e, activity_data, data_quality')
      .eq('id', log.entry_id)
      .maybeSingle();

    setEntryDetailsCache(prev => ({ ...prev, [log.entry_id]: (data as EntryDetails | null) }));
    setLoadingDetails(null);
  };

  const filteredLogs = logs.filter(log => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const newVals = JSON.stringify(log.new_values || {}).toLowerCase();
      const oldVals = JSON.stringify(log.old_values || {}).toLowerCase();
      const reason = (log.reason || '').toLowerCase();
      return newVals.includes(search) || oldVals.includes(search) || reason.includes(search) || log.entry_id.includes(search);
    }
    return true;
  });

  const actionIcon = (action: string) => {
    if (action === 'create') return <Plus className="h-3.5 w-3.5 text-green-600" />;
    if (action === 'update') return <Pencil className="h-3.5 w-3.5 text-blue-600" />;
    if (action === 'delete') return <Trash2 className="h-3.5 w-3.5 text-destructive" />;
    return null;
  };

  const actionBadge = (action: string) => {
    const variants: Record<string, string> = {
      create: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      update: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      delete: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return <Badge variant="outline" className={`text-[10px] ${variants[action] || ''}`}>{action}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Audit Trail
          </h1>
          <p className="text-muted-foreground">
            Complete history of all changes to carbon calculator entries
          </p>
        </div>
        <Badge variant="secondary">{filteredLogs.length} records</Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search entries, reasons..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Created</SelectItem>
            <SelectItem value="update">Updated</SelectItem>
            <SelectItem value="delete">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredLogs.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No Audit Records</h3>
            <p className="text-sm text-muted-foreground">
              Audit records will appear here after you save changes in the Carbon Calculator.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Change Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                const details = entryDetailsCache[log.entry_id];
                const isLoadingThis = loadingDetails === log.id;

                return (
                  <div key={log.id} className="rounded-lg bg-muted/50 border overflow-hidden">
                    <button
                      onClick={() => handleToggleExpand(log)}
                      className="w-full p-3 text-left hover:bg-muted/80 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          {actionIcon(log.action)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {actionBadge(log.action)}
                              <span className="text-xs text-muted-foreground font-mono truncate">
                                Entry: {log.entry_id.slice(0, 8)}...
                              </span>
                            </div>
                            {log.reason && (
                              <p className="text-xs mt-1 text-foreground">
                                <span className="text-muted-foreground">Reason:</span> {log.reason}
                              </p>
                            )}
                            {log.action === 'update' && log.old_values && log.new_values && (
                              <div className="mt-2 text-xs space-y-1">
                                {Object.keys(log.new_values).map(key => {
                                  const oldVal = log.old_values?.[key];
                                  const newVal = log.new_values?.[key];
                                  if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                                  return (
                                    <p key={key} className="text-muted-foreground">
                                      <span className="font-medium text-foreground">{key}:</span>{' '}
                                      <span className="line-through text-destructive/70">{typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '')}</span>
                                      {' → '}
                                      <span className="text-green-700 dark:text-green-400">{typeof newVal === 'object' ? JSON.stringify(newVal) : String(newVal ?? '')}</span>
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                            {log.action === 'create' && log.new_values && (
                              <p className="text-xs mt-1 text-muted-foreground">
                                Scope {log.new_values.scope} · {log.new_values.category} · {log.new_values.amount_tco2e?.toFixed(3)} tCO₂e
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 border-t bg-background/50 animate-fade-in">
                        {isLoadingThis ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-primary mr-2" />
                            <span className="text-xs text-muted-foreground">Loading entry details...</span>
                          </div>
                        ) : details ? (
                          (() => {
                            const actData = details.activity_data || {};
                            const quantity = Number(actData.quantity) || 0;
                            const computedFactor = details.emission_factor ?? (quantity > 0 ? details.amount_tco2e / quantity : null);
                            const factorSource = details.emission_factor_source || actData.type || 'Derived from activity data';
                            const unit = actData.unit || 'unit';
                            return (
                          <div className="pt-3 space-y-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">Emission Factor Details</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Scope</p>
                                <p className="font-semibold">Scope {details.scope}</p>
                              </div>
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Category</p>
                                <p className="font-semibold">{details.category}</p>
                              </div>
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Emission Factor</p>
                                <p className="font-semibold">{computedFactor != null ? computedFactor.toFixed(6) : 'N/A'}</p>
                              </div>
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Total tCO₂e</p>
                                <p className="font-semibold">{details.amount_tco2e?.toFixed(4)}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Factor Source</p>
                                <p className="font-semibold">{factorSource}</p>
                              </div>
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Calculation</p>
                                <p className="font-semibold">{quantity > 0 ? `${quantity.toLocaleString()} ${unit} × ${computedFactor?.toFixed(6) ?? '?'} = ${details.amount_tco2e?.toFixed(4)}` : `${details.amount_tco2e?.toFixed(4)} tCO₂e (direct)`}</p>
                              </div>
                              <div className="p-2 rounded-md bg-muted/60">
                                <p className="text-muted-foreground mb-0.5">Data Quality</p>
                                <p className="font-semibold capitalize">{details.data_quality?.replace(/_/g, ' ') || 'N/A'}</p>
                              </div>
                            </div>
                            {details.description && (
                              <div className="p-2 rounded-md bg-muted/60 text-xs">
                                <p className="text-muted-foreground mb-0.5">Description</p>
                                <p className="font-medium">{details.description}</p>
                              </div>
                            )}
                            {Object.keys(actData).length > 0 && (
                              <div className="p-2 rounded-md bg-muted/60 text-xs">
                                <p className="text-muted-foreground mb-0.5">Activity Data</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {Object.entries(actData).map(([key, val]) => (
                                    val != null && <Badge key={key} variant="secondary" className="text-[10px]">{key}: {String(val)}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                            );
                          })()
                        ) : (
                          <p className="text-xs text-muted-foreground py-4 text-center">
                            Entry has been deleted — no details available.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

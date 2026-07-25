import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';

interface AuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  entryDescription?: string;
}

interface LogEntry {
  id: string;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  reason: string | null;
  created_at: string;
}

export const AuditLogDialog = ({ open, onOpenChange, entryId, entryDescription }: AuditLogDialogProps) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !user || !entryId) return;
    setLoading(true);
    supabase
      .from('carbon_audit_log')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLogs((data || []) as LogEntry[]);
        setLoading(false);
      });
  }, [open, user, entryId]);

  const actionIcon = (action: string) => {
    if (action === 'create') return <Plus className="h-3.5 w-3.5 text-green-600" />;
    if (action === 'update') return <Pencil className="h-3.5 w-3.5 text-blue-600" />;
    if (action === 'delete') return <Trash2 className="h-3.5 w-3.5 text-destructive" />;
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Audit History: {entryDescription || entryId.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No change history for this entry.</p>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div key={log.id} className="p-3 rounded-lg bg-muted/50 border text-sm">
                <div className="flex items-center gap-2 mb-1">
                  {actionIcon(log.action)}
                  <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                {log.reason && (
                  <p className="text-xs mt-1"><span className="text-muted-foreground">Reason:</span> {log.reason}</p>
                )}
                {log.action === 'update' && log.old_values && log.new_values && (
                  <div className="mt-2 text-xs space-y-1">
                    {Object.keys(log.new_values).map(key => {
                      const oldVal = log.old_values?.[key];
                      const newVal = log.new_values?.[key];
                      if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return null;
                      return (
                        <p key={key}>
                          <span className="font-medium">{key}:</span>{' '}
                          <span className="line-through text-destructive/70">{String(oldVal ?? '')}</span>
                          {' → '}
                          <span className="text-green-700 dark:text-green-400">{String(newVal ?? '')}</span>
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

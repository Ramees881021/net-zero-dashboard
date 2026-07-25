import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuditReportConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: ReportConfig) => void;
}

export interface ReportConfig {
  boundaryApproach: string;
  exclusionsLog: string;
  verificationStatus: string;
  methodologyNotes: string;
  reportingYear: number;
}

const BOUNDARY_APPROACHES = [
  { value: 'operational_control', label: 'Operational Control' },
  { value: 'financial_control', label: 'Financial Control' },
  { value: 'equity_share', label: 'Equity Share' },
];

const VERIFICATION_STATUSES = [
  { value: 'unverified', label: 'Unverified' },
  { value: 'self_declared', label: 'Self-Declared' },
  { value: 'third_party_limited', label: 'Third-Party Limited Assurance' },
  { value: 'third_party_reasonable', label: 'Third-Party Reasonable Assurance' },
];

export const AuditReportConfigDialog = ({ open, onOpenChange, onGenerate }: AuditReportConfigDialogProps) => {
  const { user } = useAuth();
  const { selectedYear } = useDashboard();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [boundary, setBoundary] = useState('operational_control');
  const [exclusions, setExclusions] = useState('');
  const [verification, setVerification] = useState('unverified');
  const [methodology, setMethodology] = useState('');

  // Load existing config
  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from('audit_report_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('reporting_year', selectedYear)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBoundary((data as any).boundary_approach || 'operational_control');
          setExclusions((data as any).exclusions_log || '');
          setVerification((data as any).verification_status || 'unverified');
          setMethodology((data as any).methodology_notes || '');
        }
        setLoading(false);
      });
  }, [open, user, selectedYear]);

  const handleGenerate = async () => {
    if (!user) return;
    setSaving(true);

    // Upsert config
    const { data: existing } = await supabase
      .from('audit_report_config')
      .select('id')
      .eq('user_id', user.id)
      .eq('reporting_year', selectedYear)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('audit_report_config')
        .update({
          boundary_approach: boundary,
          exclusions_log: exclusions,
          verification_status: verification,
          methodology_notes: methodology,
        })
        .eq('id', (existing as any).id);
    } else {
      await supabase
        .from('audit_report_config')
        .insert({
          user_id: user.id,
          reporting_year: selectedYear,
          boundary_approach: boundary,
          exclusions_log: exclusions,
          verification_status: verification,
          methodology_notes: methodology,
        });
    }

    onGenerate({
      boundaryApproach: boundary,
      exclusionsLog: exclusions,
      verificationStatus: verification,
      methodologyNotes: methodology,
      reportingYear: selectedYear,
    });

    setSaving(false);
    onOpenChange(false);
    toast.success('Report configuration saved');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ISO 14064-1 Audit Report Configuration</DialogTitle>
          <DialogDescription>Configure report parameters for {selectedYear}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organizational Boundary Approach</Label>
              <Select value={boundary} onValueChange={setBoundary}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOUNDARY_APPROACHES.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Verification Status</Label>
              <Select value={verification} onValueChange={setVerification}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VERIFICATION_STATUSES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Exclusions & De Minimis Justifications</Label>
              <Textarea
                value={exclusions}
                onChange={e => setExclusions(e.target.value)}
                placeholder="Document any emission sources excluded from the inventory and justify why (e.g., de minimis, not relevant)..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Methodology Notes</Label>
              <Textarea
                value={methodology}
                onChange={e => setMethodology(e.target.value)}
                placeholder="Describe the quantification methodologies used, assumptions made, and any limitations..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleGenerate} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Audit Report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

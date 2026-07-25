import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Target, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, Area, ComposedChart,
} from 'recharts';

interface NetZeroTarget {
  base_year: number;
  near_term_target_year: number;
  netzero_target_year: number;
  scope_1_2_reduction_percent: number;
  scope_3_reduction_percent: number;
}

interface EmissionsRow {
  reporting_year: number;
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
}

type Status = 'on-track' | 'at-risk' | 'off-track' | 'ahead';

const statusConfig: Record<Status, { label: string; color: string; icon: any; badgeClass: string }> = {
  'ahead':     { label: 'Ahead of Target', color: 'text-emerald-600', icon: CheckCircle2, badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
  'on-track':  { label: 'On Track',         color: 'text-green-600',   icon: CheckCircle2, badgeClass: 'bg-green-500/15 text-green-700 border-green-500/30' },
  'at-risk':   { label: 'At Risk',          color: 'text-amber-600',   icon: AlertTriangle, badgeClass: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
  'off-track': { label: 'Off Track',        color: 'text-red-600',     icon: XCircle,      badgeClass: 'bg-red-500/15 text-red-700 border-red-500/30' },
};

function classify(actualPct: number, requiredPct: number): Status {
  // pct = reduction achieved / required (positive = reducing)
  if (requiredPct <= 0) return 'on-track';
  const ratio = actualPct / requiredPct;
  if (ratio >= 1.05) return 'ahead';
  if (ratio >= 0.9)  return 'on-track';
  if (ratio >= 0.6)  return 'at-risk';
  return 'off-track';
}

export const SBTiAdherenceCard = () => {
  const { user } = useAuth();
  const { selectedYear } = useDashboard();
  const [target, setTarget] = useState<NetZeroTarget | null>(null);
  const [emissions, setEmissions] = useState<EmissionsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [tRes, eRes] = await Promise.all([
        supabase.from('netzero_targets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('emissions_data').select('reporting_year, scope_1_emissions, scope_2_emissions, scope_3_emissions')
          .eq('user_id', user.id).order('reporting_year', { ascending: true }),
      ]);
      if (tRes.data) setTarget(tRes.data as any);
      if (eRes.data) setEmissions(eRes.data as any);
      setLoading(false);
    })();
  }, [user]);

  const analysis = useMemo(() => {
    if (!target || emissions.length === 0) return null;

    const base = emissions.find(e => e.reporting_year === target.base_year);
    if (!base) return null;

    const baseS12 = (base.scope_1_emissions || 0) + (base.scope_2_emissions || 0);
    const baseS3  = base.scope_3_emissions || 0;
    if (baseS12 <= 0 && baseS3 <= 0) return null;

    // Near-term pathway: linear from base year -> near_term_target_year (reduction %)
    // Net-zero pathway: linear from near-term -> netzero year to residual 10%
    const NEAR = target.near_term_target_year;
    const NZ = target.netzero_target_year;
    const s12Red = target.scope_1_2_reduction_percent / 100;
    const s3Red = target.scope_3_reduction_percent / 100;

    const requiredFor = (year: number, baseVal: number, reduction: number) => {
      if (baseVal <= 0) return 0;
      if (year <= target.base_year) return baseVal;
      if (year <= NEAR) {
        const frac = (year - target.base_year) / (NEAR - target.base_year);
        return baseVal * (1 - reduction * frac);
      }
      // From NEAR to NZ: reduce to 10% residual
      const nearVal = baseVal * (1 - reduction);
      const residual = baseVal * 0.10;
      if (year >= NZ) return residual;
      const frac = (year - NEAR) / (NZ - NEAR);
      return nearVal + (residual - nearVal) * frac;
    };

    const years: number[] = [];
    for (let y = target.base_year; y <= NZ; y++) years.push(y);

    const chartData = years.map(y => {
      const actual = emissions.find(e => e.reporting_year === y);
      const actualS12 = actual ? (actual.scope_1_emissions || 0) + (actual.scope_2_emissions || 0) : null;
      const actualS3 = actual ? (actual.scope_3_emissions || 0) : null;
      const actualTotal = actual != null && (actualS12 != null || actualS3 != null)
        ? (actualS12 || 0) + (actualS3 || 0) : null;
      const reqS12 = requiredFor(y, baseS12, s12Red);
      const reqS3 = requiredFor(y, baseS3, s3Red);
      return {
        year: y,
        'Required (Scope 1+2)': Math.round(reqS12),
        'Required (Scope 3)': Math.round(reqS3),
        'Required Total': Math.round(reqS12 + reqS3),
        'Actual Total': actualTotal != null ? Math.round(actualTotal) : null,
      };
    });

    // Selected year status
    const y = selectedYear;
    const current = emissions.find(e => e.reporting_year === y);
    const curS12 = current ? (current.scope_1_emissions || 0) + (current.scope_2_emissions || 0) : 0;
    const curS3 = current ? (current.scope_3_emissions || 0) : 0;

    const reqS12Now = requiredFor(y, baseS12, s12Red);
    const reqS3Now = requiredFor(y, baseS3, s3Red);

    // Required reduction % (from base) at year y
    const reqRedS12Pct = baseS12 > 0 ? ((baseS12 - reqS12Now) / baseS12) * 100 : 0;
    const reqRedS3Pct  = baseS3  > 0 ? ((baseS3  - reqS3Now)  / baseS3)  * 100 : 0;

    // Actual reduction % (from base) at year y
    const actRedS12Pct = baseS12 > 0 ? ((baseS12 - curS12) / baseS12) * 100 : 0;
    const actRedS3Pct  = baseS3  > 0 ? ((baseS3  - curS3)  / baseS3)  * 100 : 0;

    const statusS12 = classify(actRedS12Pct, reqRedS12Pct);
    const statusS3  = classify(actRedS3Pct,  reqRedS3Pct);

    // Overall status = worse of the two (weighted more toward S1+2 if S3 not tracked)
    const order: Status[] = ['ahead', 'on-track', 'at-risk', 'off-track'];
    const overall = order[Math.max(order.indexOf(statusS12), order.indexOf(statusS3))];

    const totalActual = curS12 + curS3;
    const totalRequired = reqS12Now + reqS3Now;
    const gap = totalActual - totalRequired; // positive = over budget

    return {
      chartData,
      statusS12, statusS3, overall,
      reqRedS12Pct, reqRedS3Pct, actRedS12Pct, actRedS3Pct,
      totalActual, totalRequired, gap,
      hasCurrent: !!current,
      baseYear: target.base_year,
      nearYear: NEAR, nzYear: NZ,
    };
  }, [target, emissions, selectedYear]);

  if (loading) return null;

  if (!target) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>SBTi / Net-Zero Pathway Adherence</CardTitle>
          </div>
          <CardDescription>Set your Net-Zero targets to track pathway adherence.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link to="#" onClick={(e) => { e.preventDefault(); window.location.hash = 'netzero'; }}>
              Configure Net-Zero targets <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>SBTi / Net-Zero Pathway Adherence</CardTitle>
          </div>
          <CardDescription>Add emissions data for your base year ({target.base_year}) to begin tracking.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const StatusPill = ({ status }: { status: Status }) => {
    const s = statusConfig[status];
    const Icon = s.icon;
    return (
      <Badge variant="outline" className={`gap-1 ${s.badgeClass}`}>
        <Icon className="h-3.5 w-3.5" />
        {s.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle>SBTi / Net-Zero Pathway Adherence</CardTitle>
            </div>
            <CardDescription>
              Base {analysis.baseYear} · Near-term {analysis.nearYear} ({target.scope_1_2_reduction_percent}% S1+2, {target.scope_3_reduction_percent}% S3) · Net-Zero {analysis.nzYear}
            </CardDescription>
          </div>
          <StatusPill status={analysis.overall} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Scope 1 + 2</p>
              <StatusPill status={analysis.statusS12} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Required by {selectedYear}: <span className="font-semibold text-foreground">−{analysis.reqRedS12Pct.toFixed(1)}%</span></p>
            <p className="text-xs text-muted-foreground">Actual: <span className={`font-semibold ${analysis.actRedS12Pct >= analysis.reqRedS12Pct ? 'text-green-600' : 'text-red-600'}`}>{analysis.actRedS12Pct >= 0 ? '−' : '+'}{Math.abs(analysis.actRedS12Pct).toFixed(1)}%</span></p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${analysis.actRedS12Pct >= analysis.reqRedS12Pct ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, (analysis.actRedS12Pct / Math.max(analysis.reqRedS12Pct, 0.01)) * 100))}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Scope 3</p>
              <StatusPill status={analysis.statusS3} />
            </div>
            <p className="text-xs text-muted-foreground mb-1">Required by {selectedYear}: <span className="font-semibold text-foreground">−{analysis.reqRedS3Pct.toFixed(1)}%</span></p>
            <p className="text-xs text-muted-foreground">Actual: <span className={`font-semibold ${analysis.actRedS3Pct >= analysis.reqRedS3Pct ? 'text-green-600' : 'text-red-600'}`}>{analysis.actRedS3Pct >= 0 ? '−' : '+'}{Math.abs(analysis.actRedS3Pct).toFixed(1)}%</span></p>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${analysis.actRedS3Pct >= analysis.reqRedS3Pct ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, (analysis.actRedS3Pct / Math.max(analysis.reqRedS3Pct, 0.01)) * 100))}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium mb-2">Gap to Pathway ({selectedYear})</p>
            <p className={`text-2xl font-bold ${analysis.gap <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analysis.gap <= 0 ? '' : '+'}{Math.round(analysis.gap).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">tCO₂e vs. required trajectory</p>
            <p className="text-xs text-muted-foreground mt-2">
              Actual {Math.round(analysis.totalActual).toLocaleString()} · Required {Math.round(analysis.totalRequired).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Pathway chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={analysis.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => v.toLocaleString()} />
              <Tooltip formatter={(v: any) => v != null ? `${Number(v).toLocaleString()} tCO₂e` : '—'} />
              <Legend />
              <ReferenceLine x={analysis.nearYear} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: 'Near-term', position: 'top', fontSize: 11 }} />
              <ReferenceLine x={analysis.nzYear} stroke="hsl(var(--primary))" strokeDasharray="4 4" label={{ value: 'Net-Zero', position: 'top', fontSize: 11 }} />
              <Line type="monotone" dataKey="Required Total" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="6 4" dot={false} />
              <Line type="monotone" dataKey="Actual Total" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={{ r: 3 }} connectNulls={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
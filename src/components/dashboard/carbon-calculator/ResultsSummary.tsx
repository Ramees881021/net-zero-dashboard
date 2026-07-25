import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getEquivalencies, SCOPE3_CATEGORIES } from '@/lib/emission-factors';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { FileSpreadsheet } from 'lucide-react';
import type { Scope1Entry } from './Scope1Form';
import type { Scope2Entry } from './Scope2Form';
import type { Scope3Entry } from './Scope3Form';
import type { Site } from './SiteManager';
import { DataQualitySummary } from './DataQualitySummary';
import { AnomalyDetection } from './AnomalyDetection';
import { AuditReportConfigDialog, type ReportConfig } from './AuditReportConfigDialog';
import { generateAuditReport } from './AuditReportGenerator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ResultsSummaryProps {
  scope1Entries: Scope1Entry[];
  scope2Entries: Scope2Entry[];
  scope3Entries: Scope3Entry[];
  sites?: Site[];
  scope1BySite?: Record<string, Scope1Entry[]>;
  scope2BySite?: Record<string, Scope2Entry[]>;
}

export const ResultsSummary = ({ scope1Entries, scope2Entries, scope3Entries, sites = [], scope1BySite = {}, scope2BySite = {} }: ResultsSummaryProps) => {
  const { user } = useAuth();
  const [showReportConfig, setShowReportConfig] = useState(false);

  const scope1Total = scope1Entries.reduce((s, e) => s + e.tco2e, 0);
  const scope2Total = scope2Entries.reduce((s, e) => s + e.tco2e, 0);
  const scope3Total = scope3Entries.reduce((s, e) => s + e.tco2e, 0);
  const grandTotal = scope1Total + scope2Total + scope3Total;

  if (grandTotal === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="py-12 text-center">
          <p className="text-4xl mb-3">🌍</p>
          <h3 className="text-lg font-semibold mb-1">Start Adding Emissions Data</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Use the Scope 1, 2, and 3 tabs above to enter your emissions data. 
            Results and insights will appear here as you add entries.
          </p>
        </CardContent>
      </Card>
    );
  }

  const scopeData = [
    { name: 'Scope 1', value: scope1Total, color: 'hsl(158, 100%, 41%)' },
    { name: 'Scope 2', value: scope2Total, color: 'hsl(199, 89%, 48%)' },
    { name: 'Scope 3', value: scope3Total, color: 'hsl(262, 83%, 58%)' },
  ].filter(d => d.value > 0);

  const equivalencies = getEquivalencies(grandTotal);

  const scope3ByCategory = SCOPE3_CATEGORIES
    .map(cat => ({
      name: cat.label.split('. ')[1],
      value: scope3Entries.filter(e => e.categoryCode === cat.code).reduce((s, e) => s + e.tco2e, 0),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const siteBreakdown = sites.length > 0 ? sites.map(site => {
    const s1 = (scope1BySite[site.id] || []).reduce((s, e) => s + e.tco2e, 0);
    const s2 = (scope2BySite[site.id] || []).reduce((s, e) => s + e.tco2e, 0);
    const s3 = scope3Entries.filter(e => e.siteId === site.id).reduce((s, e) => s + e.tco2e, 0);
    return { name: site.name, scope1: s1, scope2: s2, scope3: s3, total: s1 + s2 + s3 };
  }).filter(s => s.total > 0) : [];

  const globalScope3 = scope3Entries.filter(e => !e.siteId).reduce((s, e) => s + e.tco2e, 0);

  // Build data quality entries for the summary
  const allQualityEntries = [
    ...scope1Entries.map(e => ({ dataQuality: 'primary_metered', tco2e: e.tco2e })),
    ...scope2Entries.map(e => ({ dataQuality: 'primary_metered', tco2e: e.tco2e })),
    ...scope3Entries.map(e => ({ dataQuality: 'average_data', tco2e: e.tco2e })),
  ];

  // Build anomaly entries
  const anomalyEntries = [
    ...scope1Entries.map(e => ({ id: e.id, description: e.description || e.type, category: e.subCategory, scope: 1, tco2e: e.tco2e })),
    ...scope2Entries.map(e => ({ id: e.id, description: e.description || e.subCategory, category: e.subCategory, scope: 2, tco2e: e.tco2e })),
    ...scope3Entries.map(e => ({ id: e.id, description: e.description || e.type, category: e.categoryCode, scope: 3, tco2e: e.tco2e })),
  ];

  const handleGenerateReport = async (config: ReportConfig) => {
    let auditLogs: any[] = [];
    if (user) {
      const { data } = await supabase
        .from('carbon_audit_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      auditLogs = data || [];
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_name')
      .eq('user_id', user?.id || '')
      .maybeSingle();

    generateAuditReport({
      config,
      scope1Entries,
      scope2Entries,
      scope3Entries,
      sites,
      scope1BySite,
      scope2BySite,
      companyName: profileData?.company_name || 'Organisation',
      auditLogs,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Results & Insights</h3>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowReportConfig(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Generate Audit Report
          </Button>
          <div className="text-right">
            <p className="text-3xl font-bold">{grandTotal.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Total tCO₂e</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Scope 1 — Direct</p>
            <p className="text-2xl font-bold text-primary">{scope1Total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{grandTotal > 0 ? ((scope1Total / grandTotal) * 100).toFixed(1) : 0}% of total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Scope 2 — Energy</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(199, 89%, 48%)' }}>{scope2Total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{grandTotal > 0 ? ((scope2Total / grandTotal) * 100).toFixed(1) : 0}% of total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Scope 3 — Value Chain</p>
            <p className="text-2xl font-bold" style={{ color: 'hsl(262, 83%, 58%)' }}>{scope3Total.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{grandTotal > 0 ? ((scope3Total / grandTotal) * 100).toFixed(1) : 0}% of total</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Assessment */}
      <DataQualitySummary entries={allQualityEntries} />

      {/* Anomaly Detection */}
      <AnomalyDetection entries={anomalyEntries} />

      {/* Site Breakdown */}
      {(siteBreakdown.length > 0 || globalScope3 > 0) && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Emissions by Site / Business Unit</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {siteBreakdown.map(site => (
                <div key={site.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{site.name}</p>
                    <p className="text-xs text-muted-foreground">
                      S1: {site.scope1.toFixed(2)} · S2: {site.scope2.toFixed(2)} · S3: {site.scope3.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{site.total.toFixed(2)} tCO₂e</p>
                </div>
              ))}
              {globalScope3 > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border-dashed border">
                  <div>
                    <p className="text-sm font-medium">🌐 Global (Scope 3)</p>
                    <p className="text-xs text-muted-foreground">Organization-level Scope 3 entries not assigned to a site</p>
                  </div>
                  <p className="text-sm font-semibold">{globalScope3.toFixed(2)} tCO₂e</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Emissions by Scope</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={scopeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {scopeData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} tCO₂e`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {siteBreakdown.length > 1 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Site Comparison</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={siteBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={v => `${v.toFixed(1)}`} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(3)} tCO₂e`} />
                    <Legend />
                    <Bar dataKey="scope1" stackId="a" fill="hsl(158, 100%, 41%)" name="Scope 1" />
                    <Bar dataKey="scope2" stackId="a" fill="hsl(199, 89%, 48%)" name="Scope 2" />
                    <Bar dataKey="scope3" stackId="a" fill="hsl(262, 83%, 58%)" name="Scope 3" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {scope3ByCategory.length > 0 && siteBreakdown.length <= 1 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Scope 3 by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scope3ByCategory} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" tickFormatter={v => `${v.toFixed(1)}`} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(3)} tCO₂e`} />
                    <Bar dataKey="value" fill="hsl(262, 83%, 58%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Equivalencies */}
      <Card>
        <CardHeader><CardTitle className="text-sm">What does {grandTotal.toFixed(1)} tCO₂e look like?</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {equivalencies.filter(eq => eq.value > 0).map(eq => (
              <div key={eq.label} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl mb-1">{eq.icon}</p>
                <p className="text-xl font-bold">{eq.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{eq.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {scope3Total > scope1Total + scope2Total && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>💡 Your Scope 3 is {((scope3Total / grandTotal) * 100).toFixed(0)}% of total emissions</strong> — that's typical for most industries. 
              Focus on engaging your supply chain and optimising business travel for the biggest impact.
            </p>
          </CardContent>
        </Card>
      )}

      <AuditReportConfigDialog
        open={showReportConfig}
        onOpenChange={setShowReportConfig}
        onGenerate={handleGenerateReport}
      />
    </div>
  );
};

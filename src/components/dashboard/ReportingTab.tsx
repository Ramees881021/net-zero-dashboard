import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  FileText, 
  Download, 
  Share2, 
  CalendarIcon, 
  AlertTriangle, 
  CheckCircle2,
  Clock,
  XCircle,
  FileWarning,
  Loader2
} from 'lucide-react';
import { format, subYears, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Framework = 'CSRD' | 'SEC' | 'GHG' | 'TCFD' | 'GRI' | 'SASB';

interface ComplianceItem {
  id: string;
  name: string;
  status: 'compliant' | 'partial' | 'non-compliant';
  description: string;
}

interface ReportHistoryItem {
  id: string;
  name: string;
  framework: Framework;
  generatedAt: Date;
  dateRange: { from: Date; to: Date };
}

interface DataGap {
  id: string;
  field: string;
  year: number;
  severity: 'high' | 'medium' | 'low';
}

interface Deadline {
  id: string;
  framework: Framework;
  name: string;
  date: Date;
  daysRemaining: number;
}

const frameworks: { value: Framework; label: string; description: string }[] = [
  { value: 'CSRD', label: 'CSRD', description: 'Corporate Sustainability Reporting Directive' },
  { value: 'SEC', label: 'SEC Climate', description: 'SEC Climate Disclosure Rules' },
  { value: 'GHG', label: 'GHG Protocol', description: 'Greenhouse Gas Protocol' },
  { value: 'TCFD', label: 'TCFD', description: 'Task Force on Climate-related Financial Disclosures' },
  { value: 'GRI', label: 'GRI', description: 'Global Reporting Initiative' },
  { value: 'SASB', label: 'SASB', description: 'Sustainability Accounting Standards Board' },
];

const StatusIndicator = ({ status }: { status: 'compliant' | 'partial' | 'non-compliant' }) => {
  const config = {
    'compliant': { colorClass: 'bg-success', textClass: 'text-success', icon: CheckCircle2, label: 'Compliant' },
    'partial': { colorClass: 'bg-warning', textClass: 'text-warning', icon: Clock, label: 'Partial' },
    'non-compliant': { colorClass: 'bg-destructive', textClass: 'text-destructive', icon: XCircle, label: 'Non-Compliant' },
  };
  const { colorClass, textClass, icon: Icon, label } = config[status];
  
  return (
    <div className="flex items-center gap-2">
      <div className={cn("w-3 h-3 rounded-full", colorClass)} />
      <Icon className={cn("h-4 w-4", textClass)} />
      <span className="text-sm">{label}</span>
    </div>
  );
};

export const ReportingTab = () => {
  const { user } = useAuth();
  const { selectedYear, currencySymbol } = useDashboard();
  const [selectedFramework, setSelectedFramework] = useState<Framework>('GHG');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfYear(new Date(selectedYear, 0, 1)),
    to: endOfYear(new Date(selectedYear, 0, 1)),
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);

  // Fetch emissions data
  const { data: emissionsData, isLoading: loadingEmissions } = useQuery({
    queryKey: ['emissions-all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emissions_data')
        .select('*')
        .eq('user_id', user?.id)
        .order('reporting_year', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch credentials for compliance status
  const { data: credentials } = useQuery({
    queryKey: ['credentials', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sustainability_credentials')
        .select('*')
        .eq('user_id', user?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate compliance status based on existing data
  const complianceItems = useMemo((): ComplianceItem[] => {
    const yearData = emissionsData?.find(d => d.reporting_year === selectedYear);
    const hasSBTi = credentials?.some(c => c.credential_type === 'SBTi' && c.status === 'active');
    const hasCDP = credentials?.some(c => c.credential_type === 'CDP' && c.status === 'active');
    
    const items: ComplianceItem[] = [];
    
    if (selectedFramework === 'GHG' || selectedFramework === 'CSRD') {
      items.push({
        id: 'scope1',
        name: 'Scope 1 Emissions',
        status: yearData?.scope_1_emissions ? 'compliant' : 'non-compliant',
        description: 'Direct emissions from owned or controlled sources',
      });
      items.push({
        id: 'scope2',
        name: 'Scope 2 Emissions',
        status: yearData?.scope_2_emissions ? 'compliant' : 'non-compliant',
        description: 'Indirect emissions from purchased energy',
      });
      items.push({
        id: 'scope3',
        name: 'Scope 3 Emissions',
        status: yearData?.scope_3_emissions ? 'compliant' : yearData?.scope_1_emissions ? 'partial' : 'non-compliant',
        description: 'All other indirect emissions in the value chain',
      });
    }
    
    if (selectedFramework === 'TCFD' || selectedFramework === 'SEC') {
      items.push({
        id: 'governance',
        name: 'Climate Governance',
        status: hasSBTi ? 'compliant' : 'partial',
        description: 'Board oversight of climate-related risks',
      });
      items.push({
        id: 'strategy',
        name: 'Climate Strategy',
        status: hasSBTi && yearData ? 'compliant' : yearData ? 'partial' : 'non-compliant',
        description: 'Climate-related risks and opportunities',
      });
      items.push({
        id: 'risk',
        name: 'Risk Management',
        status: hasCDP ? 'compliant' : 'partial',
        description: 'Processes for identifying climate risks',
      });
      items.push({
        id: 'metrics',
        name: 'Metrics & Targets',
        status: yearData?.scope_1_emissions && yearData?.scope_2_emissions ? 'compliant' : 'non-compliant',
        description: 'Metrics used to assess climate-related performance',
      });
    }
    
    if (selectedFramework === 'GRI' || selectedFramework === 'SASB') {
      items.push({
        id: 'energy',
        name: 'Energy Consumption',
        status: yearData?.scope_2_emissions ? 'compliant' : 'non-compliant',
        description: 'Total energy consumption within the organization',
      });
      items.push({
        id: 'emissions',
        name: 'GHG Emissions',
        status: yearData?.scope_1_emissions && yearData?.scope_2_emissions ? 'compliant' : 'partial',
        description: 'Gross direct and indirect emissions',
      });
      items.push({
        id: 'intensity',
        name: 'Emissions Intensity',
        status: yearData?.revenue && yearData?.scope_1_emissions ? 'compliant' : 'non-compliant',
        description: 'Emissions intensity ratio',
      });
    }
    
    return items;
  }, [selectedFramework, emissionsData, credentials, selectedYear]);

  // Calculate data gaps
  const dataGaps = useMemo((): DataGap[] => {
    const gaps: DataGap[] = [];
    const years = [selectedYear, selectedYear - 1, selectedYear - 2];
    
    years.forEach(year => {
      const yearData = emissionsData?.find(d => d.reporting_year === year);
      if (!yearData) {
        gaps.push({ id: `all-${year}`, field: 'All emissions data', year, severity: 'high' });
      } else {
        if (!yearData.scope_1_emissions) gaps.push({ id: `s1-${year}`, field: 'Scope 1 emissions', year, severity: 'high' });
        if (!yearData.scope_2_emissions) gaps.push({ id: `s2-${year}`, field: 'Scope 2 emissions', year, severity: 'high' });
        if (!yearData.scope_3_emissions) gaps.push({ id: `s3-${year}`, field: 'Scope 3 emissions', year, severity: 'medium' });
        if (!yearData.revenue) gaps.push({ id: `rev-${year}`, field: 'Revenue data', year, severity: 'medium' });
      }
    });
    
    return gaps.slice(0, 5);
  }, [emissionsData, selectedYear]);

  // Calculate upcoming deadlines
  const deadlines = useMemo((): Deadline[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const rawDeadlines: { id: string; framework: Framework; name: string; date: Date; daysRemaining: number }[] = [
      { id: '1', framework: 'CSRD' as Framework, name: 'CSRD Annual Report', date: new Date(currentYear + 1, 3, 30), daysRemaining: Math.ceil((new Date(currentYear + 1, 3, 30).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) },
      { id: '2', framework: 'SEC' as Framework, name: 'SEC Climate Filing', date: new Date(currentYear + 1, 2, 31), daysRemaining: Math.ceil((new Date(currentYear + 1, 2, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) },
      { id: '3', framework: 'GHG' as Framework, name: 'CDP Questionnaire', date: new Date(currentYear, 6, 31), daysRemaining: Math.ceil((new Date(currentYear, 6, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) },
    ];
    
    return rawDeadlines.filter(d => d.daysRemaining > 0).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, []);

  const generateReportContent = (report: ReportHistoryItem) => {
    const yearData = emissionsData?.find(d => d.reporting_year === selectedYear);
    const frameworkInfo = frameworks.find(f => f.value === report.framework);
    
    const lines = [
      `${frameworkInfo?.description || report.framework} Compliance Report`,
      `Generated: ${format(report.generatedAt, 'MMMM d, yyyy h:mm a')}`,
      `Reporting Period: ${format(report.dateRange.from, 'MMMM d, yyyy')} - ${format(report.dateRange.to, 'MMMM d, yyyy')}`,
      '',
      '=== EMISSIONS DATA ===',
      `Scope 1 Emissions: ${yearData?.scope_1_emissions?.toLocaleString() || 'N/A'} tCO2e`,
      `Scope 2 Emissions: ${yearData?.scope_2_emissions?.toLocaleString() || 'N/A'} tCO2e`,
      `Scope 3 Emissions: ${yearData?.scope_3_emissions?.toLocaleString() || 'N/A'} tCO2e`,
      `Total Emissions: ${yearData ? ((yearData.scope_1_emissions || 0) + (yearData.scope_2_emissions || 0) + (yearData.scope_3_emissions || 0)).toLocaleString() : 'N/A'} tCO2e`,
      `Revenue: ${currencySymbol}${yearData?.revenue?.toLocaleString() || 'N/A'}`,
      '',
      '=== COMPLIANCE STATUS ===',
      `Overall Compliance Score: ${overallCompliance}%`,
      '',
      ...complianceItems.map(item => `${item.name}: ${item.status.toUpperCase()} - ${item.description}`),
      '',
      '=== DATA GAPS ===',
      dataGaps.length === 0 ? 'All required data is complete' : dataGaps.map(gap => `- ${gap.field} (${gap.year}): ${gap.severity} severity`).join('\n'),
      '',
      `Report ID: ${report.id}`,
    ];
    
    return lines.join('\n');
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const newReport: ReportHistoryItem = {
      id: crypto.randomUUID(),
      name: `${selectedFramework} Report - ${format(dateRange.from, 'MMM yyyy')} to ${format(dateRange.to, 'MMM yyyy')}`,
      framework: selectedFramework,
      generatedAt: new Date(),
      dateRange: { ...dateRange },
    };
    
    setReportHistory(prev => [newReport, ...prev]);
    setIsGenerating(false);
    toast.success('Report generated successfully');
  };

  const handleDownload = (report: ReportHistoryItem) => {
    const content = generateReportContent(report);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.framework}_Report_${format(report.generatedAt, 'yyyy-MM-dd')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Report downloaded successfully');
  };

  const handleShare = async (report: ReportHistoryItem) => {
    const content = generateReportContent(report);
    const shareData = {
      title: report.name,
      text: `${report.framework} Compliance Report\n\nGenerated: ${format(report.generatedAt, 'MMMM d, yyyy')}\nCompliance Score: ${overallCompliance}%`,
    };
    
    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success('Report shared successfully');
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          await navigator.clipboard.writeText(content);
          toast.success('Report content copied to clipboard');
        }
      }
    } else {
      await navigator.clipboard.writeText(content);
      toast.success('Report content copied to clipboard');
    }
  };

  const overallCompliance = useMemo(() => {
    if (complianceItems.length === 0) return 0;
    const compliantCount = complianceItems.filter(i => i.status === 'compliant').length;
    const partialCount = complianceItems.filter(i => i.status === 'partial').length;
    return Math.round(((compliantCount + partialCount * 0.5) / complianceItems.length) * 100);
  }, [complianceItems]);

  if (loadingEmissions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reporting & Compliance</h1>
        <p className="text-muted-foreground">Generate reports and track compliance across frameworks</p>
      </div>

      {/* Framework Selector & Report Generation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Generate Report
            </CardTitle>
            <CardDescription>Select a framework and date range to generate a compliance report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Reporting Framework</Label>
                <Select value={selectedFramework} onValueChange={(v) => setSelectedFramework(v as Framework)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frameworks.map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{f.label}</span>
                          <span className="text-xs text-muted-foreground">{f.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Date Range</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.from, to: dateRange.to }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ from: range.from, to: range.to });
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <Button 
              onClick={handleGenerateReport} 
              className="w-full"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate {selectedFramework} Report
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Overall Compliance Score */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Score</CardTitle>
            <CardDescription>{selectedFramework} Framework</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-4">
              <div className={cn(
                "text-5xl font-bold",
                overallCompliance >= 80 ? "text-success" : overallCompliance >= 50 ? "text-warning" : "text-destructive"
              )}>
                {overallCompliance}%
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {overallCompliance >= 80 ? 'Excellent' : overallCompliance >= 50 ? 'Needs Attention' : 'Action Required'}
              </p>
              <div className="w-full mt-4 bg-muted rounded-full h-2">
                <div 
                  className={cn(
                    "h-2 rounded-full transition-all",
                    overallCompliance >= 80 ? "bg-success" : overallCompliance >= 50 ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${overallCompliance}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Status Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Status</CardTitle>
          <CardDescription>Detailed breakdown for {selectedFramework} requirements</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {complianceItems.map(item => (
              <Card key={item.id} className="bg-muted/30">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm">{item.name}</h4>
                    <StatusIndicator status={item.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Upcoming Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deadlines.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming deadlines</p>
            ) : (
              <div className="space-y-3">
                {deadlines.map(deadline => (
                  <div key={deadline.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{deadline.name}</p>
                      <p className="text-xs text-muted-foreground">{format(deadline.date, 'MMMM d, yyyy')}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      deadline.daysRemaining <= 30 ? "bg-destructive/20 text-destructive" :
                      deadline.daysRemaining <= 90 ? "bg-warning/20 text-warning" :
                      "bg-success/20 text-success"
                    )}>
                      {deadline.daysRemaining} days
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Gaps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-warning" />
              Data Gaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dataGaps.length === 0 ? (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm">All required data is complete</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dataGaps.map(gap => (
                  <div key={gap.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn(
                        "h-4 w-4",
                        gap.severity === 'high' ? 'text-destructive' : gap.severity === 'medium' ? 'text-warning' : 'text-primary'
                      )} />
                      <span className="text-sm">{gap.field}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{gap.year}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Report History */}
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reportHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No reports generated yet</p>
              <p className="text-sm">Generate your first report using the form above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-sm">Report Name</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Framework</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Date Range</th>
                    <th className="text-left py-3 px-4 font-medium text-sm">Generated</th>
                    <th className="text-right py-3 px-4 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reportHistory.map(report => (
                    <tr key={report.id} className="border-b hover:bg-muted/30">
                      <td className="py-3 px-4 text-sm">{report.name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded bg-primary/20 text-primary text-xs font-medium">
                          {report.framework}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {format(report.dateRange.from, 'MMM yyyy')} - {format(report.dateRange.to, 'MMM yyyy')}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {format(report.generatedAt, 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(report)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleShare(report)}>
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
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

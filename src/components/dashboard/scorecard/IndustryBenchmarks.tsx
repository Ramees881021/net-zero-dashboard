import { useDashboard } from '@/contexts/DashboardContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus, Building2, Award, Leaf, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

interface Benchmark {
  company_name: string;
  industry: string;
  avg_scope_1_intensity: number | null;
  avg_scope_2_intensity: number | null;
  avg_scope_3_intensity: number | null;
  avg_cdp_score: string | null;
  avg_ecovadis_score: number | null;
  sbti_adoption_rate: number | null;
  is_leader: boolean | null;
}

interface IndustryBenchmarksProps {
  benchmarks: Benchmark[];
  userIntensity: number;
  userCdpScore: string | null;
  userEcoVadisScore: number | null;
  userSbtiStatus: string | null;
  companyName: string;
}

const getCdpNumericValue = (score: string | null): number => {
  const scores: Record<string, number> = {
    'A': 100, 'A-': 90, 'B': 75, 'B-': 65, 'C': 50, 'C-': 40, 'D': 25, 'D-': 15, 'Not Rated': 0
  };
  return scores[score || ''] || 0;
};

const getSbtiNumericValue = (status: string | null): number => {
  const statuses: Record<string, number> = {
    'Targets Set': 100,
    'Near-term Targets': 80,
    'Long-term Targets': 60,
    'Committed': 40,
    'None': 0
  };
  return statuses[status || ''] || 0;
};

export const IndustryBenchmarks = ({ 
  benchmarks, 
  userIntensity, 
  userCdpScore,
  userEcoVadisScore,
  userSbtiStatus,
  companyName 
}: IndustryBenchmarksProps) => {
  const { currencySymbol } = useDashboard();

  // Group benchmarks by industry
  const industries = [...new Set(benchmarks.map(b => b.industry))].sort();

  // Get top performers across all industries
  const topPerformers = [...benchmarks]
    .map(b => ({
      ...b,
      totalIntensity: (b.avg_scope_1_intensity || 0) + (b.avg_scope_2_intensity || 0) + (b.avg_scope_3_intensity || 0)
    }))
    .sort((a, b) => a.totalIntensity - b.totalIntensity)
    .slice(0, 10);

  // Calculate average across all leaders
  const avgLeaderIntensity = benchmarks.reduce((sum, b) => 
    sum + (b.avg_scope_1_intensity || 0) + (b.avg_scope_2_intensity || 0) + (b.avg_scope_3_intensity || 0), 0
  ) / (benchmarks.length || 1);

  // Prepare chart data for intensity comparison
  const intensityChartData = [
    {
      name: companyName || 'Your Company',
      intensity: userIntensity,
      isUser: true
    },
    ...topPerformers.slice(0, 5).map(b => ({
      name: b.company_name,
      intensity: b.totalIntensity,
      isUser: false
    }))
  ].sort((a, b) => a.intensity - b.intensity);

  // ESG comparison data
  const esgChartData = [
    {
      name: companyName || 'Your Company',
      CDP: getCdpNumericValue(userCdpScore),
      EcoVadis: userEcoVadisScore || 0,
      SBTi: getSbtiNumericValue(userSbtiStatus),
      isUser: true
    },
    ...topPerformers.slice(0, 4).map(b => ({
      name: b.company_name,
      CDP: getCdpNumericValue(b.avg_cdp_score),
      EcoVadis: b.avg_ecovadis_score || 0,
      SBTi: b.sbti_adoption_rate || 0,
      isUser: false
    }))
  ];

  const ComparisonRow = ({ benchmark }: { benchmark: Benchmark }) => {
    const totalIntensity = (benchmark.avg_scope_1_intensity || 0) + 
                           (benchmark.avg_scope_2_intensity || 0) + 
                           (benchmark.avg_scope_3_intensity || 0);
    const difference = userIntensity - totalIntensity;
    const isLower = difference < 0;
    const percentDiff = totalIntensity > 0 ? (difference / totalIntensity * 100) : 0;

    return (
      <div className="flex items-center justify-between py-3 border-b last:border-0 hover:bg-muted/50 px-2 rounded transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="font-medium">{benchmark.company_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>{benchmark.industry}</span>
              {benchmark.avg_cdp_score && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  CDP: {benchmark.avg_cdp_score}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="font-semibold">{totalIntensity.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">tCO₂e/M{currencySymbol}</div>
          </div>
          <div className={`flex items-center gap-1 min-w-[100px] justify-end ${
            isLower ? 'text-green-600' : difference > 0 ? 'text-red-600' : 'text-muted-foreground'
          }`}>
            {isLower ? (
              <TrendingDown className="h-4 w-4" />
            ) : difference > 0 ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <Minus className="h-4 w-4" />
            )}
            <span className="font-medium">
              {Math.abs(percentDiff).toFixed(0)}% {isLower ? 'better' : difference > 0 ? 'higher' : 'same'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{userIntensity.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Your Intensity (tCO₂e/M{currencySymbol})</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{avgLeaderIntensity.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Leaders Average</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${userIntensity <= avgLeaderIntensity ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                <Leaf className={`h-6 w-6 ${userIntensity <= avgLeaderIntensity ? 'text-green-600' : 'text-orange-600'}`} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${userIntensity <= avgLeaderIntensity ? 'text-green-600' : 'text-orange-600'}`}>
                  {userIntensity <= avgLeaderIntensity ? 'Leader' : 'Gap to Close'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {userIntensity <= avgLeaderIntensity 
                    ? 'Below average intensity' 
                    : `${((userIntensity - avgLeaderIntensity) / avgLeaderIntensity * 100).toFixed(0)}% above leaders`
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intensity Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Carbon Intensity Comparison</CardTitle>
          <CardDescription>Your performance vs top sustainability leaders (lower is better)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={intensityChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" unit={` tCO₂e/M${currencySymbol}`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`${value.toFixed(2)} tCO₂e/M${currencySymbol}`, 'Intensity']}
                />
                <Bar dataKey="intensity" radius={[0, 4, 4, 0]}>
                  {intensityChartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isUser ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ESG Scores Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>ESG Performance Comparison</CardTitle>
          <CardDescription>CDP, EcoVadis, and SBTi adoption compared to leaders (higher is better)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={esgChartData} margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="CDP" fill="hsl(var(--chart-1))" name="CDP Score" />
                <Bar dataKey="EcoVadis" fill="hsl(var(--chart-2))" name="EcoVadis" />
                <Bar dataKey="SBTi" fill="hsl(var(--chart-3))" name="SBTi %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Industry Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark by Industry</CardTitle>
          <CardDescription>Compare against leaders in specific sectors</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={industries[0]} className="w-full">
            <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
              {industries.map(industry => (
                <TabsTrigger key={industry} value={industry} className="text-xs">
                  {industry}
                </TabsTrigger>
              ))}
            </TabsList>
            {industries.map(industry => (
              <TabsContent key={industry} value={industry}>
                <div className="divide-y">
                  {benchmarks
                    .filter(b => b.industry === industry)
                    .sort((a, b) => {
                      const aTotal = (a.avg_scope_1_intensity || 0) + (a.avg_scope_2_intensity || 0) + (a.avg_scope_3_intensity || 0);
                      const bTotal = (b.avg_scope_1_intensity || 0) + (b.avg_scope_2_intensity || 0) + (b.avg_scope_3_intensity || 0);
                      return aTotal - bTotal;
                    })
                    .map(benchmark => (
                      <ComparisonRow key={benchmark.company_name} benchmark={benchmark} />
                    ))
                  }
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

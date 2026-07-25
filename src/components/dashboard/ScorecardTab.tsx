import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Award, Download, TrendingUp, TrendingDown, Leaf, Globe, Trophy, Star, Sprout, Target, Flower2, BarChart3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { IndustryBenchmarks } from './scorecard/IndustryBenchmarks';

interface EmissionsData {
  scope_1_emissions: number | null;
  scope_2_emissions: number | null;
  scope_3_emissions: number | null;
  revenue: number | null;
  cdp_score: string | null;
  ecovadis_score: number | null;
  sbti_target_status: string | null;
}

interface Profile {
  company_name: string;
  industry: string | null;
}

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

const getGrade = (score: number): { grade: string; color: string } => {
  if (score >= 90) return { grade: 'A+', color: 'text-green-600' };
  if (score >= 80) return { grade: 'A', color: 'text-green-600' };
  if (score >= 70) return { grade: 'B', color: 'text-lime-600' };
  if (score >= 60) return { grade: 'C', color: 'text-yellow-600' };
  if (score >= 50) return { grade: 'D', color: 'text-orange-600' };
  return { grade: 'F', color: 'text-red-600' };
};

const getBadgeTier = (score: number) => {
  if (score >= 90) return { 
    name: 'Net-Zero Leader', 
    tier: 'Platinum', 
    bg: 'from-purple-500 to-indigo-600',
    icon: Globe,
    description: 'Leading the way to a carbon-neutral future'
  };
  if (score >= 80) return { 
    name: 'Carbon Pioneer', 
    tier: 'Gold', 
    bg: 'from-yellow-400 to-amber-500',
    icon: Trophy,
    description: 'Pioneering excellence in carbon management'
  };
  if (score >= 70) return { 
    name: 'Climate Trailblazer', 
    tier: 'Silver', 
    bg: 'from-gray-300 to-gray-400',
    icon: Star,
    description: 'Blazing trails in sustainability leadership'
  };
  if (score >= 60) return { 
    name: 'Green Innovator', 
    tier: 'Bronze', 
    bg: 'from-orange-400 to-amber-600',
    icon: Leaf,
    description: 'Innovating for a greener tomorrow'
  };
  if (score >= 50) return { 
    name: 'Climate Committed', 
    tier: 'Rising', 
    bg: 'from-emerald-400 to-teal-500',
    icon: Sprout,
    description: 'Committed to meaningful climate action'
  };
  if (score >= 40) return { 
    name: 'Transition Tracker', 
    tier: 'Emerging', 
    bg: 'from-sky-400 to-blue-500',
    icon: Target,
    description: 'Tracking progress on the sustainability journey'
  };
  return { 
    name: 'Climate Starter', 
    tier: 'Starter', 
    bg: 'from-slate-400 to-slate-500',
    icon: Flower2,
    description: 'Beginning the path to sustainability'
  };
};

export const ScorecardTab = () => {
  const { user } = useAuth();
  const { selectedYear, currencySymbol } = useDashboard();
  const [emissions, setEmissions] = useState<EmissionsData | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userIndustry, setUserIndustry] = useState<string | null>(null);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      const [emissionsRes, profileRes] = await Promise.all([
        supabase
          .from('emissions_data')
          .select('*')
          .eq('user_id', user.id)
          .eq('reporting_year', selectedYear)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('company_name, industry')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (emissionsRes.data) setEmissions(emissionsRes.data);
      if (profileRes.data) {
        setProfile(profileRes.data);
        setUserIndustry(profileRes.data.industry || null);
      }

      // Fetch benchmarks - filter by user's industry if available
      const benchmarkQuery = supabase
        .from('industry_benchmarks')
        .select('*')
        .eq('year', selectedYear)
        .eq('is_leader', true);
      
      if (profileRes.data?.industry) {
        benchmarkQuery.eq('industry', profileRes.data.industry);
      }
      
      const benchmarksRes = await benchmarkQuery;
      if (benchmarksRes.data) setBenchmarks(benchmarksRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user, selectedYear]);

  // Calculate scores
  const totalEmissions = (emissions?.scope_1_emissions || 0) + 
                         (emissions?.scope_2_emissions || 0) + 
                         (emissions?.scope_3_emissions || 0);
  
  const intensity = emissions?.revenue && emissions.revenue > 0
    ? totalEmissions / (emissions.revenue / 1000000)
    : 0;

  // Calculate average industry leader intensity for benchmark comparison
  const avgLeaderIntensity = benchmarks.length > 0
    ? benchmarks.reduce((sum, b) => 
        sum + (b.avg_scope_1_intensity || 0) + (b.avg_scope_2_intensity || 0) + (b.avg_scope_3_intensity || 0), 0
      ) / benchmarks.length
    : 0;

  // Scoring algorithm with industry benchmark comparison
  let score = 0;
  
  // Industry Benchmark Comparison (max 25 points) - comparing to top companies
  let benchmarkScore = 0;
  if (avgLeaderIntensity > 0 && intensity > 0) {
    const intensityRatio = intensity / avgLeaderIntensity;
    if (intensityRatio <= 0.5) benchmarkScore = 25; // 50%+ better than leaders
    else if (intensityRatio <= 0.75) benchmarkScore = 22; // 25-50% better
    else if (intensityRatio <= 1.0) benchmarkScore = 18; // At or better than average
    else if (intensityRatio <= 1.25) benchmarkScore = 14; // Up to 25% higher
    else if (intensityRatio <= 1.5) benchmarkScore = 10; // 25-50% higher
    else if (intensityRatio <= 2.0) benchmarkScore = 6; // 50-100% higher
    else benchmarkScore = 2; // More than 2x higher
  } else if (intensity === 0 && emissions?.revenue) {
    benchmarkScore = 25; // No emissions = perfect score
  }
  score += benchmarkScore;

  // Base score for having data (25 points)
  if (emissions) {
    score += 25;
  }
  
  // CDP score contribution (max 20 points)
  const cdpPoints: Record<string, number> = { 'A': 20, 'A-': 17, 'B': 14, 'B-': 11, 'C': 8, 'C-': 5, 'D': 2, 'D-': 0 };
  if (emissions?.cdp_score && cdpPoints[emissions.cdp_score]) {
    score += cdpPoints[emissions.cdp_score];
  }

  // EcoVadis contribution (max 15 points)
  if (emissions?.ecovadis_score) {
    score += (emissions.ecovadis_score / 100) * 15;
  }

  // SBTi contribution (max 15 points)
  const sbtiPoints: Record<string, number> = { 
    'Targets Set': 15, 
    'Near-term Targets': 12, 
    'Long-term Targets': 10, 
    'Committed': 5, 
    'None': 0 
  };
  if (emissions?.sbti_target_status && sbtiPoints[emissions.sbti_target_status]) {
    score += sbtiPoints[emissions.sbti_target_status];
  }

  score = Math.min(100, Math.max(0, score));
  
  // Calculate intensity comparison percentage
  const intensityVsLeaders = avgLeaderIntensity > 0 
    ? ((intensity - avgLeaderIntensity) / avgLeaderIntensity * 100)
    : 0;
  const { grade, color } = getGrade(score);
  const badge = getBadgeTier(score);

  const downloadBadge = async () => {
    if (!badgeRef.current) return;
    
    const canvas = await html2canvas(badgeRef.current, {
      backgroundColor: null,
      scale: 2,
    });
    
    const link = document.createElement('a');
    link.download = `${profile?.company_name || 'company'}-sustainability-badge-${selectedYear}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-48 bg-muted rounded-lg" />
    </div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Performance Scorecard</h1>
        <p className="text-muted-foreground">Your sustainability performance grade for {selectedYear}</p>
      </div>

      {/* Tabs for Score and Benchmarks */}
      <Tabs defaultValue="score" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="score" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Score & Badge
          </TabsTrigger>
          <TabsTrigger value="benchmarks" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Industry Benchmarks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="score" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Overall Score
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center py-8">
                <div className={`text-8xl font-bold ${color}`}>{grade}</div>
                <div className="text-2xl font-semibold mt-2">{score.toFixed(0)}/100</div>
                <div className="text-muted-foreground mt-1">{badge.name}</div>
                
                {/* Score Breakdown */}
                <div className="w-full mt-6 space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Industry Benchmark
                    </span>
                    <span className="font-medium">{benchmarkScore}/25</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span>Data Completeness</span>
                    <span className="font-medium">{emissions ? 25 : 0}/25</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span>CDP Score ({emissions?.cdp_score || 'N/A'})</span>
                    <span className="font-medium">{emissions?.cdp_score && cdpPoints[emissions.cdp_score] ? cdpPoints[emissions.cdp_score] : 0}/20</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span>EcoVadis ({emissions?.ecovadis_score || 'N/A'})</span>
                    <span className="font-medium">{emissions?.ecovadis_score ? ((emissions.ecovadis_score / 100) * 15).toFixed(1) : 0}/15</span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted/50 rounded">
                    <span>SBTi ({emissions?.sbti_target_status || 'None'})</span>
                    <span className="font-medium">{emissions?.sbti_target_status && sbtiPoints[emissions.sbti_target_status] ? sbtiPoints[emissions.sbti_target_status] : 0}/15</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Badge */}
            <Card>
              <CardHeader>
                <CardTitle>Sustainability Badge</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <div 
                  ref={badgeRef}
                  className={`w-56 h-56 rounded-full bg-gradient-to-br ${badge.bg} flex flex-col items-center justify-center text-white shadow-xl ring-4 ring-white/20`}
                >
                  <badge.icon className="h-14 w-14 mb-2 drop-shadow-lg" />
                  <div className="text-lg font-bold text-center px-4">{badge.name}</div>
                  <div className="text-sm font-medium opacity-90">{badge.tier}</div>
                  <div className="text-xs mt-1 opacity-80">{profile?.company_name}</div>
                  <div className="text-xs opacity-70">{selectedYear}</div>
                </div>
                <p className="text-sm text-muted-foreground text-center max-w-xs italic">
                  "{badge.description}"
                </p>
                <Button onClick={downloadBadge} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Badge
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Industry Benchmark Impact */}
          {benchmarks.length > 0 && (
            <Card className="mt-6 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Industry Benchmark Impact on Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Your Intensity</div>
                      <div className="text-2xl font-bold">{intensity.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">tCO₂e/M{currencySymbol}</div>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg text-center">
                      <div className="text-sm text-muted-foreground">Leaders Average</div>
                      <div className="text-2xl font-bold">{avgLeaderIntensity.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">tCO₂e/M{currencySymbol}</div>
                    </div>
                    <div className={`p-4 rounded-lg text-center ${intensityVsLeaders <= 0 ? 'bg-green-500/10' : 'bg-orange-500/10'}`}>
                      <div className="text-sm text-muted-foreground">Comparison</div>
                      <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${intensityVsLeaders <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {intensityVsLeaders <= 0 ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                        {Math.abs(intensityVsLeaders).toFixed(0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {intensityVsLeaders <= 0 ? 'below leaders' : 'above leaders'}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Your emission intensity compared to {benchmarks.length} industry leaders contributes <strong>{benchmarkScore} out of 25 points</strong> to your overall score. 
                    {intensityVsLeaders <= 0 
                      ? ` Your intensity is ${Math.abs(intensityVsLeaders).toFixed(0)}% lower than the industry leaders average.`
                      : ` Reducing your emissions intensity would improve your benchmark score.`
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Benchmark Summary */}
          {benchmarks.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Your carbon intensity ({intensity.toFixed(2)} tCO₂e/M{currencySymbol}) compared to top leaders:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {benchmarks.slice(0, 3).map((b) => {
                      const benchmarkIntensity = (b.avg_scope_1_intensity || 0) + 
                                                 (b.avg_scope_2_intensity || 0) + 
                                                 (b.avg_scope_3_intensity || 0);
                      const comparison = intensity - benchmarkIntensity;
                      const isLower = comparison < 0;

                      return (
                        <div key={b.company_name} className="p-4 border rounded-lg">
                          <div className="font-medium">{b.company_name}</div>
                          <div className="text-xs text-muted-foreground mb-1">{b.industry}</div>
                          <div className="text-sm text-muted-foreground">
                            {benchmarkIntensity.toFixed(2)} tCO₂e/M{currencySymbol}
                          </div>
                          <div className={`flex items-center gap-1 text-sm mt-2 ${isLower ? 'text-green-600' : 'text-red-600'}`}>
                            {isLower ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            {Math.abs(comparison).toFixed(2)} {isLower ? 'lower' : 'higher'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="benchmarks" className="mt-6">
          {benchmarks.length > 0 ? (
            <IndustryBenchmarks
              benchmarks={benchmarks}
              userIntensity={intensity}
              userCdpScore={emissions?.cdp_score || null}
              userEcoVadisScore={emissions?.ecovadis_score || null}
              userSbtiStatus={emissions?.sbti_target_status || null}
              companyName={profile?.company_name || 'Your Company'}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No benchmark data available for {selectedYear}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

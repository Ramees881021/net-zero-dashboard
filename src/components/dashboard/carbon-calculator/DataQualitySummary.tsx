import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DataQualityEntry {
  dataQuality: string;
  tco2e: number;
}

interface DataQualitySummaryProps {
  entries: DataQualityEntry[];
}

const QUALITY_TIERS = [
  { key: 'primary_metered', label: 'Primary Metered', score: 1, color: 'hsl(158, 100%, 41%)', badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  { key: 'supplier_specific', label: 'Supplier-Specific', score: 2, color: 'hsl(199, 89%, 48%)', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  { key: 'average_data', label: 'Average/Proxy Data', score: 3, color: 'hsl(45, 93%, 47%)', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { key: 'spend_based', label: 'Spend-Based', score: 4, color: 'hsl(25, 95%, 53%)', badge: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  { key: 'estimated', label: 'AI-Estimated', score: 5, color: 'hsl(0, 72%, 51%)', badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
];

// Map legacy/various data_quality values to our tier keys
const mapQualityToTier = (quality: string): string => {
  const q = quality?.toLowerCase() || '';
  if (q.includes('primary') || q.includes('meter') || q === 'site_actual') return 'primary_metered';
  if (q.includes('supplier')) return 'supplier_specific';
  if (q.includes('average') || q.includes('proxy') || q === 'global_actual') return 'average_data';
  if (q.includes('spend')) return 'spend_based';
  return 'estimated';
};

export const getQualityTier = (quality: string) => {
  const tierKey = mapQualityToTier(quality);
  return QUALITY_TIERS.find(t => t.key === tierKey) || QUALITY_TIERS[4];
};

export const DataQualityBadge = ({ quality }: { quality: string }) => {
  const tier = getQualityTier(quality);
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${tier.badge}`}>
      Q{tier.score}
    </Badge>
  );
};

export const DataQualitySummary = ({ entries }: DataQualitySummaryProps) => {
  if (entries.length === 0) return null;

  const totalEmissions = entries.reduce((s, e) => s + e.tco2e, 0);

  const tierBreakdown = QUALITY_TIERS.map(tier => {
    const tierEntries = entries.filter(e => mapQualityToTier(e.dataQuality) === tier.key);
    const tierTotal = tierEntries.reduce((s, e) => s + e.tco2e, 0);
    return {
      ...tier,
      count: tierEntries.length,
      tco2e: tierTotal,
      percentage: totalEmissions > 0 ? (tierTotal / totalEmissions) * 100 : 0,
    };
  }).filter(t => t.count > 0);

  // Weighted average score
  const weightedScore = totalEmissions > 0
    ? tierBreakdown.reduce((s, t) => s + t.score * t.tco2e, 0) / totalEmissions
    : 0;

  const pieData = tierBreakdown.map(t => ({ name: t.label, value: t.tco2e, color: t.color }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>📊 Data Quality Assessment</span>
          <Badge variant="outline" className="text-xs">
            Weighted Score: {weightedScore.toFixed(1)} / 5
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tier breakdown */}
          <div className="space-y-3">
            {tierBreakdown.map(tier => (
              <div key={tier.key} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tier.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Q{tier.score}: {tier.label}</span>
                    <span className="text-xs text-muted-foreground">{tier.count} entries</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${tier.percentage}%`, backgroundColor: tier.color }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">{tier.percentage.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {pieData.map(entry => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(2)} tCO₂e`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Quality guidance */}
        <div className="mt-4 p-3 rounded-lg bg-muted/30 border text-xs text-muted-foreground">
          <p><strong>ISO 14064 Guidance:</strong> Aim for Q1-Q2 (primary/supplier data) for your largest emission sources. 
          Q4-Q5 data should be improved over time through better measurement and supplier engagement.</p>
        </div>
      </CardContent>
    </Card>
  );
};

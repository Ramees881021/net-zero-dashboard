import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AnomalyEntry {
  id: string;
  description: string;
  category: string;
  scope: number;
  tco2e: number;
}

interface AnomalyDetectionProps {
  entries: AnomalyEntry[];
}

interface Anomaly {
  entryId: string;
  description: string;
  type: 'outlier' | 'spike';
  severity: 'warning' | 'critical';
  explanation: string;
}

const detectAnomalies = (entries: AnomalyEntry[]): Anomaly[] => {
  const anomalies: Anomaly[] = [];

  // Group by category
  const byCategory: Record<string, AnomalyEntry[]> = {};
  entries.forEach(e => {
    const key = `${e.scope}_${e.category}`;
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(e);
  });

  // Detect outliers within each category (>3x standard deviation)
  Object.entries(byCategory).forEach(([, catEntries]) => {
    if (catEntries.length < 3) return; // Need at least 3 entries for meaningful stats
    
    const values = catEntries.map(e => e.tco2e).filter(v => v > 0);
    if (values.length < 3) return;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return;

    catEntries.forEach(entry => {
      if (entry.tco2e <= 0) return;
      const zScore = Math.abs(entry.tco2e - mean) / stdDev;
      
      if (zScore > 3) {
        anomalies.push({
          entryId: entry.id,
          description: entry.description || entry.category,
          type: 'outlier',
          severity: zScore > 5 ? 'critical' : 'warning',
          explanation: `Value ${entry.tco2e.toFixed(2)} tCO₂e is ${zScore.toFixed(1)}σ from the category mean (${mean.toFixed(2)} tCO₂e). This may indicate a data entry error.`,
        });
      }
    });
  });

  // Detect very high single entries (>50% of total)
  const totalEmissions = entries.reduce((s, e) => s + e.tco2e, 0);
  if (entries.length > 5 && totalEmissions > 0) {
    entries.forEach(entry => {
      if (entry.tco2e > 0 && entry.tco2e / totalEmissions > 0.5) {
        anomalies.push({
          entryId: entry.id,
          description: entry.description || entry.category,
          type: 'spike',
          severity: 'warning',
          explanation: `This single entry accounts for ${((entry.tco2e / totalEmissions) * 100).toFixed(0)}% of total emissions (${entry.tco2e.toFixed(2)} of ${totalEmissions.toFixed(2)} tCO₂e). Verify this value is correct.`,
        });
      }
    });
  }

  return anomalies;
};

export const AnomalyDetection = ({ entries }: AnomalyDetectionProps) => {
  const anomalies = detectAnomalies(entries);

  if (anomalies.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <span className="text-lg">✅</span>
            <span>No anomalies detected. Data appears consistent across all categories.</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Anomaly Detection ({anomalies.length} issue{anomalies.length > 1 ? 's' : ''} found)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {anomalies.map((anomaly, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="shrink-0 mt-0.5">
                {anomaly.type === 'outlier' ? (
                  <AlertTriangle className={`h-4 w-4 ${anomaly.severity === 'critical' ? 'text-destructive' : 'text-amber-500'}`} />
                ) : (
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{anomaly.description}</span>
                  <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'outline'} className="text-[10px] h-4">
                    {anomaly.type === 'outlier' ? 'Statistical Outlier' : 'Concentration Risk'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{anomaly.explanation}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          💡 Review flagged entries before submission. Auditors will check for unexplained outliers.
        </p>
      </CardContent>
    </Card>
  );
};

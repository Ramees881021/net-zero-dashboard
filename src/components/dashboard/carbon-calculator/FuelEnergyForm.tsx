import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Flame, Plus, Info, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FUEL_TYPES, VEHICLE_TYPES, SPEND_FACTORS } from '@/lib/emission-factors';
import type { Scope1Entry } from './Scope1Form';
import type { Scope2Entry } from './Scope2Form';
import type { Scope3Entry } from '../carbon-calculator/Scope3Form';
import type { Site } from './SiteManager';

interface FuelEnergyFormProps {
  onAdd: (entry: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
  scope1BySite: Record<string, Scope1Entry[]>;
  scope2BySite: Record<string, Scope2Entry[]>;
}

interface FeedItem {
  source: 'scope1' | 'scope2';
  siteId: string;
  siteName: string;
  type: string;
  fuelLabel: string;
  quantity: number;
  unit: string;
  country: string;
  gridRegion: string;
  description: string;
  subCategory: string;
}

export const FuelEnergyForm = ({
  onAdd,
  onAddBatch,
  sites,
  entries,
  scope1BySite,
  scope2BySite,
}: FuelEnergyFormProps) => {
  const [calculating, setCalculating] = useState(false);
  const [method, setMethod] = useState<'activity' | 'spend'>('activity');

  // Spend-based state
  const [spend, setSpend] = useState('');
  const [spendDesc, setSpendDesc] = useState('');

  // Build feed items from Scope 1 & 2 data
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    // Scope 1: stationary + mobile combustion fuels
    Object.entries(scope1BySite).forEach(([siteId, s1Entries]) => {
      const site = sites.find(s => s.id === siteId);
      s1Entries.forEach(e => {
        if (e.subCategory === 'stationary' || e.subCategory === 'mobile') {
          const fuelInfo = e.subCategory === 'stationary'
            ? FUEL_TYPES[e.type as keyof typeof FUEL_TYPES]
            : VEHICLE_TYPES[e.type as keyof typeof VEHICLE_TYPES];
          items.push({
            source: 'scope1',
            siteId,
            siteName: site?.name || 'Unknown',
            type: e.type,
            fuelLabel: fuelInfo?.label || e.type,
            quantity: e.quantity,
            unit: fuelInfo?.unit || e.unit,
            country: site?.country || '',
            gridRegion: '',
            description: e.description || fuelInfo?.label || e.type,
            subCategory: e.subCategory,
          });
        }
      });
    });

    // Scope 2: electricity + heat/steam
    Object.entries(scope2BySite).forEach(([siteId, s2Entries]) => {
      const site = sites.find(s => s.id === siteId);
      s2Entries.forEach(e => {
        items.push({
          source: 'scope2',
          siteId,
          siteName: site?.name || 'Unknown',
          type: e.subCategory,
          fuelLabel: e.subCategory === 'electricity' ? 'Purchased Electricity' : 'Purchased Heat/Steam',
          quantity: e.quantity,
          unit: e.unit || 'kWh',
          country: site?.country || '',
          gridRegion: e.gridRegion || '',
          description: e.description || e.subCategory,
          subCategory: e.subCategory,
        });
      });
    });

    return items;
  }, [scope1BySite, scope2BySite, sites]);

  const hasExistingEntries = entries.length > 0;

  const handleCalculateWithAI = async () => {
    if (feedItems.length === 0) {
      toast.error('No Scope 1 or Scope 2 data to process. Add fuel/electricity entries first.');
      return;
    }

    setCalculating(true);

    try {
      const { data, error } = await supabase.functions.invoke('assign-wtt-factors', {
        body: {
          items: feedItems.map(fi => ({
            source: fi.source,
            type: fi.type,
            fuelLabel: fi.fuelLabel,
            quantity: fi.quantity,
            unit: fi.unit,
            country: fi.country,
            gridRegion: fi.gridRegion,
            description: fi.description,
          })),
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const results = data.results;
      const newEntries: Omit<Scope3Entry, 'id'>[] = [];

      feedItems.forEach((fi, i) => {
        const r = results[i];
        if (!r || r.total_tco2e === 0) return;

        // Create entry for WTT
        if (r.wtt_tco2e > 0) {
          newEntries.push({
            categoryCode: 'fuel_energy',
            type: `wtt_${fi.source}_${fi.type}`,
            quantity: fi.quantity,
            unit: fi.unit,
            tco2e: r.wtt_tco2e,
            description: `WTT: ${fi.fuelLabel} @ ${fi.siteName} (${r.wtt_source})`,
            siteId: fi.siteId,
          });
        }

        // Create entry for T&D (electricity only)
        if (r.td_tco2e > 0 && fi.source === 'scope2') {
          newEntries.push({
            categoryCode: 'fuel_energy',
            type: `td_${fi.type}`,
            quantity: fi.quantity,
            unit: fi.unit,
            tco2e: r.td_tco2e,
            description: `T&D Losses: ${fi.fuelLabel} @ ${fi.siteName} (${r.wtt_source})`,
            siteId: fi.siteId,
          });
        }
      });

      if (newEntries.length > 0) {
        onAddBatch(newEntries);
        toast.success(`Added ${newEntries.length} Category 3 entries from Scope 1/2 data`);
      } else {
        toast.info('No emissions calculated — check your Scope 1/2 entries.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate WTT/T&D factors. Please try again.');
    } finally {
      setCalculating(false);
    }
  };

  const spendFactor = SPEND_FACTORS.fuel_energy;

  const handleAddSpend = () => {
    if (!spend) return;
    const s = parseFloat(spend);
    onAdd({
      categoryCode: 'fuel_energy',
      type: 'spend_based',
      quantity: s,
      unit: '£k',
      tco2e: s * spendFactor.factor,
      description: spendDesc || 'Fuel & energy spend',
      siteId: null,
    });
    setSpend('');
    setSpendDesc('');
  };

  return (
    <div className="space-y-4">
      {/* Method toggle */}
      <div className="flex gap-2">
        <Button
          variant={method === 'activity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('activity')}
          className="gap-1"
        >
          <Flame className="h-4 w-4" /> Activity-Based (Primary)
        </Button>
        <Button
          variant={method === 'spend' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('spend')}
          className="gap-1"
        >
          <ShoppingCart className="h-4 w-4" /> Spend-Based
        </Button>
      </div>

      {method === 'activity' && (
        <>
          {/* Info card */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="text-sm space-y-1">
                  <p className="font-medium">How Category 3 works</p>
                  <p className="text-muted-foreground">
                    This category captures upstream emissions from your Scope 1 fuels (Well-to-Tank)
                    and Scope 2 electricity (WTT + Transmission & Distribution losses). Your Scope 1/2 data
                    feeds in automatically — AI assigns the correct WTT and T&D factors.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feed preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Scope 1/2 Activity Data Feed
              </CardTitle>
              <CardDescription>
                {feedItems.length === 0
                  ? 'No Scope 1/2 data found. Add fuel or electricity entries in the Scope 1 and Scope 2 tabs first.'
                  : `${feedItems.length} items from your Scope 1/2 entries will be used for WTT & T&D calculations.`}
              </CardDescription>
            </CardHeader>
            {feedItems.length > 0 && (
              <CardContent className="space-y-3">
                {/* Group by source */}
                {(['scope1', 'scope2'] as const).map(source => {
                  const sourceItems = feedItems.filter(fi => fi.source === source);
                  if (sourceItems.length === 0) return null;
                  return (
                    <div key={source}>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                        {source === 'scope1' ? '🔥 Scope 1 Fuels → WTT' : '⚡ Scope 2 Electricity → WTT + T&D'}
                      </p>
                      <div className="space-y-1.5">
                        {sourceItems.map((fi, i) => (
                          <div
                            key={`${source}-${i}`}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border text-sm"
                          >
                            <div className="flex-1">
                              <span className="font-medium">{fi.fuelLabel}</span>
                              <span className="text-muted-foreground ml-2">
                                {fi.quantity.toLocaleString()} {fi.unit}
                              </span>
                              {fi.description && fi.description !== fi.fuelLabel && (
                                <span className="text-muted-foreground ml-1">— {fi.description}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{fi.siteName}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                {source === 'scope1' ? 'WTT' : 'WTT + T&D'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2">
                  <Button
                    onClick={handleCalculateWithAI}
                    disabled={calculating || feedItems.length === 0}
                    className="w-full gap-2"
                    size="lg"
                  >
                    {calculating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Calculating WTT & T&D factors with AI...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        {hasExistingEntries ? 'Recalculate' : 'Calculate'} Category 3 Emissions ({feedItems.length} items)
                      </>
                    )}
                  </Button>
                  {hasExistingEntries && (
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      ⚠️ New entries will be added alongside existing ones. Remove old entries first if recalculating.
                    </p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {method === 'spend' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" /> Spend-Based Estimation
            </CardTitle>
            <CardDescription>
              Use this if you don't have detailed Scope 1/2 activity data. Factor: {spendFactor.factor} tCO₂e/£k ({spendFactor.source})
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Total Spend (£/$ thousands)</Label>
              <Input type="number" value={spend} onChange={e => setSpend(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={spendDesc} onChange={e => setSpendDesc(e.target.value)} placeholder="e.g. Energy procurement costs" />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddSpend} disabled={!spend} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
            {spend && (
              <p className="col-span-full text-xs text-muted-foreground">
                = {(parseFloat(spend) * spendFactor.factor).toFixed(3)} tCO₂e · Factor: {spendFactor.factor} tCO₂e/£k · Source: {spendFactor.source}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

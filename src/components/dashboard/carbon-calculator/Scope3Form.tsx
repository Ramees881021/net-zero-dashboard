import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Plane, Users, ShoppingCart, Package, Globe, MapPin, Pencil, Check, X, ChevronLeft, ChevronRight, ArrowLeft, Hotel, Loader2, Download, Upload, FileSpreadsheet, Eraser } from 'lucide-react';
import * as XLSX from 'xlsx';
import { FLIGHT_FACTORS, COMMUTE_MODES, SPEND_FACTORS, SCOPE3_CATEGORIES, HOTEL_FACTORS } from '@/lib/emission-factors';
import { COUNTRIES } from '@/lib/country-emission-factors';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import type { Site } from './SiteManager';
import { PurchasedGoodsForm } from './PurchasedGoodsForm';
import { CapitalGoodsForm } from './CapitalGoodsForm';
import { FuelEnergyForm } from './FuelEnergyForm';
import { WasteForm } from './WasteForm';
import { ProcessingSoldForm } from './ProcessingSoldForm';
import { UseSoldForm } from './UseSoldForm';
import { EndOfLifeForm } from './EndOfLifeForm';
import { FranchisesForm } from './FranchisesForm';
import { InvestmentsForm } from './InvestmentsForm';
import { TransportForm } from './TransportForm';
import { UpstreamLeasedForm } from './UpstreamLeasedForm';
import type { Scope1Entry } from './Scope1Form';
import type { Scope2Entry } from './Scope2Form';

export interface Scope3Entry {
  id: string;
  categoryCode: string;
  type: string;
  quantity: number;
  unit: string;
  tco2e: number;
  description: string;
  siteId: string | null;
  emissionFactor?: number;
  emissionFactorSource?: string;
}

interface Scope3FormProps {
  entries: Scope3Entry[];
  onChange: (entries: Scope3Entry[]) => void;
  sites: Site[];
  scope1BySite?: Record<string, Scope1Entry[]>;
  scope2BySite?: Record<string, Scope2Entry[]>;
}

const genId = () => crypto.randomUUID();

export const Scope3Form = ({ entries, onChange, sites, scope1BySite = {}, scope2BySite = {} }: Scope3FormProps) => {
  const [activeCategory, setActiveCategoryState] = useState<string | null>(() => {
    return sessionStorage.getItem('scope3_activeCategory') || null;
  });
  const setActiveCategory = (cat: string | null) => {
    setActiveCategoryState(cat);
    if (cat) sessionStorage.setItem('scope3_activeCategory', cat);
    else sessionStorage.removeItem('scope3_activeCategory');
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Scope3Entry | null>(null);
  const totalScope3 = entries.reduce((sum, e) => sum + e.tco2e, 0);

  const addEntry = (entry: Omit<Scope3Entry, 'id'>) => {
    onChange([...entries, { ...entry, id: genId() }]);
  };

  const addEntriesBatch = (newEntries: Omit<Scope3Entry, 'id'>[]) => {
    const updated = [...entries, ...newEntries.map(e => ({ ...e, id: genId() }))];
    onChange(updated);
  };

  const removeEntry = (id: string) => onChange(entries.filter(e => e.id !== id));

  const startEdit = (entry: Scope3Entry) => { setEditingId(entry.id); setEditDraft({ ...entry }); };
  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const saveEdit = () => {
    if (!editDraft) return;
    let tco2e = editDraft.tco2e;
    const spendFactor = SPEND_FACTORS[editDraft.categoryCode as keyof typeof SPEND_FACTORS];
    const flightFactor = editDraft.type ? FLIGHT_FACTORS[editDraft.type as keyof typeof FLIGHT_FACTORS] : null;
    const commuteFactor = editDraft.type ? COMMUTE_MODES[editDraft.type as keyof typeof COMMUTE_MODES] : null;

    if (spendFactor && editDraft.type === 'spend_based') {
      tco2e = editDraft.quantity * spendFactor.factor;
    } else if (editDraft.categoryCode === 'business_travel' && flightFactor) {
      tco2e = editDraft.quantity * flightFactor.factor;
    } else if (editDraft.categoryCode === 'employee_commuting' && commuteFactor) {
      tco2e = editDraft.quantity * commuteFactor.factor;
    } else if (editDraft.unit === 'tCO₂e') {
      tco2e = editDraft.quantity;
    }

    onChange(entries.map(e => e.id === editDraft.id ? { ...editDraft, tco2e } : e));
    cancelEdit();
  };

  const dedicatedCategories = ['purchased_goods', 'capital_goods', 'fuel_energy', 'upstream_transport', 'waste', 'business_travel', 'employee_commuting', 'upstream_leased', 'downstream_transport', 'processing_sold', 'use_sold', 'end_of_life', 'downstream_leased', 'franchises', 'investments'];
  const spendCategories = ['purchased_goods', 'capital_goods', 'fuel_energy', 'upstream_transport', 'waste'];

  // Navigation helpers
  const currentIndex = activeCategory ? SCOPE3_CATEGORIES.findIndex(c => c.code === activeCategory) : -1;
  const prevCategory = currentIndex > 0 ? SCOPE3_CATEGORIES[currentIndex - 1] : null;
  const nextCategory = currentIndex < SCOPE3_CATEGORIES.length - 1 ? SCOPE3_CATEGORIES[currentIndex + 1] : null;

  // ── Landing page: show all categories as cards ──
  if (!activeCategory) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Scope 3: Value Chain Emissions</h3>
            <p className="text-sm text-muted-foreground">Indirect emissions — often 70%+ of total footprint. Select a category to add data.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold" style={{ color: 'hsl(262, 83%, 58%)' }}>{totalScope3.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">tCO₂e total</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCOPE3_CATEGORIES.map(c => {
            const catEntries = entries.filter(e => e.categoryCode === c.code);
            const catTotal = catEntries.reduce((s, e) => s + e.tco2e, 0);
            return (
              <button
                key={c.code}
                onClick={() => setActiveCategory(c.code)}
                className="text-left p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{c.label}</p>
                  {catEntries.length > 0 && (
                    <Badge variant="secondary" className="ml-2 shrink-0">{catEntries.length}</Badge>
                  )}
                </div>
                {catTotal > 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">{catTotal.toFixed(2)} tCO₂e</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">No entries yet</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Category detail page ──
  const activeCat = SCOPE3_CATEGORIES.find(c => c.code === activeCategory);
  const categoryEntries = entries.filter(e => e.categoryCode === activeCategory);

  return (
    <div className="space-y-4">
      {/* Header with back + prev/next navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setActiveCategory(null)} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> All Categories
          </Button>
          <h3 className="text-lg font-semibold">{activeCat?.label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {categoryEntries.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onChange(entries.filter(e => e.categoryCode !== activeCategory))}
            >
              <Eraser className="h-4 w-4" /> Clear Category
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!prevCategory}
            onClick={() => prevCategory && setActiveCategory(prevCategory.code)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline max-w-[120px] truncate">{prevCategory?.label.split('. ')[1]}</span>
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{currentIndex + 1} / {SCOPE3_CATEGORIES.length}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextCategory}
            onClick={() => nextCategory && setActiveCategory(nextCategory.code)}
            className="gap-1"
          >
            <span className="hidden sm:inline max-w-[120px] truncate">{nextCategory?.label.split('. ')[1]}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Category-specific form */}
      {activeCategory === 'purchased_goods' && <PurchasedGoodsForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'business_travel' && <TravelForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'employee_commuting' && <CommutingForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'capital_goods' && <CapitalGoodsForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'fuel_energy' && <FuelEnergyForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} scope1BySite={scope1BySite} scope2BySite={scope2BySite} />}
      {activeCategory === 'upstream_transport' && <TransportForm direction="upstream" categoryCode="upstream_transport" onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'waste' && <WasteForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'processing_sold' && <ProcessingSoldForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'use_sold' && <UseSoldForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'end_of_life' && <EndOfLifeForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'upstream_leased' && <UpstreamLeasedForm direction="upstream" onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'downstream_transport' && <TransportForm direction="downstream" categoryCode="downstream_transport" onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'downstream_leased' && <UpstreamLeasedForm direction="downstream" onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'franchises' && <FranchisesForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {activeCategory === 'investments' && <InvestmentsForm onAdd={addEntry} onAddBatch={addEntriesBatch} sites={sites} entries={categoryEntries} />}
      {spendCategories.includes(activeCategory) && activeCategory !== 'purchased_goods' && activeCategory !== 'capital_goods' && activeCategory !== 'fuel_energy' && activeCategory !== 'waste' && <SpendForm categoryCode={activeCategory} onAdd={addEntry} sites={sites} />}
      {!dedicatedCategories.includes(activeCategory) && (
        <SingleCategoryForm categoryCode={activeCategory} onAdd={addEntry} sites={sites} />
      )}

      {/* Entries for this category only */}
      {categoryEntries.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{activeCat?.label} Entries ({categoryEntries.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryEntries.map(e => {
                const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
                return (
                  <div key={e.id}>
                    {editingId === e.id && editDraft ? (
                      <div className="p-3 rounded-lg border-2 border-primary/30 bg-primary/5 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Quantity ({editDraft.unit})</Label>
                            <Input type="number" className="h-8" value={editDraft.quantity} onChange={ev => setEditDraft({ ...editDraft, quantity: parseFloat(ev.target.value) || 0 })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Description</Label>
                            <Input className="h-8" value={editDraft.description} onChange={ev => setEditDraft({ ...editDraft, description: ev.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Data Level</Label>
                            <Select value={editDraft.siteId ? 'site' : 'global'} onValueChange={v => setEditDraft({ ...editDraft, siteId: v === 'global' ? null : (sites[0]?.id || null) })}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="global">Global</SelectItem>
                                <SelectItem value="site">Site-level</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {editDraft.siteId && (
                            <div className="space-y-1">
                              <Label className="text-xs">Site</Label>
                              <Select value={editDraft.siteId} onValueChange={v => setEditDraft({ ...editDraft, siteId: v })}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex items-end gap-2">
                            <Button size="sm" onClick={saveEdit} className="gap-1"><Check className="h-3.5 w-3.5" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{e.description || e.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.quantity.toLocaleString()} {e.unit}
                            {site ? (
                              <span className="ml-1 inline-flex items-center gap-0.5"><MapPin className="h-3 w-3 inline" /> {site.name}</span>
                            ) : (
                              <span className="ml-1 inline-flex items-center gap-0.5"><Globe className="h-3 w-3 inline" /> Global</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{e.tco2e.toFixed(3)} tCO₂e</span>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(e)}>
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => removeEntry(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom prev/next navigation */}
      <div className="flex items-center justify-between pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          disabled={!prevCategory}
          onClick={() => prevCategory && setActiveCategory(prevCategory.code)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          {prevCategory?.label.split('. ')[1] || 'Previous'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!nextCategory}
          onClick={() => nextCategory && setActiveCategory(nextCategory.code)}
          className="gap-1"
        >
          {nextCategory?.label.split('. ')[1] || 'Next'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// Data mode selector: global vs site-level
const DataModeSelector = ({ mode, setMode, sites, selectedSiteId, setSelectedSiteId }: {
  mode: 'global' | 'site';
  setMode: (m: 'global' | 'site') => void;
  sites: Site[];
  selectedSiteId: string | null;
  setSelectedSiteId: (id: string | null) => void;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-2 rounded-lg bg-muted/30 border">
      <span className="text-xs text-muted-foreground">Data level:</span>
      <Button variant={mode === 'global' ? 'default' : 'outline'} size="sm" onClick={() => setMode('global')} className="gap-1">
        <Globe className="h-3.5 w-3.5" /> Global
      </Button>
      <Button variant={mode === 'site' ? 'default' : 'outline'} size="sm" onClick={() => setMode('site')} className="gap-1" disabled={sites.length === 0}>
        <MapPin className="h-3.5 w-3.5" /> Site-level
      </Button>
      {mode === 'site' && sites.length > 0 && (
        <Select value={selectedSiteId || ''} onValueChange={v => setSelectedSiteId(v)}>
          <SelectTrigger className="w-48 h-8">
            <SelectValue placeholder="Select site" />
          </SelectTrigger>
          <SelectContent>
            {sites.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}{s.country ? ` (${s.country})` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mode === 'site' && sites.length === 0 && (
        <span className="text-xs text-muted-foreground">Add sites in the Sites tab first</span>
      )}
    </div>
  );
};

// Spend-based form
const SpendForm = ({ categoryCode, onAdd, sites = [] }: { categoryCode: string; onAdd: (e: Omit<Scope3Entry, 'id'>) => void; sites: Site[] }) => {
  const [spend, setSpend] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const factor = SPEND_FACTORS[categoryCode as keyof typeof SPEND_FACTORS];
  const cat = SCOPE3_CATEGORIES.find(c => c.code === categoryCode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> {cat?.label}</CardTitle>
        <CardDescription>Spend-based estimation using EEIO factors</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Total Spend (£/$ thousands)</Label>
            <Input type="number" value={spend} onChange={e => setSpend(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. Office supplies" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => {
              if (spend && factor) {
                onAdd({
                  categoryCode, type: 'spend_based', quantity: parseFloat(spend), unit: '£k',
                  tco2e: parseFloat(spend) * factor.factor, description: desc,
                  siteId: mode === 'site' ? selectedSiteId : null,
                });
                setSpend(''); setDesc('');
              }
            }} disabled={!spend || (mode === 'site' && !selectedSiteId)} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
          {factor && spend && (
            <p className="col-span-full text-xs text-muted-foreground">
              = {(parseFloat(spend) * factor.factor).toFixed(3)} tCO₂e · Factor: {factor.factor} tCO₂e/£k · Source: {factor.source}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Business Travel form
const TravelForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: {
  onAdd: (e: Omit<Scope3Entry, 'id'>) => void;
  onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void;
  sites: Site[];
  entries: Scope3Entry[];
}) => {
  const [type, setType] = useState('');
  const [distance, setDistance] = useState('');
  const [trips, setTrips] = useState('1');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const flight = type ? FLIGHT_FACTORS[type as keyof typeof FLIGHT_FACTORS] : null;

  // Hotel state
  const [hotelNights, setHotelNights] = useState('');
  const [hotelCountry, setHotelCountry] = useState('');
  const [hotelDesc, setHotelDesc] = useState('');
  const [hotelLoading, setHotelLoading] = useState(false);
  const [hotelFactor, setHotelFactor] = useState<{ factor: number; source: string; reasoning: string } | null>(null);

  // Bulk import state
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);

  const selectedCountryName = hotelCountry ? COUNTRIES.find(c => c.code === hotelCountry)?.name || hotelCountry : '';

  const fetchHotelFactor = async () => {
    if (!hotelCountry || !hotelNights) return;
    setHotelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('assign-hotel-factor', {
        body: { country: selectedCountryName, roomNights: parseInt(hotelNights) },
      });
      if (error) throw error;
      if (data?.result) {
        setHotelFactor(data.result);
      }
    } catch (err: any) {
      console.error('Hotel factor error:', err);
      const isUk = hotelCountry === 'GB';
      const fallback = isUk ? HOTEL_FACTORS.uk : HOTEL_FACTORS.international;
      setHotelFactor({ factor: fallback.factor, source: fallback.source, reasoning: 'Fallback: AI unavailable, using DEFRA default' });
      toast.error('AI unavailable, using default DEFRA factor');
    } finally {
      setHotelLoading(false);
    }
  };

  const addHotelEntry = () => {
    if (!hotelNights || !hotelFactor) return;
    const nights = parseInt(hotelNights);
    const tco2e = nights * hotelFactor.factor;
    onAdd({
      categoryCode: 'business_travel',
      type: 'hotel_stay',
      quantity: nights,
      unit: 'room nights',
      tco2e,
      description: hotelDesc || `Hotel: ${selectedCountryName} (${nights} nights)`,
      siteId: mode === 'site' ? selectedSiteId : null,
    });
    setHotelNights(''); setHotelCountry(''); setHotelDesc(''); setHotelFactor(null);
  };

  // ── Bulk: Template ──
  const handleTemplate = () => {
    const wb = XLSX.utils.book_new();

    // Flights sheet
    const flightHeaders = ['Entry Type', 'Flight Type Key', 'Distance per Trip (km)', 'Number of Trips', 'Route/Notes', 'Site Name'];
    const flightExample = ['flight', 'long_haul_economy', '8000', '2', 'LHR→JFK', ''];
    const flightWs = XLSX.utils.aoa_to_sheet([flightHeaders, flightExample]);
    flightWs['!cols'] = flightHeaders.map(() => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(wb, flightWs, 'Flights');

    // Hotels sheet
    const hotelHeaders = ['Entry Type', 'Country Name', 'Room Nights', 'Emission Factor (tCO2e/night)', 'Description', 'Site Name'];
    const hotelExample = ['hotel', 'United Kingdom', '5', '0.01038', 'Conference stay', ''];
    const hotelWs = XLSX.utils.aoa_to_sheet([hotelHeaders, hotelExample]);
    hotelWs['!cols'] = hotelHeaders.map(() => ({ wch: 28 }));
    XLSX.utils.book_append_sheet(wb, hotelWs, 'Hotels');

    // Reference sheet
    const refData: string[][] = [['--- Flight Type Keys ---', 'Label']];
    Object.entries(FLIGHT_FACTORS).forEach(([k, v]) => refData.push([k, v.label]));
    refData.push([], ['--- Country Names (for Hotels) ---']);
    COUNTRIES.forEach(c => refData.push([c.name, c.code]));
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 35 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Reference');

    XLSX.writeFile(wb, 'business_travel_template.xlsx');
    toast.success('Template downloaded');
  };

  // ── Bulk: Import ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const parsed: Omit<Scope3Entry, 'id'>[] = [];

        // Parse Flights sheet
        const flightSheet = wb.Sheets['Flights'] || wb.Sheets[wb.SheetNames[0]];
        if (flightSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(flightSheet);
          rows.forEach((row: any) => {
            const entryType = String(row['Entry Type'] || '').toLowerCase().trim();
            if (entryType !== 'flight') return;
            const flightKey = String(row['Flight Type Key'] || '').trim();
            const distPerTrip = parseFloat(row['Distance per Trip (km)'] || 0);
            const numTrips = parseInt(row['Number of Trips'] || 1);
            const notes = String(row['Route/Notes'] || '');
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            const ff = FLIGHT_FACTORS[flightKey as keyof typeof FLIGHT_FACTORS];
            if (!ff || !distPerTrip) return;
            const totalDist = distPerTrip * numTrips * 2;
            parsed.push({
              categoryCode: 'business_travel', type: flightKey, quantity: totalDist, unit: 'km',
              tco2e: totalDist * ff.factor, description: notes,
              siteId: siteMatch?.id || null,
            });
          });
        }

        // Parse Hotels sheet
        const hotelSheet = wb.Sheets['Hotels'] || wb.Sheets[wb.SheetNames[1]];
        if (hotelSheet) {
          const rows = XLSX.utils.sheet_to_json<any>(hotelSheet);
          rows.forEach((row: any) => {
            const entryType = String(row['Entry Type'] || '').toLowerCase().trim();
            if (entryType !== 'hotel') return;
            const countryName = String(row['Country Name'] || '').trim();
            const roomNights = parseInt(row['Room Nights'] || 0);
            const ef = parseFloat(row['Emission Factor (tCO2e/night)'] || 0);
            const description = String(row['Description'] || '');
            const siteName = String(row['Site Name'] || '').trim();
            const siteMatch = siteName ? sites.find(s => s.name.toLowerCase() === siteName.toLowerCase()) : null;
            if (!roomNights || !ef) return;
            parsed.push({
              categoryCode: 'business_travel', type: 'hotel_stay', quantity: roomNights, unit: 'room nights',
              tco2e: roomNights * ef, description: description || `Hotel: ${countryName} (${roomNights} nights)`,
              siteId: siteMatch?.id || null,
            });
          });
        }

        if (parsed.length === 0) {
          toast.error('No valid rows found. Check the template format.');
          return;
        }
        setImportPreview(parsed);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Bulk: Export ──
  const handleExport = () => {
    if (entries.length === 0) { toast.info('No entries to export'); return; }
    const wb = XLSX.utils.book_new();

    const flightEntries = entries.filter(e => e.type !== 'hotel_stay');
    const hotelEntries = entries.filter(e => e.type === 'hotel_stay');

    if (flightEntries.length > 0 || hotelEntries.length === 0) {
      const flightRows = flightEntries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        const ff = FLIGHT_FACTORS[e.type as keyof typeof FLIGHT_FACTORS];
        return {
          'Entry Type': 'flight',
          'Flight Type Key': e.type,
          'Flight Type': ff?.label || e.type,
          'Total Distance (km)': e.quantity,
          'Route/Notes': e.description,
          'tCO2e': parseFloat(e.tco2e.toFixed(6)),
          'Site Name': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(flightRows);
      ws['!cols'] = Object.keys(flightRows[0] || {}).map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Flights');
    }

    if (hotelEntries.length > 0) {
      const hotelRows = hotelEntries.map(e => {
        const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
        return {
          'Entry Type': 'hotel',
          'Description': e.description,
          'Room Nights': e.quantity,
          'Emission Factor (tCO2e/night)': e.quantity > 0 ? parseFloat((e.tco2e / e.quantity).toFixed(6)) : 0,
          'tCO2e': parseFloat(e.tco2e.toFixed(6)),
          'Site Name': site?.name || 'Global',
        };
      });
      const ws = XLSX.utils.json_to_sheet(hotelRows);
      ws['!cols'] = Object.keys(hotelRows[0] || {}).map(() => ({ wch: 24 }));
      XLSX.utils.book_append_sheet(wb, ws, 'Hotels');
    }

    XLSX.writeFile(wb, 'business_travel_export.xlsx');
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <div className="space-y-4">
      {/* Bulk Operations Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/30 border">
        <span className="text-sm font-medium mr-2">Bulk Data:</span>
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
          <FileSpreadsheet className="h-4 w-4" /> Template
        </Button>
        <Button variant="outline" size="sm" className="gap-1" asChild>
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
          <Download className="h-4 w-4" /> Export ({entries.length})
        </Button>
      </div>

      {/* Import Preview Modal */}
      {importPreview && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Import Preview — {importPreview.length} entries</CardTitle>
            <CardDescription>Review before confirming</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {importPreview.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">{e.type === 'hotel_stay' ? '🏨' : '✈️'} {e.description || e.type}</span>
                    <span className="text-muted-foreground ml-2">{e.quantity.toLocaleString()} {e.unit}</span>
                  </div>
                  <span className="font-semibold">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { onAddBatch(importPreview); setImportPreview(null); toast.success(`Imported ${importPreview.length} entries`); }} className="gap-1">
                <Check className="h-4 w-4" /> Confirm Import
              </Button>
              <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Flights Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Plane className="h-4 w-4" /> Flights</CardTitle>
          <CardDescription>Flights, categorised by distance and class</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Flight Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FLIGHT_FACTORS).map(([key, f]) => (
                    <SelectItem key={key} value={key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Distance per trip (km)</Label>
              <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Number of trips</Label>
              <Input type="number" value={trips} onChange={e => setTrips(e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-2">
              <Label>Route/Notes</Label>
              <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="e.g. LHR→JFK" />
            </div>
            <div className="flex items-end">
              <Button onClick={() => {
                if (type && distance && flight) {
                  const totalDist = parseFloat(distance) * parseInt(trips || '1') * 2;
                  onAdd({
                    categoryCode: 'business_travel', type, quantity: totalDist, unit: 'km',
                    tco2e: totalDist * flight.factor, description: desc,
                    siteId: mode === 'site' ? selectedSiteId : null,
                  });
                  setDistance(''); setTrips('1'); setDesc('');
                }
              }} disabled={!type || !distance || (mode === 'site' && !selectedSiteId)} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Flight
              </Button>
            </div>
            {flight && distance && (
              <p className="col-span-full text-xs text-muted-foreground">
                {parseInt(trips || '1')} round trip(s) × {parseFloat(distance).toLocaleString()} km = {(parseFloat(distance) * parseInt(trips || '1') * 2).toLocaleString()} km total
                → {(parseFloat(distance) * parseInt(trips || '1') * 2 * flight.factor).toFixed(3)} tCO₂e
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hotel Stays Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Hotel className="h-4 w-4" /> Hotel Stays</CardTitle>
          <CardDescription>Accommodation emissions — AI assigns country-specific emission factors (DEFRA 2025 / HCMI)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Country of Stay</Label>
              <Select value={hotelCountry} onValueChange={v => { setHotelCountry(v); setHotelFactor(null); }}>
                <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total Room Nights</Label>
              <Input type="number" value={hotelNights} onChange={e => { setHotelNights(e.target.value); setHotelFactor(null); }} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={hotelDesc} onChange={e => setHotelDesc(e.target.value)} placeholder="e.g. Annual conference stays" />
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                onClick={fetchHotelFactor}
                disabled={!hotelCountry || !hotelNights || hotelLoading}
                className="gap-1"
              >
                {hotelLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '🤖'}
                {hotelLoading ? 'Calculating...' : 'Get Factor'}
              </Button>
              <Button
                onClick={addHotelEntry}
                disabled={!hotelFactor || !hotelNights}
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>
          {hotelFactor && hotelNights && (
            <div className="p-3 rounded-lg bg-muted/50 border space-y-1">
              <p className="text-sm font-medium">
                {parseInt(hotelNights)} nights × {hotelFactor.factor.toFixed(5)} tCO₂e/night = <span className="font-bold">{(parseInt(hotelNights) * hotelFactor.factor).toFixed(4)} tCO₂e</span>
              </p>
              <p className="text-xs text-muted-foreground">Source: {hotelFactor.source}</p>
              <p className="text-xs text-muted-foreground">Reasoning: {hotelFactor.reasoning}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Employee Commuting form
const CommutingForm = ({ onAdd, onAddBatch, sites = [], entries = [] }: { onAdd: (e: Omit<Scope3Entry, 'id'>) => void; onAddBatch: (entries: Omit<Scope3Entry, 'id'>[]) => void; sites: Site[]; entries: Scope3Entry[] }) => {
  const [commMode, setCommMode] = useState('');
  const [employees, setEmployees] = useState('');
  const [avgDistance, setAvgDistance] = useState('');
  const [workDays, setWorkDays] = useState('230');
  const [desc, setDesc] = useState('');
  const [dataMode, setDataMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const [importPreview, setImportPreview] = useState<Omit<Scope3Entry, 'id'>[] | null>(null);
  const commute = commMode ? COMMUTE_MODES[commMode as keyof typeof COMMUTE_MODES] : null;

  const MODE_KEY_MAP: Record<string, string> = {};
  const MODE_LABEL_MAP: Record<string, string> = {};
  Object.entries(COMMUTE_MODES).forEach(([key, m]) => {
    MODE_KEY_MAP[m.label.toLowerCase()] = key;
    MODE_LABEL_MAP[key] = m.label;
  });

  const handleTemplate = () => {
    const headers = ['Transport Mode', 'Employees', 'Avg One-Way Distance (km)', 'Work Days/Year', 'Site Name (optional)', 'Description'];
    const example = ['Car (alone)', '50', '15', '230', '', 'Office staff commuting'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    const refData = [['Valid Transport Modes'], ...Object.values(COMMUTE_MODES).map(m => [m.label])];
    const wsRef = XLSX.utils.aoa_to_sheet(refData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commuting');
    XLSX.utils.book_append_sheet(wb, wsRef, 'Reference');
    XLSX.writeFile(wb, 'employee_commuting_template.xlsx');
    toast.success('Template downloaded');
  };

  const handleImport = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        const dataRows = rows.slice(1).filter(r => r.length >= 3 && r[0]);
        const parsed: Omit<Scope3Entry, 'id'>[] = [];
        for (const row of dataRows) {
          const modeLabel = String(row[0] || '').trim();
          const modeKey = MODE_KEY_MAP[modeLabel.toLowerCase()];
          if (!modeKey) continue;
          const factor = COMMUTE_MODES[modeKey as keyof typeof COMMUTE_MODES];
          const emps = parseInt(String(row[1] || '0'));
          const dist = parseFloat(String(row[2] || '0'));
          const days = parseInt(String(row[3] || '230'));
          const siteName = String(row[4] || '').trim();
          const description = String(row[5] || `${emps} employees · ${modeLabel}`).trim();
          const totalKm = emps * dist * 2 * days;
          const siteId = siteName ? (sites.find(s => s.name.toLowerCase() === siteName.toLowerCase())?.id || null) : null;
          parsed.push({
            categoryCode: 'employee_commuting', type: modeKey, quantity: totalKm, unit: 'km',
            tco2e: totalKm * factor.factor, description, siteId,
          });
        }
        if (parsed.length === 0) { toast.error('No valid rows found'); return; }
        setImportPreview(parsed);
      } catch { toast.error('Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    ev.target.value = '';
  };

  const handleExport = () => {
    const headers = ['Transport Mode', 'Employees', 'Avg Distance (km)', 'Work Days', 'Site', 'Description', 'Total km', 'Unit', 'Factor (tCO₂e/km)', 'tCO₂e'];
    const rows = entries.map(e => {
      const modeLabel = MODE_LABEL_MAP[e.type] || e.type;
      const factor = COMMUTE_MODES[e.type as keyof typeof COMMUTE_MODES];
      const site = e.siteId ? sites.find(s => s.id === e.siteId) : null;
      return [modeLabel, '', '', '', site?.name || '', e.description, e.quantity, 'km', factor?.factor || '', e.tco2e.toFixed(4)];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Commuting');
    XLSX.writeFile(wb, 'employee_commuting_export.xlsx');
    toast.success(`Exported ${entries.length} entries`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleTemplate} className="gap-1">
          <FileSpreadsheet className="h-4 w-4" /> Template
        </Button>
        <Button variant="outline" size="sm" className="gap-1" asChild>
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" /> Import
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          </label>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={entries.length === 0} className="gap-1">
          <Download className="h-4 w-4" /> Export ({entries.length})
        </Button>
      </div>

      {importPreview && (
        <Card className="border-2 border-primary/30">
          <CardHeader>
            <CardTitle className="text-sm">Import Preview — {importPreview.length} entries</CardTitle>
            <CardDescription>Review before confirming</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-64 overflow-y-auto space-y-1">
              {importPreview.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">🚗 {e.description || e.type}</span>
                    <span className="text-muted-foreground ml-2">{e.quantity.toLocaleString()} {e.unit}</span>
                  </div>
                  <span className="font-semibold">{e.tco2e.toFixed(4)} tCO₂e</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { onAddBatch(importPreview); setImportPreview(null); toast.success(`Imported ${importPreview.length} entries`); }} className="gap-1">
                <Check className="h-4 w-4" /> Confirm Import
              </Button>
              <Button variant="outline" onClick={() => setImportPreview(null)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Employee Commuting</CardTitle>
          <CardDescription>By transport mode, distance, and employee count</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DataModeSelector mode={dataMode} setMode={setDataMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label>Mode of Transport</Label>
              <Select value={commMode} onValueChange={setCommMode}>
                <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(COMMUTE_MODES).map(([key, m]) => (
                    <SelectItem key={key} value={key}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employees</Label>
              <Input type="number" value={employees} onChange={e => setEmployees(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Avg one-way (km)</Label>
              <Input type="number" value={avgDistance} onChange={e => setAvgDistance(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Work days/year</Label>
              <Input type="number" value={workDays} onChange={e => setWorkDays(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={() => {
                if (commMode && employees && avgDistance && commute) {
                  const totalKm = parseInt(employees) * parseFloat(avgDistance) * 2 * parseInt(workDays);
                  onAdd({
                    categoryCode: 'employee_commuting', type: commMode, quantity: totalKm, unit: 'km',
                    tco2e: totalKm * commute.factor,
                    description: desc || `${employees} employees · ${commMode}`,
                    siteId: dataMode === 'site' ? selectedSiteId : null,
                  });
                  setEmployees(''); setAvgDistance(''); setDesc('');
                }
              }} disabled={!commMode || !employees || !avgDistance || (dataMode === 'site' && !selectedSiteId)} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
            {commute && employees && avgDistance && (
              <p className="col-span-full text-xs text-muted-foreground">
                {employees} employees × {avgDistance} km × 2 (round trip) × {workDays} days
                = {(parseInt(employees) * parseFloat(avgDistance) * 2 * parseInt(workDays)).toLocaleString()} km/year
                → {(parseInt(employees) * parseFloat(avgDistance) * 2 * parseInt(workDays) * commute.factor).toFixed(3)} tCO₂e
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Single category direct-entry form (for categories 8-15 without spend factors)
const SingleCategoryForm = ({ categoryCode, onAdd, sites = [] }: { categoryCode: string; onAdd: (e: Omit<Scope3Entry, 'id'>) => void; sites: Site[] }) => {
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [mode, setMode] = useState<'global' | 'site'>('global');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(sites.length > 0 ? sites[0].id : null);
  const cat = SCOPE3_CATEGORIES.find(c => c.code === categoryCode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> {cat?.label}</CardTitle>
        <CardDescription>{cat?.description || 'Enter calculated tCO₂e directly'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DataModeSelector mode={mode} setMode={setMode} sites={sites} selectedSiteId={selectedSiteId} setSelectedSiteId={setSelectedSiteId} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Emissions (tCO₂e)</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Notes" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => {
              if (amount) {
                onAdd({
                  categoryCode, type: 'direct', quantity: parseFloat(amount), unit: 'tCO₂e',
                  tco2e: parseFloat(amount), description: desc,
                  siteId: mode === 'site' ? selectedSiteId : null,
                });
                setAmount(''); setDesc('');
              }
            }} disabled={!amount || (mode === 'site' && !selectedSiteId)} className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

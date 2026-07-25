// EPA & DEFRA emission factors (tCO2e per unit)
// Sources: EPA GHG Emission Factors Hub 2024, DEFRA 2025 (published June 2025)
// Last updated: 2025-06-10 (DEFRA 2025 release)

export const FUEL_TYPES = {
  natural_gas: { label: 'Natural Gas', unit: 'kWh', factor: 0.000183, source: 'DEFRA 2025' },
  diesel: { label: 'Diesel', unit: 'litres', factor: 0.002557, source: 'DEFRA 2025' },
  petrol: { label: 'Petrol/Gasoline', unit: 'litres', factor: 0.002168, source: 'DEFRA 2025' },
  coal: { label: 'Coal', unit: 'tonnes', factor: 2.8834, source: 'EPA 2024' },
  propane: { label: 'Propane/LPG', unit: 'litres', factor: 0.001523, source: 'DEFRA 2025' },
  fuel_oil: { label: 'Fuel Oil', unit: 'litres', factor: 0.002540, source: 'DEFRA 2025' },
  biodiesel: { label: 'Biodiesel (100%)', unit: 'litres', factor: 0.000170, source: 'DEFRA 2025' },
  bioethanol: { label: 'Bioethanol (100%)', unit: 'litres', factor: 0.000020, source: 'DEFRA 2025' },
  cng: { label: 'Compressed Natural Gas', unit: 'kg', factor: 0.002535, source: 'DEFRA 2025' },
  lng: { label: 'Liquefied Natural Gas', unit: 'litres', factor: 0.001158, source: 'DEFRA 2025' },
  wood_pellets: { label: 'Wood Pellets', unit: 'tonnes', factor: 0.07220, source: 'DEFRA 2025' },
  wood_chips: { label: 'Wood Chips', unit: 'tonnes', factor: 0.05730, source: 'DEFRA 2025' },
} as const;

export const VEHICLE_TYPES = {
  petrol_car: { label: 'Petrol Car (avg)', unit: 'km', factor: 0.000174, source: 'DEFRA 2025' },
  diesel_car: { label: 'Diesel Car (avg)', unit: 'km', factor: 0.000171, source: 'DEFRA 2025' },
  hybrid_car: { label: 'Hybrid Car', unit: 'km', factor: 0.000118, source: 'DEFRA 2025' },
  phev_car: { label: 'Plug-in Hybrid (PHEV)', unit: 'km', factor: 0.000071, source: 'DEFRA 2025' },
  electric_car: { label: 'Battery Electric (BEV)', unit: 'km', factor: 0.000038, source: 'DEFRA 2025' },
  van_diesel: { label: 'Diesel Van', unit: 'km', factor: 0.000248, source: 'DEFRA 2025' },
  van_petrol: { label: 'Petrol Van', unit: 'km', factor: 0.000213, source: 'DEFRA 2025' },
  van_electric: { label: 'Electric Van', unit: 'km', factor: 0.000048, source: 'DEFRA 2025' },
  hgv_rigid: { label: 'HGV Rigid (avg)', unit: 'km', factor: 0.000840, source: 'DEFRA 2025' },
  hgv_artic: { label: 'HGV Articulated (avg)', unit: 'km', factor: 0.000950, source: 'DEFRA 2025' },
  hgv: { label: 'HGV/Truck (all avg)', unit: 'km', factor: 0.000900, source: 'DEFRA 2025' },
  motorcycle: { label: 'Motorcycle', unit: 'km', factor: 0.000114, source: 'DEFRA 2025' },
  bus: { label: 'Local Bus', unit: 'passenger.km', factor: 0.000102, source: 'DEFRA 2025' },
  coach: { label: 'Coach', unit: 'passenger.km', factor: 0.000027, source: 'DEFRA 2025' },
  rail_national: { label: 'National Rail', unit: 'passenger.km', factor: 0.000035, source: 'DEFRA 2025' },
  rail_light: { label: 'Light Rail / Tram', unit: 'passenger.km', factor: 0.000029, source: 'DEFRA 2025' },
  taxi: { label: 'Taxi (regular)', unit: 'km', factor: 0.000149, source: 'DEFRA 2025' },
} as const;

export const REFRIGERANT_TYPES = {
  r134a: { label: 'R-134a (HFC)', gwp: 1430 },
  r410a: { label: 'R-410A', gwp: 2088 },
  r407c: { label: 'R-407C', gwp: 1774 },
  r32: { label: 'R-32', gwp: 675 },
  r404a: { label: 'R-404A', gwp: 3922 },
  r1234yf: { label: 'R-1234yf (HFO)', gwp: 4 },
  r1234ze: { label: 'R-1234ze (HFO)', gwp: 7 },
  r290: { label: 'R-290 (Propane)', gwp: 3 },
  r744: { label: 'R-744 (CO₂)', gwp: 1 },
  sf6: { label: 'SF6 (Electrical)', gwp: 22800 },
} as const;

// Grid emission factors by region (tCO2e per kWh)
// Updated: DEFRA 2025, IEA 2025, EPA eGRID 2023
export const GRID_REGIONS = {
  uk: { label: 'UK Grid', factor: 0.000177, source: 'DEFRA 2025' },
  us_avg: { label: 'US Average', factor: 0.000373, source: 'EPA eGRID 2023' },
  eu_avg: { label: 'EU Average', factor: 0.000220, source: 'EEA 2024' },
  germany: { label: 'Germany', factor: 0.000380, source: 'UBA 2024' },
  france: { label: 'France', factor: 0.000056, source: 'RTE 2024' },
  china: { label: 'China', factor: 0.000537, source: 'IEA 2025' },
  india: { label: 'India', factor: 0.000692, source: 'CEA 2024' },
  japan: { label: 'Japan', factor: 0.000434, source: 'MOE 2024' },
  australia: { label: 'Australia', factor: 0.000620, source: 'CER 2024' },
  canada: { label: 'Canada', factor: 0.000110, source: 'ECCC 2024' },
  brazil: { label: 'Brazil', factor: 0.000062, source: 'IEA 2025' },
  south_korea: { label: 'South Korea', factor: 0.000415, source: 'IEA 2025' },
} as const;

// Scope 3 EEIO spend-based factors (tCO2e per £/$ 1000 spent)
// Updated: USEEIO v2.0.1, DEFRA 2025
export const SPEND_FACTORS = {
  purchased_goods: { label: 'Purchased Goods & Services', factor: 0.43, source: 'USEEIO v2.0' },
  capital_goods: { label: 'Capital Goods', factor: 0.52, source: 'USEEIO v2.0' },
  fuel_energy: { label: 'Fuel & Energy Activities', factor: 0.15, source: 'DEFRA 2025' },
  upstream_transport: { label: 'Upstream Transportation', factor: 0.18, source: 'DEFRA 2025' },
  waste: { label: 'Waste in Operations', factor: 0.21, source: 'DEFRA 2025' },
  business_services: { label: 'Business Services', factor: 0.28, source: 'USEEIO v2.0' },
  it_telecom: { label: 'IT & Telecommunications', factor: 0.20, source: 'USEEIO v2.0' },
} as const;

// Business travel factors — DEFRA 2025 (major reduction from 2024 due to post-COVID load factor normalisation)
export const FLIGHT_FACTORS = {
  domestic: { label: 'Domestic (<500km)', factor: 0.000219, unit: 'passenger.km', source: 'DEFRA 2025' },
  short_haul: { label: 'Short-haul (500-3700km)', factor: 0.000113, unit: 'passenger.km', source: 'DEFRA 2025' },
  long_haul_economy: { label: 'Long-haul Economy', factor: 0.000117, unit: 'passenger.km', source: 'DEFRA 2025' },
  long_haul_premium_economy: { label: 'Long-haul Premium Economy', factor: 0.000190, unit: 'passenger.km', source: 'DEFRA 2025' },
  long_haul_business: { label: 'Long-haul Business', factor: 0.000340, unit: 'passenger.km', source: 'DEFRA 2025' },
  long_haul_first: { label: 'Long-haul First', factor: 0.000468, unit: 'passenger.km', source: 'DEFRA 2025' },
} as const;

export const COMMUTE_MODES = {
  car_alone: { label: 'Car (alone)', factor: 0.000174, unit: 'km', source: 'DEFRA 2025' },
  car_shared: { label: 'Car (shared, 2 people)', factor: 0.000087, unit: 'km', source: 'DEFRA 2025' },
  bus: { label: 'Bus', factor: 0.000102, unit: 'km', source: 'DEFRA 2025' },
  train: { label: 'Train/Metro', factor: 0.000035, unit: 'km', source: 'DEFRA 2025' },
  cycling: { label: 'Cycling/Walking', factor: 0, unit: 'km', source: 'N/A' },
  remote: { label: 'Remote/WFH', factor: 0.000008, unit: 'km', source: 'Estimated' }, // home energy
  ebike: { label: 'E-Bike / E-Scooter', factor: 0.000005, unit: 'km', source: 'Estimated' },
} as const;

// Hotel stays (tCO2e per night) — DEFRA 2025
export const HOTEL_FACTORS = {
  uk: { label: 'UK', factor: 0.01038, source: 'DEFRA 2025' },
  international: { label: 'International (avg)', factor: 0.01350, source: 'DEFRA 2025' },
} as const;

// Waste disposal factors (tCO2e per tonne) — DEFRA 2025
export const WASTE_FACTORS = {
  landfill_mixed: { label: 'Landfill (mixed municipal)', factor: 0.4467, source: 'DEFRA 2025' },
  recycled_mixed: { label: 'Recycled (mixed)', factor: 0.02137, source: 'DEFRA 2025' },
  composted: { label: 'Composted', factor: 0.00617, source: 'DEFRA 2025' },
  incineration: { label: 'Incineration (with energy recovery)', factor: 0.02137, source: 'DEFRA 2025' },
  electrical_waste: { label: 'Electrical Items (WEEE)', factor: 0.02137, source: 'DEFRA 2025' },
} as const;

// Water supply & treatment (tCO2e per m³) — DEFRA 2025
export const WATER_FACTORS = {
  supply: { label: 'Water Supply', factor: 0.000149, source: 'DEFRA 2025' },
  treatment: { label: 'Water Treatment', factor: 0.000272, source: 'DEFRA 2025' },
} as const;

// Equivalency helpers
export function getEquivalencies(tco2e: number) {
  return [
    { label: 'km driven by car', value: Math.round(tco2e / 0.000174), icon: '🚗' },
    { label: 'economy flights London→NYC', value: Math.round(tco2e / 0.65), icon: '✈️' },
    { label: 'trees needed to offset (per year)', value: Math.round(tco2e / 0.022), icon: '🌳' },
    { label: 'homes powered for a year', value: Math.round(tco2e / 2.9), icon: '🏠' },
  ];
}

// Scope 3 category definitions
export const SCOPE3_CATEGORIES = [
  { code: 'purchased_goods', label: '1. Purchased Goods & Services', description: 'Spend-based or activity-based calculations by supplier/category' },
  { code: 'capital_goods', label: '2. Capital Goods', description: 'Emissions from manufacturing long-term assets' },
  { code: 'fuel_energy', label: '3. Fuel & Energy-Related Activities', description: 'Upstream extraction, refining, transmission losses' },
  { code: 'upstream_transport', label: '4. Upstream Transportation & Distribution', description: 'Inbound logistics, third-party warehousing' },
  { code: 'waste', label: '5. Waste Generated in Operations', description: 'By waste type and disposal method' },
  { code: 'business_travel', label: '6. Business Travel', description: 'Flights, hotels, ground transport, rail' },
  { code: 'employee_commuting', label: '7. Employee Commuting', description: 'Distance, mode, remote work percentage' },
  { code: 'upstream_leased', label: '8. Upstream Leased Assets', description: 'Assets not in Scope 1/2' },
  { code: 'downstream_transport', label: '9. Downstream Transportation', description: 'Outbound shipping to customers' },
  { code: 'processing_sold', label: '10. Processing of Sold Products', description: 'Intermediate product manufacturing' },
  { code: 'use_sold', label: '11. Use of Sold Products', description: 'Product lifetime energy consumption' },
  { code: 'end_of_life', label: '12. End-of-Life Treatment', description: 'Product disposal emissions' },
  { code: 'downstream_leased', label: '13. Downstream Leased Assets', description: 'Franchises, leased property emissions' },
  { code: 'franchises', label: '14. Franchises', description: 'Scope 1/2 of franchise operations' },
  { code: 'investments', label: '15. Investments', description: 'Financed emissions for financial institutions' },
] as const;

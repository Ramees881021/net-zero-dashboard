// Country & sub-national grid emission factors (tCO2e per kWh)
// Sources: IEA Emission Factors 2025, EPA eGRID 2023, DEFRA 2025, national agencies
// Last updated: 2025-09-04 (IEA 2025 edition), 2025-06-10 (DEFRA 2025)

export interface CountryEmissionFactor {
  name: string;
  code: string;
  gridFactor: number; // tCO2e per kWh
  source: string;
}

export const COUNTRIES: CountryEmissionFactor[] = [
  // --- A ---
  { name: 'Afghanistan', code: 'AF', gridFactor: 0.000550, source: 'IEA 2025' },
  { name: 'Albania', code: 'AL', gridFactor: 0.000015, source: 'IEA 2025' },
  { name: 'Algeria', code: 'DZ', gridFactor: 0.000480, source: 'IEA 2025' },
  { name: 'Angola', code: 'AO', gridFactor: 0.000260, source: 'IEA 2025' },
  { name: 'Argentina', code: 'AR', gridFactor: 0.000330, source: 'IEA 2025' },
  { name: 'Armenia', code: 'AM', gridFactor: 0.000170, source: 'IEA 2025' },
  { name: 'Australia', code: 'AU', gridFactor: 0.000620, source: 'CER 2024' },
  { name: 'Austria', code: 'AT', gridFactor: 0.000085, source: 'IEA 2025' },
  { name: 'Azerbaijan', code: 'AZ', gridFactor: 0.000470, source: 'IEA 2025' },
  // --- B ---
  { name: 'Bahrain', code: 'BH', gridFactor: 0.000560, source: 'IEA 2025' },
  { name: 'Bangladesh', code: 'BD', gridFactor: 0.000570, source: 'IEA 2025' },
  { name: 'Belarus', code: 'BY', gridFactor: 0.000360, source: 'IEA 2025' },
  { name: 'Belgium', code: 'BE', gridFactor: 0.000140, source: 'IEA 2025' },
  { name: 'Bolivia', code: 'BO', gridFactor: 0.000390, source: 'IEA 2025' },
  { name: 'Bosnia & Herzegovina', code: 'BA', gridFactor: 0.000680, source: 'IEA 2025' },
  { name: 'Botswana', code: 'BW', gridFactor: 0.000860, source: 'IEA 2025' },
  { name: 'Brazil', code: 'BR', gridFactor: 0.000062, source: 'IEA 2025' },
  { name: 'Brunei', code: 'BN', gridFactor: 0.000520, source: 'IEA 2025' },
  { name: 'Bulgaria', code: 'BG', gridFactor: 0.000380, source: 'IEA 2025' },
  // --- C ---
  { name: 'Cambodia', code: 'KH', gridFactor: 0.000490, source: 'IEA 2025' },
  { name: 'Cameroon', code: 'CM', gridFactor: 0.000200, source: 'IEA 2025' },
  { name: 'Canada', code: 'CA', gridFactor: 0.000110, source: 'ECCC 2024' },
  { name: 'Chile', code: 'CL', gridFactor: 0.000360, source: 'IEA 2025' },
  { name: 'China', code: 'CN', gridFactor: 0.000537, source: 'IEA 2025' },
  { name: 'Colombia', code: 'CO', gridFactor: 0.000140, source: 'IEA 2025' },
  { name: 'Costa Rica', code: 'CR', gridFactor: 0.000018, source: 'IEA 2025' },
  { name: 'Côte d\'Ivoire', code: 'CI', gridFactor: 0.000400, source: 'IEA 2025' },
  { name: 'Croatia', code: 'HR', gridFactor: 0.000170, source: 'IEA 2025' },
  { name: 'Cuba', code: 'CU', gridFactor: 0.000750, source: 'IEA 2025' },
  { name: 'Cyprus', code: 'CY', gridFactor: 0.000570, source: 'IEA 2025' },
  { name: 'Czech Republic', code: 'CZ', gridFactor: 0.000400, source: 'IEA 2025' },
  // --- D ---
  { name: 'Denmark', code: 'DK', gridFactor: 0.000110, source: 'IEA 2025' },
  { name: 'Dominican Republic', code: 'DO', gridFactor: 0.000530, source: 'IEA 2025' },
  // --- E ---
  { name: 'Ecuador', code: 'EC', gridFactor: 0.000190, source: 'IEA 2025' },
  { name: 'Egypt', code: 'EG', gridFactor: 0.000440, source: 'IEA 2025' },
  { name: 'El Salvador', code: 'SV', gridFactor: 0.000240, source: 'IEA 2025' },
  { name: 'Estonia', code: 'EE', gridFactor: 0.000500, source: 'IEA 2025' },
  { name: 'Ethiopia', code: 'ET', gridFactor: 0.000010, source: 'IEA 2025' },
  // --- F ---
  { name: 'Finland', code: 'FI', gridFactor: 0.000060, source: 'IEA 2025' },
  { name: 'France', code: 'FR', gridFactor: 0.000056, source: 'RTE 2024' },
  // --- G ---
  { name: 'Georgia', code: 'GE', gridFactor: 0.000100, source: 'IEA 2025' },
  { name: 'Germany', code: 'DE', gridFactor: 0.000380, source: 'UBA 2024' },
  { name: 'Ghana', code: 'GH', gridFactor: 0.000310, source: 'IEA 2025' },
  { name: 'Greece', code: 'GR', gridFactor: 0.000320, source: 'IEA 2025' },
  { name: 'Guatemala', code: 'GT', gridFactor: 0.000290, source: 'IEA 2025' },
  // --- H ---
  { name: 'Honduras', code: 'HN', gridFactor: 0.000350, source: 'IEA 2025' },
  { name: 'Hong Kong SAR', code: 'HK', gridFactor: 0.000580, source: 'IEA 2025' },
  { name: 'Hungary', code: 'HU', gridFactor: 0.000210, source: 'IEA 2025' },
  // --- I ---
  { name: 'Iceland', code: 'IS', gridFactor: 0.000010, source: 'IEA 2025' },
  { name: 'India', code: 'IN', gridFactor: 0.000692, source: 'CEA 2024' },
  { name: 'Indonesia', code: 'ID', gridFactor: 0.000690, source: 'IEA 2025' },
  { name: 'Iran', code: 'IR', gridFactor: 0.000490, source: 'IEA 2025' },
  { name: 'Iraq', code: 'IQ', gridFactor: 0.000640, source: 'IEA 2025' },
  { name: 'Ireland', code: 'IE', gridFactor: 0.000270, source: 'SEAI 2024' },
  { name: 'Israel', code: 'IL', gridFactor: 0.000430, source: 'IEA 2025' },
  { name: 'Italy', code: 'IT', gridFactor: 0.000240, source: 'IEA 2025' },
  // --- J ---
  { name: 'Jamaica', code: 'JM', gridFactor: 0.000620, source: 'IEA 2025' },
  { name: 'Japan', code: 'JP', gridFactor: 0.000434, source: 'MOE 2024' },
  { name: 'Jordan', code: 'JO', gridFactor: 0.000480, source: 'IEA 2025' },
  // --- K ---
  { name: 'Kazakhstan', code: 'KZ', gridFactor: 0.000620, source: 'IEA 2025' },
  { name: 'Kenya', code: 'KE', gridFactor: 0.000090, source: 'IEA 2025' },
  { name: 'Kuwait', code: 'KW', gridFactor: 0.000570, source: 'IEA 2025' },
  // --- L ---
  { name: 'Latvia', code: 'LV', gridFactor: 0.000085, source: 'IEA 2025' },
  { name: 'Lebanon', code: 'LB', gridFactor: 0.000650, source: 'IEA 2025' },
  { name: 'Libya', code: 'LY', gridFactor: 0.000640, source: 'IEA 2025' },
  { name: 'Lithuania', code: 'LT', gridFactor: 0.000055, source: 'IEA 2025' },
  { name: 'Luxembourg', code: 'LU', gridFactor: 0.000075, source: 'IEA 2025' },
  // --- M ---
  { name: 'Malaysia', code: 'MY', gridFactor: 0.000570, source: 'IEA 2025' },
  { name: 'Malta', code: 'MT', gridFactor: 0.000380, source: 'IEA 2025' },
  { name: 'Mexico', code: 'MX', gridFactor: 0.000410, source: 'IEA 2025' },
  { name: 'Mongolia', code: 'MN', gridFactor: 0.000820, source: 'IEA 2025' },
  { name: 'Montenegro', code: 'ME', gridFactor: 0.000450, source: 'IEA 2025' },
  { name: 'Morocco', code: 'MA', gridFactor: 0.000600, source: 'IEA 2025' },
  { name: 'Mozambique', code: 'MZ', gridFactor: 0.000030, source: 'IEA 2025' },
  { name: 'Myanmar', code: 'MM', gridFactor: 0.000380, source: 'IEA 2025' },
  // --- N ---
  { name: 'Namibia', code: 'NA', gridFactor: 0.000160, source: 'IEA 2025' },
  { name: 'Nepal', code: 'NP', gridFactor: 0.000020, source: 'IEA 2025' },
  { name: 'Netherlands', code: 'NL', gridFactor: 0.000330, source: 'IEA 2025' },
  { name: 'New Zealand', code: 'NZ', gridFactor: 0.000090, source: 'IEA 2025' },
  { name: 'Nicaragua', code: 'NI', gridFactor: 0.000310, source: 'IEA 2025' },
  { name: 'Nigeria', code: 'NG', gridFactor: 0.000390, source: 'IEA 2025' },
  { name: 'North Macedonia', code: 'MK', gridFactor: 0.000530, source: 'IEA 2025' },
  { name: 'Norway', code: 'NO', gridFactor: 0.000008, source: 'IEA 2025' },
  // --- O ---
  { name: 'Oman', code: 'OM', gridFactor: 0.000520, source: 'IEA 2025' },
  // --- P ---
  { name: 'Pakistan', code: 'PK', gridFactor: 0.000420, source: 'IEA 2025' },
  { name: 'Panama', code: 'PA', gridFactor: 0.000190, source: 'IEA 2025' },
  { name: 'Paraguay', code: 'PY', gridFactor: 0.000010, source: 'IEA 2025' },
  { name: 'Peru', code: 'PE', gridFactor: 0.000210, source: 'IEA 2025' },
  { name: 'Philippines', code: 'PH', gridFactor: 0.000530, source: 'IEA 2025' },
  { name: 'Poland', code: 'PL', gridFactor: 0.000640, source: 'IEA 2025' },
  { name: 'Portugal', code: 'PT', gridFactor: 0.000160, source: 'IEA 2025' },
  // --- Q ---
  { name: 'Qatar', code: 'QA', gridFactor: 0.000440, source: 'IEA 2025' },
  // --- R ---
  { name: 'Romania', code: 'RO', gridFactor: 0.000250, source: 'IEA 2025' },
  { name: 'Russia', code: 'RU', gridFactor: 0.000360, source: 'IEA 2025' },
  { name: 'Rwanda', code: 'RW', gridFactor: 0.000280, source: 'IEA 2025' },
  // --- S ---
  { name: 'Saudi Arabia', code: 'SA', gridFactor: 0.000570, source: 'IEA 2025' },
  { name: 'Senegal', code: 'SN', gridFactor: 0.000560, source: 'IEA 2025' },
  { name: 'Serbia', code: 'RS', gridFactor: 0.000670, source: 'IEA 2025' },
  { name: 'Singapore', code: 'SG', gridFactor: 0.000390, source: 'EMA 2024' },
  { name: 'Slovakia', code: 'SK', gridFactor: 0.000110, source: 'IEA 2025' },
  { name: 'Slovenia', code: 'SI', gridFactor: 0.000220, source: 'IEA 2025' },
  { name: 'South Africa', code: 'ZA', gridFactor: 0.000900, source: 'Eskom 2024' },
  { name: 'South Korea', code: 'KR', gridFactor: 0.000415, source: 'IEA 2025' },
  { name: 'Spain', code: 'ES', gridFactor: 0.000140, source: 'REE 2024' },
  { name: 'Sri Lanka', code: 'LK', gridFactor: 0.000390, source: 'IEA 2025' },
  { name: 'Sweden', code: 'SE', gridFactor: 0.000008, source: 'IEA 2025' },
  { name: 'Switzerland', code: 'CH', gridFactor: 0.000018, source: 'IEA 2025' },
  // --- T ---
  { name: 'Taiwan', code: 'TW', gridFactor: 0.000495, source: 'BOE 2024' },
  { name: 'Tanzania', code: 'TZ', gridFactor: 0.000360, source: 'IEA 2025' },
  { name: 'Thailand', code: 'TH', gridFactor: 0.000460, source: 'IEA 2025' },
  { name: 'Trinidad & Tobago', code: 'TT', gridFactor: 0.000530, source: 'IEA 2025' },
  { name: 'Tunisia', code: 'TN', gridFactor: 0.000460, source: 'IEA 2025' },
  { name: 'Turkey', code: 'TR', gridFactor: 0.000410, source: 'IEA 2025' },
  { name: 'Turkmenistan', code: 'TM', gridFactor: 0.000650, source: 'IEA 2025' },
  // --- U ---
  { name: 'Uganda', code: 'UG', gridFactor: 0.000040, source: 'IEA 2025' },
  { name: 'Ukraine', code: 'UA', gridFactor: 0.000340, source: 'IEA 2025' },
  { name: 'United Arab Emirates', code: 'AE', gridFactor: 0.000410, source: 'IEA 2025' },
  { name: 'United Kingdom', code: 'GB', gridFactor: 0.000177, source: 'DEFRA 2025' },
  { name: 'United States', code: 'US', gridFactor: 0.000373, source: 'EPA eGRID 2023' },
  { name: 'Uruguay', code: 'UY', gridFactor: 0.000025, source: 'IEA 2025' },
  { name: 'Uzbekistan', code: 'UZ', gridFactor: 0.000450, source: 'IEA 2025' },
  // --- V ---
  { name: 'Venezuela', code: 'VE', gridFactor: 0.000190, source: 'IEA 2025' },
  { name: 'Vietnam', code: 'VN', gridFactor: 0.000490, source: 'IEA 2025' },
  // --- Z ---
  { name: 'Zambia', code: 'ZM', gridFactor: 0.000020, source: 'IEA 2025' },
  { name: 'Zimbabwe', code: 'ZW', gridFactor: 0.000530, source: 'IEA 2025' },
];

// US State-level grid emission factors (tCO2e per kWh) — EPA eGRID 2023 (released Jan 2025)
export interface USStateEmissionFactor {
  name: string;
  code: string;
  gridFactor: number;
  eGridSubregion: string;
}

export const US_STATES: USStateEmissionFactor[] = [
  { name: 'Alabama', code: 'AL', gridFactor: 0.000360, eGridSubregion: 'SRSO' },
  { name: 'Alaska', code: 'AK', gridFactor: 0.000430, eGridSubregion: 'AKGD' },
  { name: 'Arizona', code: 'AZ', gridFactor: 0.000360, eGridSubregion: 'AZNM' },
  { name: 'Arkansas', code: 'AR', gridFactor: 0.000430, eGridSubregion: 'SRMV' },
  { name: 'California', code: 'CA', gridFactor: 0.000205, eGridSubregion: 'CAMX' },
  { name: 'Colorado', code: 'CO', gridFactor: 0.000490, eGridSubregion: 'RMPA' },
  { name: 'Connecticut', code: 'CT', gridFactor: 0.000180, eGridSubregion: 'NEWE' },
  { name: 'Delaware', code: 'DE', gridFactor: 0.000350, eGridSubregion: 'RFCE' },
  { name: 'Florida', code: 'FL', gridFactor: 0.000370, eGridSubregion: 'FRCC' },
  { name: 'Georgia', code: 'GA', gridFactor: 0.000350, eGridSubregion: 'SRSO' },
  { name: 'Hawaii', code: 'HI', gridFactor: 0.000590, eGridSubregion: 'HIMS' },
  { name: 'Idaho', code: 'ID', gridFactor: 0.000075, eGridSubregion: 'NWPP' },
  { name: 'Illinois', code: 'IL', gridFactor: 0.000270, eGridSubregion: 'RFCM' },
  { name: 'Indiana', code: 'IN', gridFactor: 0.000600, eGridSubregion: 'RFCW' },
  { name: 'Iowa', code: 'IA', gridFactor: 0.000360, eGridSubregion: 'MROW' },
  { name: 'Kansas', code: 'KS', gridFactor: 0.000390, eGridSubregion: 'SPNO' },
  { name: 'Kentucky', code: 'KY', gridFactor: 0.000680, eGridSubregion: 'SRTV' },
  { name: 'Louisiana', code: 'LA', gridFactor: 0.000360, eGridSubregion: 'SRMV' },
  { name: 'Maine', code: 'ME', gridFactor: 0.000180, eGridSubregion: 'NEWE' },
  { name: 'Maryland', code: 'MD', gridFactor: 0.000300, eGridSubregion: 'RFCE' },
  { name: 'Massachusetts', code: 'MA', gridFactor: 0.000270, eGridSubregion: 'NEWE' },
  { name: 'Michigan', code: 'MI', gridFactor: 0.000430, eGridSubregion: 'RFCM' },
  { name: 'Minnesota', code: 'MN', gridFactor: 0.000370, eGridSubregion: 'MROW' },
  { name: 'Mississippi', code: 'MS', gridFactor: 0.000370, eGridSubregion: 'SRMV' },
  { name: 'Missouri', code: 'MO', gridFactor: 0.000580, eGridSubregion: 'SRMW' },
  { name: 'Montana', code: 'MT', gridFactor: 0.000340, eGridSubregion: 'NWPP' },
  { name: 'Nebraska', code: 'NE', gridFactor: 0.000480, eGridSubregion: 'MROW' },
  { name: 'Nevada', code: 'NV', gridFactor: 0.000270, eGridSubregion: 'NWPP' },
  { name: 'New Hampshire', code: 'NH', gridFactor: 0.000110, eGridSubregion: 'NEWE' },
  { name: 'New Jersey', code: 'NJ', gridFactor: 0.000200, eGridSubregion: 'RFCE' },
  { name: 'New Mexico', code: 'NM', gridFactor: 0.000440, eGridSubregion: 'AZNM' },
  { name: 'New York', code: 'NY', gridFactor: 0.000170, eGridSubregion: 'NYCW' },
  { name: 'North Carolina', code: 'NC', gridFactor: 0.000300, eGridSubregion: 'SRVC' },
  { name: 'North Dakota', code: 'ND', gridFactor: 0.000620, eGridSubregion: 'MROW' },
  { name: 'Ohio', code: 'OH', gridFactor: 0.000470, eGridSubregion: 'RFCW' },
  { name: 'Oklahoma', code: 'OK', gridFactor: 0.000340, eGridSubregion: 'SPSO' },
  { name: 'Oregon', code: 'OR', gridFactor: 0.000100, eGridSubregion: 'NWPP' },
  { name: 'Pennsylvania', code: 'PA', gridFactor: 0.000280, eGridSubregion: 'RFCE' },
  { name: 'Rhode Island', code: 'RI', gridFactor: 0.000310, eGridSubregion: 'NEWE' },
  { name: 'South Carolina', code: 'SC', gridFactor: 0.000240, eGridSubregion: 'SRVC' },
  { name: 'South Dakota', code: 'SD', gridFactor: 0.000230, eGridSubregion: 'MROW' },
  { name: 'Tennessee', code: 'TN', gridFactor: 0.000320, eGridSubregion: 'SRTV' },
  { name: 'Texas', code: 'TX', gridFactor: 0.000360, eGridSubregion: 'ERCT' },
  { name: 'Utah', code: 'UT', gridFactor: 0.000550, eGridSubregion: 'NWPP' },
  { name: 'Vermont', code: 'VT', gridFactor: 0.000010, eGridSubregion: 'NEWE' },
  { name: 'Virginia', code: 'VA', gridFactor: 0.000270, eGridSubregion: 'SRVC' },
  { name: 'Washington', code: 'WA', gridFactor: 0.000065, eGridSubregion: 'NWPP' },
  { name: 'West Virginia', code: 'WV', gridFactor: 0.000750, eGridSubregion: 'RFCW' },
  { name: 'Wisconsin', code: 'WI', gridFactor: 0.000470, eGridSubregion: 'RFCW' },
  { name: 'Wyoming', code: 'WY', gridFactor: 0.000680, eGridSubregion: 'RMPA' },
];

// Canadian province-level grid emission factors (tCO2e per kWh) — ECCC NIR 2024
export interface CAProvinceEmissionFactor {
  name: string;
  code: string;
  gridFactor: number;
}

export const CA_PROVINCES: CAProvinceEmissionFactor[] = [
  { name: 'Alberta', code: 'AB', gridFactor: 0.000440 },
  { name: 'British Columbia', code: 'BC', gridFactor: 0.000010 },
  { name: 'Manitoba', code: 'MB', gridFactor: 0.000002 },
  { name: 'New Brunswick', code: 'NB', gridFactor: 0.000270 },
  { name: 'Newfoundland & Labrador', code: 'NL', gridFactor: 0.000020 },
  { name: 'Northwest Territories', code: 'NT', gridFactor: 0.000140 },
  { name: 'Nova Scotia', code: 'NS', gridFactor: 0.000580 },
  { name: 'Nunavut', code: 'NU', gridFactor: 0.000770 },
  { name: 'Ontario', code: 'ON', gridFactor: 0.000025 },
  { name: 'Prince Edward Island', code: 'PE', gridFactor: 0.000010 },
  { name: 'Quebec', code: 'QC', gridFactor: 0.000002 },
  { name: 'Saskatchewan', code: 'SK', gridFactor: 0.000590 },
  { name: 'Yukon', code: 'YT', gridFactor: 0.000080 },
];

// Australian state-level grid emission factors (tCO2e per kWh) — CER 2024
export interface AUStateEmissionFactor {
  name: string;
  code: string;
  gridFactor: number;
}

export const AU_STATES: AUStateEmissionFactor[] = [
  { name: 'New South Wales & ACT', code: 'NSW', gridFactor: 0.000690 },
  { name: 'Victoria', code: 'VIC', gridFactor: 0.000800 },
  { name: 'Queensland', code: 'QLD', gridFactor: 0.000730 },
  { name: 'South Australia', code: 'SA', gridFactor: 0.000210 },
  { name: 'Western Australia (SWIS)', code: 'WA', gridFactor: 0.000520 },
  { name: 'Tasmania', code: 'TAS', gridFactor: 0.000110 },
  { name: 'Northern Territory', code: 'NT', gridFactor: 0.000580 },
];

// Indian state/grid-level emission factors (tCO2e per kWh) — CEA CO₂ Baseline Database v19
export interface INRegionEmissionFactor {
  name: string;
  code: string;
  gridFactor: number;
}

export const IN_REGIONS: INRegionEmissionFactor[] = [
  { name: 'Northern Grid', code: 'NR', gridFactor: 0.000690 },
  { name: 'Western Grid', code: 'WR', gridFactor: 0.000710 },
  { name: 'Southern Grid', code: 'SR', gridFactor: 0.000670 },
  { name: 'Eastern Grid', code: 'ER', gridFactor: 0.000780 },
  { name: 'North-Eastern Grid', code: 'NER', gridFactor: 0.000580 },
];

// Helper to get grid factor for a site — now supports US states, CA provinces, AU states, IN regions
export function getGridFactorForSite(
  country: string,
  state?: string
): { factor: number; source: string; label: string } | null {
  if (country === 'US' && state) {
    const usState = US_STATES.find(s => s.code === state);
    if (usState) {
      return { factor: usState.gridFactor, source: `EPA eGRID 2023 (${usState.eGridSubregion})`, label: `${usState.name}, US` };
    }
  }
  if (country === 'CA' && state) {
    const prov = CA_PROVINCES.find(p => p.code === state);
    if (prov) {
      return { factor: prov.gridFactor, source: 'ECCC NIR 2024', label: `${prov.name}, Canada` };
    }
  }
  if (country === 'AU' && state) {
    const auState = AU_STATES.find(s => s.code === state);
    if (auState) {
      return { factor: auState.gridFactor, source: 'CER 2024', label: `${auState.name}, Australia` };
    }
  }
  if (country === 'IN' && state) {
    const inRegion = IN_REGIONS.find(r => r.code === state);
    if (inRegion) {
      return { factor: inRegion.gridFactor, source: 'CEA v19', label: `${inRegion.name}, India` };
    }
  }
  const countryData = COUNTRIES.find(c => c.code === country);
  if (countryData) {
    return { factor: countryData.gridFactor, source: countryData.source, label: countryData.name };
  }
  return null;
}

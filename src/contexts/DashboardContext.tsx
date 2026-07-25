import { createContext, useContext, useState, ReactNode } from 'react';

interface PeriodPattern {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

interface DashboardContextType {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  setSelectedYearOnly: (year: number) => void;
  currency: string;
  setCurrency: (currency: string) => void;
  currencySymbol: string;
  baseYear: number | null;
  setBaseYear: (year: number | null) => void;
  reportingPeriodStart: Date;
  setReportingPeriodStart: (date: Date) => void;
  reportingPeriodEnd: Date;
  setReportingPeriodEnd: (date: Date) => void;
  periodPattern: PeriodPattern;
  setPeriodPattern: (pattern: PeriodPattern) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    JPY: '¥',
    INR: '₹',
  };
  return symbols[currency] || currency;
};

const applyPatternToYear = (year: number, pattern: PeriodPattern): { start: Date; end: Date } => {
  // If start month > end month, it's a split-year period (e.g., Oct-Sep)
  // The reporting year is the year with most months, so end falls in reporting year
  const startYear = pattern.startMonth > pattern.endMonth ? year - 1 : year;
  const endYear = year;
  return {
    start: new Date(startYear, pattern.startMonth - 1, pattern.startDay),
    end: new Date(endYear, pattern.endMonth - 1, pattern.endDay),
  };
};

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [currency, setCurrency] = useState('GBP');
  const [baseYear, setBaseYear] = useState<number | null>(null);
  const [periodPattern, setPeriodPatternState] = useState<PeriodPattern>({ startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 });
  
  const initialDates = applyPatternToYear(currentYear - 1, { startMonth: 1, startDay: 1, endMonth: 12, endDay: 31 });
  const [reportingPeriodStart, setReportingPeriodStart] = useState<Date>(initialDates.start);
  const [reportingPeriodEnd, setReportingPeriodEnd] = useState<Date>(initialDates.end);

  const setPeriodPattern = (pattern: PeriodPattern) => {
    setPeriodPatternState(pattern);
  };

  // When year dropdown changes, apply the saved pattern to that year
  const handleSetSelectedYear = (year: number) => {
    setSelectedYear(year);
    const dates = applyPatternToYear(year, periodPattern);
    setReportingPeriodStart(dates.start);
    setReportingPeriodEnd(dates.end);
  };

  const currencySymbol = getCurrencySymbol(currency);

  return (
    <DashboardContext.Provider value={{ 
      selectedYear, 
      setSelectedYear: handleSetSelectedYear,
      setSelectedYearOnly: setSelectedYear,
      currency, 
      setCurrency, 
      currencySymbol,
      baseYear,
      setBaseYear,
      reportingPeriodStart,
      setReportingPeriodStart,
      reportingPeriodEnd,
      setReportingPeriodEnd,
      periodPattern,
      setPeriodPattern,
    }}>
      {children}
    </DashboardContext.Provider>
  );
};

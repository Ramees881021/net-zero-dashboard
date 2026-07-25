import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard, DashboardProvider } from '@/contexts/DashboardContext';
import { useMode, ModeProvider } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { OverviewTab } from '@/components/dashboard/OverviewTab';
import { EmissionsTab } from '@/components/dashboard/EmissionsTab';
import { ScorecardTab } from '@/components/dashboard/ScorecardTab';
import { ClientsTab } from '@/components/dashboard/ClientsTab';
import { NetZeroTab } from '@/components/dashboard/NetZeroTab';
import { CarbonBudgetTab } from '@/components/dashboard/CarbonBudgetTab';
import { OrganisationTab } from '@/components/dashboard/OrganisationTab';
import { ReportingTab } from '@/components/dashboard/ReportingTab';
import { PredictiveAnalyticsTab } from '@/components/dashboard/PredictiveAnalyticsTab';
import { UsersTab } from '@/components/dashboard/UsersTab';
import { DocumentsManagementTab } from '@/components/dashboard/DocumentsManagementTab';
import { AlmacLogo } from '@/components/ui/AlmacLogo';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdmin } from '@/hooks/useAdmin';
import { useMasterDataCopy } from '@/hooks/useMasterDataCopy';

type TabType = 'overview' | 'emissions' | 'scorecard' | 'clients' | 'netzero' | 'carbonbudget' | 'organisation' | 'organisation-documents' | 'reporting' | 'predictive' | 'users';

interface Profile {
  id: string;
  user_id: string;
  company_name: string;
  industry: string | null;
  company_size: string | null;
  currency: string;
  base_year: number | null;
}

const DashboardContent = () => {
  const { user } = useAuth();
  const { setCurrency, setBaseYear, setPeriodPattern, setReportingPeriodStart, setReportingPeriodEnd, selectedYear, setSelectedYear: setSelectedYearWithPattern, setSelectedYearOnly: setSelectedYear } = useDashboard();
  const { isPresenterMode } = useMode();
  const { isAdmin } = useAdmin();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Copy master data on first login if user has no data yet
  useMasterDataCopy(user?.id);

  // Reset to valid tab when switching modes
  useEffect(() => {
    const businessOnlyTabs: TabType[] = ['predictive', 'scorecard', 'clients', 'carbonbudget', 'reporting', 'users', 'organisation-documents'];
    if (isPresenterMode && businessOnlyTabs.includes(activeTab)) {
      setActiveTab('overview');
    }
  }, [isPresenterMode, activeTab]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      // Fetch profile and latest emissions year in parallel
      const [profileRes, emissionsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('emissions_data')
          .select('reporting_year')
          .eq('user_id', user.id)
          .order('reporting_year', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      
      // Determine the best default year: latest year with data, or current-1
      const latestDataYear = emissionsRes.data?.reporting_year ?? null;
      
      if (!profileRes.error && profileRes.data) {
        setProfile(profileRes.data as any);
        setCurrency(profileRes.data.currency);
        setBaseYear(profileRes.data.base_year);
        // Load saved period pattern
        const p = profileRes.data as any;
        let pattern: { startMonth: number; startDay: number; endMonth: number; endDay: number } | null = null;
        if (p.period_start_month && p.period_end_month) {
          pattern = {
            startMonth: p.period_start_month,
            startDay: p.period_start_day || 1,
            endMonth: p.period_end_month,
            endDay: p.period_end_day || 31,
          };
          setPeriodPattern(pattern);
        }
        
        // Set year to latest data year if available
        if (latestDataYear) {
          const yearToSet = latestDataYear;
          if (pattern) {
            const startYear = pattern.startMonth > pattern.endMonth ? yearToSet - 1 : yearToSet;
            setReportingPeriodStart(new Date(startYear, pattern.startMonth - 1, pattern.startDay));
            setReportingPeriodEnd(new Date(yearToSet, pattern.endMonth - 1, pattern.endDay));
          }
          setSelectedYear(yearToSet);
        } else if (pattern) {
          const startYear = pattern.startMonth > pattern.endMonth ? selectedYear - 1 : selectedYear;
          setReportingPeriodStart(new Date(startYear, pattern.startMonth - 1, pattern.startDay));
          setReportingPeriodEnd(new Date(selectedYear, pattern.endMonth - 1, pattern.endDay));
        }
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    if (updatedProfile.currency) {
      setCurrency(updatedProfile.currency);
    }
    if (updatedProfile.base_year !== undefined) {
      setBaseYear(updatedProfile.base_year);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        profile={profile}
        onProfileUpdate={handleProfileUpdate}
        isAdmin={isAdmin}
      />
      <div className="flex-1 flex flex-col ml-64">
        {/* Top center logo */}
        <div className="w-full py-4 flex justify-center border-b bg-card">
          <AlmacLogo className="h-10" />
        </div>
        <DashboardHeader />
        <main className={cn(
          "flex-1 p-6 overflow-auto transition-all duration-300",
          "animate-fade-in"
        )}>
          {activeTab === 'organisation' && <OrganisationTab />}
          {activeTab === 'organisation-documents' && !isPresenterMode && isAdmin && <DocumentsManagementTab />}
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'predictive' && !isPresenterMode && <PredictiveAnalyticsTab />}
          {activeTab === 'emissions' && <EmissionsTab />}
          {activeTab === 'scorecard' && !isPresenterMode && <ScorecardTab />}
          {activeTab === 'clients' && !isPresenterMode && <ClientsTab />}
          {activeTab === 'netzero' && <NetZeroTab />}
          {activeTab === 'carbonbudget' && !isPresenterMode && <CarbonBudgetTab />}
          {activeTab === 'reporting' && !isPresenterMode && <ReportingTab />}
          {activeTab === 'users' && !isPresenterMode && isAdmin && <UsersTab />}
        </main>
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <ModeProvider>
      <DashboardProvider>
        <DashboardContent />
      </DashboardProvider>
    </ModeProvider>
  );
};

export default Dashboard;

import { useState } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, BarChart3, Award, Users, Target, Pencil, Check, X, Calendar, Wallet, Building2, ClipboardCheck, BrainCircuit, UsersRound, ChevronDown, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ModeToggle } from './ModeToggle';

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

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  profile: Profile | null;
  onProfileUpdate: (profile: Profile) => void;
  isAdmin?: boolean;
}
interface NavItem {
  id: TabType;
  label: string;
  icon: React.ElementType;
  businessOnly?: boolean;
  adminOnly?: boolean;
  subItems?: NavItem[];
}

const navItems: NavItem[] = [{
  id: 'organisation',
  label: 'Organisation',
  icon: Building2,
  subItems: [{
    id: 'organisation-documents',
    label: 'Documents Management',
    icon: FolderOpen,
    adminOnly: true
  }]
}, {
  id: 'emissions',
  label: 'Emissions',
  icon: BarChart3
}, {
  id: 'overview',
  label: 'Overview',
  icon: LayoutDashboard
}, {
  id: 'predictive',
  label: 'Predictive Analytics',
  icon: BrainCircuit,
  businessOnly: true
}, {
  id: 'scorecard',
  label: 'Scorecard',
  icon: Award,
  businessOnly: true
}, {
  id: 'clients',
  label: 'Clients',
  icon: Users,
  businessOnly: true
}, {
  id: 'netzero',
  label: 'Net-Zero',
  icon: Target
}, {
  id: 'carbonbudget',
  label: 'Carbon Budget',
  icon: Wallet,
  businessOnly: true
}, {
  id: 'reporting',
  label: 'Compliance',
  icon: ClipboardCheck,
  businessOnly: true
}, {
  id: 'users',
  label: 'User Management',
  icon: UsersRound,
  businessOnly: true,
  adminOnly: true
}];

const currentYear = new Date().getFullYear();
const years = Array.from({
  length: currentYear - 1999
}, (_, i) => currentYear - i);

export const Sidebar = ({
  activeTab,
  onTabChange,
  profile,
  onProfileUpdate,
  isAdmin = false
}: SidebarProps) => {
  const {
    baseYear,
    setBaseYear
  } = useDashboard();
  const {
    isPresenterMode
  } = useMode();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile?.company_name || '');
  const [expandedItems, setExpandedItems] = useState<Set<TabType>>(new Set());

  // Toggle expansion of a nav item
  const toggleExpand = (id: TabType) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSaveName = async () => {
    if (!profile) return;
    try {
      const {
        error
      } = await supabase.from('profiles').update({
        company_name: editedName
      }).eq('id', profile.id);
      if (error) throw error;
      onProfileUpdate({
        ...profile,
        company_name: editedName
      });
      setIsEditing(false);
      toast.success('Organisation name updated');
    } catch (error) {
      toast.error('Failed to update organisation name');
    }
  };

  const handleBaseYearChange = async (yearStr: string) => {
    if (!profile) return;
    const year = parseInt(yearStr);
    try {
      const {
        error
      } = await supabase.from('profiles').update({
        base_year: year
      }).eq('id', profile.id);
      if (error) throw error;
      setBaseYear(year);
      onProfileUpdate({
        ...profile,
        base_year: year
      });
      toast.success('Base year updated');
    } catch (error) {
      toast.error('Failed to update base year');
    }
  };

  // Filter items based on presenter mode and admin status
  const visibleItems = navItems.filter((item) => {
    if (isPresenterMode && item.businessOnly) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  return <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen fixed left-0 top-0 z-30">
      {/* Header with Mode Toggle */}
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <ModeToggle />

        {/* Company Name Section */}
        {isEditing ? <div className="space-y-2">
            <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="h-8 text-sm" placeholder="Organisation Name" />
            <div className="flex gap-1 justify-end">
              <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-sidebar-accent rounded text-sidebar-foreground/70">
                <X className="h-4 w-4" />
              </button>
              <button onClick={handleSaveName} className="p-1 hover:bg-sidebar-accent rounded text-primary">
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div> : <div className="flex items-center justify-between group">
            <span className="font-semibold text-sidebar-foreground truncate text-base">
              {profile?.company_name || 'Net Zero Progress'}
            </span>
            <button onClick={() => {
          setEditedName(profile?.company_name || '');
          setIsEditing(true);
        }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-sidebar-accent rounded text-sidebar-foreground/70 transition-opacity">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>}

        {/* Base Year Selector */}
        <div className="flex items-center justify-between text-xs text-sidebar-foreground/70">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Base Year:
          </span>
          <Select value={baseYear?.toString() || ''} onValueChange={handleBaseYearChange}>
            <SelectTrigger className="w-24 h-7 text-xs bg-sidebar border-sidebar-border">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {years.map((year) => <SelectItem key={year} value={year.toString()} className="text-xs">
                  {year}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const visibleSubItems = item.subItems?.filter((sub) => {
            if (isPresenterMode && sub.businessOnly) return false;
            if (sub.adminOnly && !isAdmin) return false;
            return true;
          });
          const isExpanded = expandedItems.has(item.id);
          const isSubItemActive = item.subItems?.some((sub) => sub.id === activeTab);
          const isActive = activeTab === item.id || isSubItemActive;
          return (<li key={item.id} className="space-y-1">
                <div className="flex items-center">
                  <button onClick={() => {
                onTabChange(item.id);
                if (hasSubItems) toggleExpand(item.id);
              }} className={cn("flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200", isActive ? "bg-sidebar-accent text-sidebar-foreground font-semibold shadow-sm" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
                    <Icon className="h-5 w-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {hasSubItems && (visibleSubItems?.length ?? 0) > 0 && <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-180")} />}
                  </button>
                </div>

                {/* Sub items */}
                {hasSubItems && isExpanded && visibleSubItems && visibleSubItems.length > 0 && <ul className="pl-9 space-y-1">
                    {visibleSubItems.map((subItem) => <li key={subItem.id}>
                        <button onClick={() => onTabChange(subItem.id)} className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200", activeTab === subItem.id ? "bg-sidebar-accent text-sidebar-foreground font-medium" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>

                          <subItem.icon className="h-4 w-4" />
                          {subItem.label}
                        </button>
                      </li>)}
                  </ul>}
              </li>);

        })}
        </ul>
      </nav>
    </aside>;
};
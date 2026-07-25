import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  ExternalLink, 
  Leaf, 
  Target, 
  Shield, 
  Award, 
  Zap, 
  FileBarChart, 
  FileText, 
  BadgeCheck, 
  Sun, 
  Gauge, 
  Car, 
  CircleOff, 
  Building2, 
  Home,
  Globe,
  FileText as DocumentIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface Credential {
  id: string;
  credential_type: string;
  credential_name: string;
  status: string;
  score_or_level: string | null;
  valid_until: string | null;
  attachment_url: string | null;
  certificate_url: string | null;
  logo_url?: string | null;
}

interface CredentialCardProps {
  credential: Credential;
  onDelete: () => void;
  onViewDocument?: (url: string, title: string) => void;
}

const credentialIcons: Record<string, LucideIcon> = {
  'CDP': Globe,
  'SBTi': Target,
  'EcoVadis': Shield,
  'ISO 14001': Award,
  'ISO 50001': Zap,
  'ISO 14064': FileBarChart,
  'GRI': FileText,
  'TCFD': FileBarChart,
  'B Corp': BadgeCheck,
  'RE100': Sun,
  'EP100': Gauge,
  'EV100': Car,
  'Carbon Neutral': Leaf,
  'Net Zero': CircleOff,
  'LEED': Building2,
  'BREEAM': Home,
  'default': Award,
};

const credentialColors: Record<string, string> = {
  'CDP': 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
  'SBTi': 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
  'EcoVadis': 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
  'ISO 14001': 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400',
  'ISO 50001': 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-400',
  'ISO 14064': 'bg-teal-500/10 border-teal-500/30 text-teal-700 dark:text-teal-400',
  'GRI': 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
  'TCFD': 'bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400',
  'B Corp': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  'RE100': 'bg-lime-500/10 border-lime-500/30 text-lime-700 dark:text-lime-400',
  'EP100': 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
  'EV100': 'bg-sky-500/10 border-sky-500/30 text-sky-700 dark:text-sky-400',
  'Carbon Neutral': 'bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-400',
  'Net Zero': 'bg-slate-500/10 border-slate-500/30 text-slate-700 dark:text-slate-400',
  'LEED': 'bg-green-600/10 border-green-600/30 text-green-800 dark:text-green-300',
  'BREEAM': 'bg-emerald-600/10 border-emerald-600/30 text-emerald-800 dark:text-emerald-300',
  'default': 'bg-muted border-border text-foreground',
};

export const CredentialCard = ({ credential, onDelete, onViewDocument }: CredentialCardProps) => {
  const colorClass = credentialColors[credential.credential_type] || credentialColors['default'];
  const IconComponent = credentialIcons[credential.credential_type] || credentialIcons['default'];

  return (
    <div
      className={cn(
        "relative group p-4 rounded-lg border-2 transition-all hover:shadow-md",
        colorClass
      )}
    >
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onDelete}
      >
        <Trash2 className="h-3 w-3" />
      </Button>

      <div className="text-center space-y-2">
        <div className="flex justify-center mb-2">
          <div className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center overflow-hidden">
            {credential.logo_url ? (
              <img 
                src={credential.logo_url} 
                alt={credential.credential_type} 
                className="w-full h-full object-contain"
              />
            ) : (
              <IconComponent className="h-5 w-5" />
            )}
          </div>
        </div>
        <div className="font-bold text-sm">{credential.credential_type}</div>
        {credential.score_or_level && (
          <div className="text-2xl font-extrabold">{credential.score_or_level}</div>
        )}
        <div className="text-xs opacity-80">{credential.credential_name}</div>
        {credential.valid_until && (
          <div className="text-xs opacity-60">
            Valid until {new Date(credential.valid_until).toLocaleDateString()}
          </div>
        )}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {credential.attachment_url && (
            <button
              onClick={() => onViewDocument?.(credential.attachment_url!, credential.credential_name)}
              className="inline-flex items-center gap-1 text-xs hover:underline cursor-pointer"
            >
              Document <FileText className="h-3 w-3" />
            </button>
          )}
          {credential.certificate_url && (
            <a
              href={credential.certificate_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs hover:underline"
            >
              View <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

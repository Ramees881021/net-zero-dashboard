import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Info, Pencil } from 'lucide-react';

interface FactorDetailsPanelProps {
  emissionFactor: number | null;
  emissionFactorSource: string | null;
  tco2e: number;
  quantity: number;
  unit: string;
  isOverridden?: boolean;
  originalAiFactor?: number | null;
  originalAiSource?: string | null;
  onOverrideClick?: () => void;
}

export const FactorDetailsPanel = ({
  emissionFactor,
  emissionFactorSource,
  tco2e,
  quantity,
  unit,
  isOverridden = false,
  originalAiFactor,
  originalAiSource,
  onOverrideClick,
}: FactorDetailsPanelProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!emissionFactor && !emissionFactorSource) return null;

  const isAiAssigned = emissionFactorSource?.toLowerCase().includes('ai') || false;

  return (
    <div className="mt-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="h-3 w-3" />
        <span>Factor Details</span>
        {isOverridden && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500 text-amber-600">
            Manually overridden
          </Badge>
        )}
        {isAiAssigned && !isOverridden && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-blue-500 text-blue-600">
            AI-assigned
          </Badge>
        )}
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="mt-2 p-3 rounded-lg bg-muted/30 border text-xs space-y-2 animate-fade-in">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <p className="text-muted-foreground">Emission Factor</p>
              <p className="font-medium">{emissionFactor?.toFixed(6) ?? 'N/A'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Unit</p>
              <p className="font-medium">tCO₂e/{unit || 'unit'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Source</p>
              <p className="font-medium">{emissionFactorSource || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Calculation</p>
              <p className="font-medium">{quantity.toLocaleString()} × {emissionFactor?.toFixed(6) ?? '?'} = {tco2e.toFixed(4)}</p>
            </div>
          </div>

          {isOverridden && originalAiFactor != null && (
            <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-muted-foreground mb-1">Original AI Suggestion</p>
              <p className="font-medium">
                Factor: {originalAiFactor.toFixed(6)} · Source: {originalAiSource || 'AI-assigned'}
              </p>
            </div>
          )}

          {onOverrideClick && (
            <div className="pt-1">
              <Button variant="outline" size="sm" onClick={onOverrideClick} className="h-6 text-xs gap-1">
                <Pencil className="h-3 w-3" /> Override Factor
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

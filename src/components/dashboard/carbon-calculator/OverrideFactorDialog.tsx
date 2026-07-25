import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle } from 'lucide-react';

interface OverrideFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFactor: number | null;
  currentSource: string | null;
  entryDescription: string;
  onOverride: (newFactor: number, newSource: string, justification: string) => void;
}

export const OverrideFactorDialog = ({
  open,
  onOpenChange,
  currentFactor,
  currentSource,
  entryDescription,
  onOverride,
}: OverrideFactorDialogProps) => {
  const [newFactor, setNewFactor] = useState(currentFactor?.toString() || '');
  const [newSource, setNewSource] = useState('');
  const [justification, setJustification] = useState('');

  const handleSubmit = () => {
    const factor = parseFloat(newFactor);
    if (isNaN(factor) || factor <= 0 || !justification.trim() || !newSource.trim()) return;
    onOverride(factor, newSource.trim(), justification.trim());
    onOpenChange(false);
    setNewFactor('');
    setNewSource('');
    setJustification('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Override Emission Factor</DialogTitle>
          <DialogDescription>
            Override the current factor for: {entryDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {currentFactor != null && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="text-muted-foreground text-xs mb-1">Current Factor</p>
              <p className="font-medium">{currentFactor.toFixed(6)} · {currentSource || 'Unknown source'}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>New Emission Factor (tCO₂e/unit)</Label>
            <Input
              type="number"
              step="0.000001"
              value={newFactor}
              onChange={e => setNewFactor(e.target.value)}
              placeholder="0.000000"
            />
          </div>

          <div className="space-y-2">
            <Label>Source Database / Reference</Label>
            <Input
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              placeholder="e.g. DEFRA 2025, Ecoinvent 3.10, Custom measurement"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Justification (Required for audit trail)
            </Label>
            <Textarea
              value={justification}
              onChange={e => setJustification(e.target.value)}
              placeholder="Explain why this factor is being overridden and cite the source of the new factor..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!newFactor || !justification.trim() || !newSource.trim() || parseFloat(newFactor) <= 0}
            >
              Apply Override
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

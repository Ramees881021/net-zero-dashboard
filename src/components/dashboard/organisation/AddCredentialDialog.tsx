import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, X } from 'lucide-react';

interface AddCredentialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (credential: {
    credential_type: string;
    credential_name: string;
    status: string;
    score_or_level: string | null;
    valid_until: string | null;
    attachment_url: string | null;
    certificate_url: string | null;
  }, attachmentFile: File | null) => void;
}

const credentialTypes = [
  { value: 'CDP', label: 'CDP (Carbon Disclosure Project)', hasScore: true, scoreLabel: 'Score (A-F)' },
  { value: 'SBTi', label: 'Science Based Targets initiative', hasScore: true, scoreLabel: 'Status' },
  { value: 'EcoVadis', label: 'EcoVadis', hasScore: true, scoreLabel: 'Score (1-100)' },
  { value: 'ISO 14001', label: 'ISO 14001 (Environmental Management)', hasScore: false },
  { value: 'ISO 50001', label: 'ISO 50001 (Energy Management)', hasScore: false },
  { value: 'ISO 14064', label: 'ISO 14064 (GHG Accounting)', hasScore: false },
  { value: 'GRI', label: 'GRI Standards', hasScore: false },
  { value: 'TCFD', label: 'TCFD Reporting', hasScore: false },
  { value: 'B Corp', label: 'B Corp Certified', hasScore: true, scoreLabel: 'Score' },
  { value: 'RE100', label: 'RE100 (100% Renewable Energy)', hasScore: false },
  { value: 'EP100', label: 'EP100 (Energy Productivity)', hasScore: false },
  { value: 'EV100', label: 'EV100 (Electric Vehicles)', hasScore: false },
  { value: 'Carbon Neutral', label: 'Carbon Neutral Certified', hasScore: false },
  { value: 'Net Zero', label: 'Net Zero Commitment', hasScore: false },
  { value: 'LEED', label: 'LEED Certification', hasScore: true, scoreLabel: 'Level' },
  { value: 'BREEAM', label: 'BREEAM Certification', hasScore: true, scoreLabel: 'Level' },
  { value: 'Other', label: 'Other', hasScore: true, scoreLabel: 'Level/Score' },
];

export const AddCredentialDialog = ({ open, onOpenChange, onAdd }: AddCredentialDialogProps) => {
  const [credentialType, setCredentialType] = useState('');
  const [customName, setCustomName] = useState('');
  const [scoreOrLevel, setScoreOrLevel] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [certificateUrl, setCertificateUrl] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const selectedType = credentialTypes.find(t => t.value === credentialType);

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setAttachmentFile(file);
    } else if (file) {
      alert('Please select a PDF file only');
      e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!credentialType) return;

    onAdd({
      credential_type: credentialType,
      credential_name: credentialType === 'Other' ? customName : (selectedType?.label || credentialType),
      status: 'active',
      score_or_level: scoreOrLevel || null,
      valid_until: validUntil || null,
      attachment_url: null, // Will be set after upload
      certificate_url: certificateUrl || null,
    }, attachmentFile);

    // Reset form
    setCredentialType('');
    setCustomName('');
    setScoreOrLevel('');
    setValidUntil('');
    setAttachmentFile(null);
    setCertificateUrl('');
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Sustainability Credential</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Credential Type</Label>
            <Select value={credentialType} onValueChange={setCredentialType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a credential" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {credentialTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {credentialType === 'Other' && (
            <div className="space-y-2">
              <Label>Credential Name</Label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter credential name"
                required
              />
            </div>
          )}

          {selectedType?.hasScore && (
            <div className="space-y-2">
              <Label>{selectedType.scoreLabel}</Label>
              <Input
                value={scoreOrLevel}
                onChange={(e) => setScoreOrLevel(e.target.value)}
                placeholder={`Enter ${selectedType.scoreLabel?.toLowerCase()}`}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Valid Until (Optional)</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment (Optional) - PDF only</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={attachmentInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleAttachmentChange}
                className="flex-1"
              />
              {attachmentFile && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span className="truncate max-w-[100px]">{attachmentFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setAttachmentFile(null);
                      if (attachmentInputRef.current) {
                        attachmentInputRef.current.value = '';
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Certificate URL (Optional)</Label>
            <Input
              type="url"
              value={certificateUrl}
              onChange={(e) => setCertificateUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!credentialType || (credentialType === 'Other' && !customName)}>
              Add Credential
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

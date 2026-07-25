import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Upload, Trash2, Image as ImageIcon, Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Default credential types that can have logos
const defaultCredentialTypes = [
  { value: 'CDP', label: 'CDP (Carbon Disclosure Project)' },
  { value: 'SBTi', label: 'Science Based Targets initiative' },
  { value: 'EcoVadis', label: 'EcoVadis' },
  { value: 'ISO 14001', label: 'ISO 14001 (Environmental Management)' },
  { value: 'ISO 50001', label: 'ISO 50001 (Energy Management)' },
  { value: 'ISO 14064', label: 'ISO 14064 (GHG Accounting)' },
  { value: 'GRI', label: 'GRI Standards' },
  { value: 'TCFD', label: 'TCFD Reporting' },
  { value: 'B Corp', label: 'B Corp Certified' },
  { value: 'RE100', label: 'RE100 (100% Renewable Energy)' },
  { value: 'EP100', label: 'EP100 (Energy Productivity)' },
  { value: 'EV100', label: 'EV100 (Electric Vehicles)' },
  { value: 'Carbon Neutral', label: 'Carbon Neutral Certified' },
  { value: 'Net Zero', label: 'Net Zero Commitment' },
  { value: 'LEED', label: 'LEED Certification' },
  { value: 'BREEAM', label: 'BREEAM Certification' },
];

interface CredentialLogo {
  id: string;
  credential_type: string;
  logo_url: string | null;
}

interface DocumentsManagementProps {
  credentials: CredentialLogo[];
  onLogoUpdate: (credentialType: string, logoUrl: string | null) => void;
  onCredentialAdd: (credentialType: string, label: string) => void;
}

export const DocumentsManagement = ({ 
  credentials, 
  onLogoUpdate,
  onCredentialAdd 
}: DocumentsManagementProps) => {
  const { user } = useAuth();
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newCredentialName, setNewCredentialName] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Get all credential types (default + any custom ones from credentials)
  const getAllCredentialTypes = () => {
    const defaultTypes = new Set(defaultCredentialTypes.map(t => t.value));
    const customTypes = credentials
      .filter(c => !defaultTypes.has(c.credential_type))
      .map(c => ({ value: c.credential_type, label: c.credential_type }));
    return [...defaultCredentialTypes, ...customTypes];
  };

  const handleLogoUpload = async (credentialType: string, file: File) => {
    if (!user) return;
    
    setUploadingFor(credentialType);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/credential-logos/${credentialType.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      // Store logo in credential_type_logos table (upsert)
      const { error: upsertError } = await supabase
        .from('credential_type_logos')
        .upsert({
          user_id: user.id,
          credential_type: credentialType,
          logo_url: publicUrl
        }, { onConflict: 'user_id,credential_type' });

      if (upsertError) throw upsertError;

      // Also update any existing credentials of this type
      await supabase
        .from('sustainability_credentials')
        .update({ logo_url: publicUrl })
        .eq('user_id', user.id)
        .eq('credential_type', credentialType);

      onLogoUpdate(credentialType, publicUrl);
      toast.success(`Logo updated for ${credentialType}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingFor(null);
    }
  };

  const handleRemoveLogo = async (credentialType: string) => {
    if (!user) return;
    
    try {
      // Remove from credential_type_logos table
      const { error } = await supabase
        .from('credential_type_logos')
        .delete()
        .eq('user_id', user.id)
        .eq('credential_type', credentialType);

      if (error) throw error;

      // Also update any existing credentials
      await supabase
        .from('sustainability_credentials')
        .update({ logo_url: null })
        .eq('user_id', user.id)
        .eq('credential_type', credentialType);

      onLogoUpdate(credentialType, null);
      toast.success(`Logo removed for ${credentialType}`);
    } catch (error) {
      console.error('Remove error:', error);
      toast.error('Failed to remove logo');
    }
  };

  const handleAddCredential = () => {
    if (!newCredentialName.trim()) return;
    onCredentialAdd(newCredentialName.trim(), newCredentialName.trim());
    setNewCredentialName('');
    setIsAddDialogOpen(false);
    toast.success('Credential type added');
  };

  const getLogoForType = (credentialType: string) => {
    const cred = credentials.find(c => c.credential_type === credentialType);
    return cred?.logo_url || null;
  };

  const allCredentialTypes = getAllCredentialTypes();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Documents Management</CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Credential Type
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Upload custom logos for your sustainability credentials. These logos will replace the default icons in the Credentials section.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allCredentialTypes.map((type) => {
              const logoUrl = getLogoForType(type.value);
              const isUploading = uploadingFor === type.value;
              
              return (
                <div 
                  key={type.value}
                  className={cn(
                    "relative group p-4 rounded-lg border-2 transition-all hover:shadow-md bg-card",
                    logoUrl ? "border-primary/30" : "border-border"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Logo preview */}
                    <div className="w-16 h-16 rounded-lg border bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {logoUrl ? (
                        <img 
                          src={logoUrl} 
                          alt={type.label} 
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Award className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    
                    {/* Info and actions */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{type.value}</h4>
                      <p className="text-xs text-muted-foreground truncate">{type.label}</p>
                      
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[type.value]?.click()}
                        >
                          {isUploading ? (
                            'Uploading...'
                          ) : (
                            <>
                              <Upload className="h-3 w-3 mr-1" />
                              {logoUrl ? 'Change' : 'Upload'}
                            </>
                          )}
                        </Button>
                        {logoUrl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => handleRemoveLogo(type.value)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <input
                    ref={(el) => { fileInputRefs.current[type.value] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(type.value, file);
                      e.target.value = '';
                    }}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Credential Type Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Credential Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Credential Name</Label>
              <Input
                value={newCredentialName}
                onChange={(e) => setNewCredentialName(e.target.value)}
                placeholder="Enter credential name"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddCredential} disabled={!newCredentialName.trim()}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

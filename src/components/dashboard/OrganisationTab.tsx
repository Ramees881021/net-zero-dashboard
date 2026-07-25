import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Camera, Pencil, Plus, X, Building2, Check, Trash2 } from 'lucide-react';
import defaultBanner from '@/assets/default-banner.jpg';
import { CredentialCard } from './organisation/CredentialCard';
import { AddCredentialDialog } from './organisation/AddCredentialDialog';
import { PdfViewerDialog } from './organisation/PdfViewerDialog';

interface Profile {
  id: string;
  company_name: string;
  logo_url: string | null;
  banner_url: string | null;
  summary: string | null;
}

interface Credential {
  id: string;
  credential_type: string;
  credential_name: string;
  status: string;
  score_or_level: string | null;
  valid_until: string | null;
  attachment_url: string | null;
  certificate_url: string | null;
  display_order: number;
  logo_url: string | null;
}

export const OrganisationTab = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedSummary, setEditedSummary] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [selectedPdfTitle, setSelectedPdfTitle] = useState<string>('');
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    const [profileResult, credentialsResult, logosResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, company_name, logo_url, banner_url, summary')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('sustainability_credentials')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true }),
      supabase
        .from('credential_type_logos')
        .select('credential_type, logo_url')
        .eq('user_id', user.id)
    ]);

    if (profileResult.data) {
      setProfile(profileResult.data);
      setEditedName(profileResult.data.company_name);
      setEditedSummary(profileResult.data.summary || '');
    }

    if (credentialsResult.data) {
      // Merge logos from credential_type_logos table
      const logoMap = new Map<string, string>();
      if (logosResult.data) {
        logosResult.data.forEach(logo => {
          if (logo.logo_url) {
            logoMap.set(logo.credential_type, logo.logo_url);
          }
        });
      }

      // Apply logos to credentials
      const credentialsWithLogos = credentialsResult.data.map(cred => ({
        ...cred,
        logo_url: logoMap.get(cred.credential_type) || cred.logo_url
      }));

      setCredentials(credentialsWithLogos);
    }

    setLoading(false);
  };

  const handleFileUpload = async (
    file: File,
    type: 'logo' | 'banner'
  ) => {
    if (!user || !profile) return;

    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingBanner;
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      const updateField = type === 'logo' ? 'logo_url' : 'banner_url';
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [updateField]: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, [updateField]: publicUrl });
      toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} updated successfully`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveName = async () => {
    if (!profile || !editedName.trim()) return;

    const { error } = await supabase
      .from('profiles')
      .update({ company_name: editedName.trim() })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update company name');
    } else {
      setProfile({ ...profile, company_name: editedName.trim() });
      toast.success('Company name updated');
    }
    setIsEditingName(false);
  };

  const handleSaveSummary = async () => {
    if (!profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ summary: editedSummary.trim() || null })
      .eq('id', profile.id);

    if (error) {
      toast.error('Failed to update summary');
    } else {
      setProfile({ ...profile, summary: editedSummary.trim() || null });
      toast.success('Summary updated');
    }
    setIsEditingSummary(false);
  };

  const handleAddCredential = async (credential: Omit<Credential, 'id' | 'display_order'>, attachmentFile: File | null) => {
    if (!user) return;

    let attachmentUrl: string | null = null;

    // Upload attachment if provided
    if (attachmentFile) {
      const fileExt = attachmentFile.name.split('.').pop();
      const fileName = `${user.id}/credentials/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, attachmentFile, { upsert: true });

      if (uploadError) {
        toast.error('Failed to upload attachment');
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      attachmentUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('sustainability_credentials')
      .insert({
        user_id: user.id,
        ...credential,
        attachment_url: attachmentUrl,
        display_order: credentials.length
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add credential');
    } else if (data) {
      setCredentials([...credentials, data]);
      toast.success('Credential added');
      setIsAddDialogOpen(false);
    }
  };

  const handleViewDocument = (url: string, title: string) => {
    setSelectedPdfUrl(url);
    setSelectedPdfTitle(title);
    setPdfViewerOpen(true);
  };

  const handleDeleteCredential = async (id: string) => {
    const { error } = await supabase
      .from('sustainability_credentials')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete credential');
    } else {
      setCredentials(credentials.filter(c => c.id !== id));
      toast.success('Credential removed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const bannerUrl = profile?.banner_url || defaultBanner;
  const logoUrl = profile?.logo_url;

  return (
    <div className="space-y-6">
      {/* LinkedIn-style Profile Header */}
      <Card className="overflow-hidden">
        {/* Banner */}
        <div className="relative h-48 bg-muted">
          <img
            src={bannerUrl}
            alt="Company banner"
            className="w-full h-full object-cover"
          />
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-3 right-3 gap-2"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
          >
            <Camera className="h-4 w-4" />
            {uploadingBanner ? 'Uploading...' : 'Edit Banner'}
          </Button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file, 'banner');
            }}
          />
        </div>

        {/* Profile Section */}
        <div className="relative px-6 pb-6">
          {/* Logo */}
          <div className="absolute -top-16 left-6">
            <div className="relative">
              <div className="w-32 h-32 rounded-lg border-4 border-background bg-white flex items-center justify-center overflow-hidden shadow-lg">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Company logo"
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                <Camera className="h-4 w-4" />
              </Button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file, 'logo');
                }}
              />
            </div>
          </div>

          {/* Company Name */}
          <div className="pt-20">
            {isEditingName ? (
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="text-2xl font-bold h-12"
                  autoFocus
                />
                <Button size="icon" onClick={handleSaveName}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  setEditedName(profile?.company_name || '');
                  setIsEditingName(false);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-2xl font-bold">{profile?.company_name || 'Your Company'}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                  onClick={() => setIsEditingName(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>About</CardTitle>
          {!isEditingSummary && (
            <Button variant="ghost" size="sm" onClick={() => setIsEditingSummary(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isEditingSummary ? (
            <div className="space-y-3">
              <Textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                placeholder="Tell us about your organization's sustainability journey, mission, and commitments..."
                className="min-h-[150px]"
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveSummary}>Save</Button>
                <Button variant="ghost" onClick={() => {
                  setEditedSummary(profile?.summary || '');
                  setIsEditingSummary(false);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">
              {profile?.summary || 'Add a summary to describe your organization\'s sustainability journey, mission, and environmental commitments.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sustainability Credentials Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Sustainability Credentials</CardTitle>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Credential
          </Button>
        </CardHeader>
        <CardContent>
          {credentials.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">Showcase your sustainability credentials and certifications</p>
              <p className="text-sm">Add credentials like CDP, SBTi, EcoVadis, ISO 14001, and more</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {credentials.map((credential) => (
                <CredentialCard
                  key={credential.id}
                  credential={credential}
                  onDelete={() => handleDeleteCredential(credential.id)}
                  onViewDocument={handleViewDocument}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddCredentialDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddCredential}
      />

      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        pdfUrl={selectedPdfUrl}
        title={selectedPdfTitle}
      />
    </div>
  );
};

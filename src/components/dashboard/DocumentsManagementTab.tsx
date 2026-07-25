import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DocumentsManagement } from './organisation/DocumentsManagement';
import { Loader2 } from 'lucide-react';

interface CredentialLogo {
  id: string;
  credential_type: string;
  logo_url: string | null;
}

export const DocumentsManagementTab = () => {
  const { user } = useAuth();
  const [credentialLogos, setCredentialLogos] = useState<CredentialLogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredentialLogos();
  }, [user]);

  const fetchCredentialLogos = async () => {
    if (!user) return;

    // Fetch from credential_type_logos table (not sustainability_credentials)
    const { data, error } = await supabase
      .from('credential_type_logos')
      .select('id, credential_type, logo_url')
      .eq('user_id', user.id);

    if (!error && data) {
      setCredentialLogos(data);
    }
    setLoading(false);
  };

  const handleLogoUpdate = (credentialType: string, logoUrl: string | null) => {
    if (logoUrl) {
      // Add or update the logo
      setCredentialLogos(prev => {
        const existing = prev.find(c => c.credential_type === credentialType);
        if (existing) {
          return prev.map(c => 
            c.credential_type === credentialType 
              ? { ...c, logo_url: logoUrl } 
              : c
          );
        } else {
          return [...prev, { id: crypto.randomUUID(), credential_type: credentialType, logo_url: logoUrl }];
        }
      });
    } else {
      // Remove the logo
      setCredentialLogos(prev => prev.filter(c => c.credential_type !== credentialType));
    }
  };

  const handleCredentialAdd = async (credentialType: string, label: string) => {
    // This only adds to the logo list, not to sustainability_credentials
    // The actual credential should be added via "Add Credential" button
    if (!user) return;

    const { data, error } = await supabase
      .from('credential_type_logos')
      .insert({
        user_id: user.id,
        credential_type: credentialType,
        logo_url: ''
      })
      .select('id, credential_type, logo_url')
      .single();

    if (!error && data) {
      setCredentialLogos(prev => [...prev, data]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DocumentsManagement
      credentials={credentialLogos}
      onLogoUpdate={handleLogoUpdate}
      onCredentialAdd={handleCredentialAdd}
    />
  );
};

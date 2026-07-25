import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Trash2, FileText, Image, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface EntryDocumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
  entryDescription?: string;
}

interface EntryDocument {
  id: string;
  file_name: string;
  file_url: string;
  document_type: string;
  notes: string | null;
  uploaded_at: string;
}

const DOC_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'meter_reading', label: 'Meter Reading' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'other', label: 'Other' },
];

export const EntryDocumentsDialog = ({ open, onOpenChange, entryId, entryDescription }: EntryDocumentsDialogProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<EntryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('invoice');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !user || !entryId) return;
    setLoading(true);
    supabase
      .from('carbon_entry_documents')
      .select('*')
      .eq('user_id', user.id)
      .eq('entry_id', entryId)
      .order('uploaded_at', { ascending: false })
      .then(({ data }) => {
        setDocuments((data || []) as EntryDocument[]);
        setLoading(false);
      });
  }, [open, user, entryId]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);

    const filePath = `${user.id}/${entryId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('carbon-evidence')
      .upload(filePath, file);

    if (uploadError) {
      toast.error('Failed to upload file');
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('carbon-evidence')
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('carbon_entry_documents')
      .insert({
        user_id: user.id,
        entry_id: entryId,
        file_name: file.name,
        file_url: filePath,
        document_type: docType,
        notes: notes || null,
      });

    if (dbError) {
      toast.error('Failed to save document record');
    } else {
      toast.success('Document uploaded');
      setNotes('');
      // Refresh
      const { data } = await supabase
        .from('carbon_entry_documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('entry_id', entryId)
        .order('uploaded_at', { ascending: false });
      setDocuments((data || []) as EntryDocument[]);
    }
    setUploading(false);
  };

  const handleDelete = async (doc: EntryDocument) => {
    if (!user) return;
    await supabase.storage.from('carbon-evidence').remove([doc.file_url]);
    await supabase.from('carbon_entry_documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast.success('Document removed');
  };

  const getDownloadUrl = async (filePath: string) => {
    const { data } = await supabase.storage
      .from('carbon-evidence')
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const isImage = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            📎 Evidence Documents: {entryDescription || entryId.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        {/* Upload form */}
        <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Document Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input className="h-8" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Jan 2024 gas bill" />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.xlsx,.xls,.csv,.doc,.docx"
            onChange={e => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = ''; } }}
          />
        </div>

        {/* Documents list */}
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No documents attached yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="shrink-0">
                  {isImage(doc.file_name) ? <Image className="h-5 w-5 text-blue-500" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px]">{DOC_TYPES.find(t => t.value === doc.document_type)?.label || doc.document_type}</Badge>
                    {doc.notes && <span className="text-xs text-muted-foreground truncate">{doc.notes}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => getDownloadUrl(doc.file_url)}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

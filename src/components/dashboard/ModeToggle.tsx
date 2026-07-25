import { useState } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Presentation, Briefcase, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const ModeToggle = () => {
  const { mode, setMode } = useMode();
  const { user } = useAuth();
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleModeSwitch = (newMode: 'business' | 'presenter') => {
    if (newMode === mode) return;

    if (newMode === 'business' && mode === 'presenter') {
      // Require password to switch from presenter to business mode
      setShowPasswordDialog(true);
    } else {
      // Switching to presenter mode doesn't require password
      performModeSwitch(newMode);
    }
  };

  const performModeSwitch = (newMode: 'business' | 'presenter') => {
    setIsTransitioning(true);
    setTimeout(() => {
      setMode(newMode);
      setIsTransitioning(false);
      toast.success(`Switched to ${newMode === 'business' ? 'Business' : 'Presenter'} Mode`);
    }, 300);
  };

  const handlePasswordSubmit = async () => {
    if (!user?.email) {
      toast.error('Unable to verify. Please try again.');
      return;
    }

    setIsVerifying(true);
    
    try {
      // Verify password by attempting to sign in with current email and provided password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });

      if (error) {
        toast.error('Incorrect password');
        setPassword('');
      } else {
        setShowPasswordDialog(false);
        setPassword('');
        performModeSwitch('business');
      }
    } catch {
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDialogClose = () => {
    setShowPasswordDialog(false);
    setPassword('');
  };

  return (
    <>
      <div className={cn(
        "flex items-center gap-1 p-1 rounded-lg bg-sidebar-accent/50 transition-all duration-300",
        isTransitioning && "opacity-50"
      )}>
        <button
          onClick={() => handleModeSwitch('business')}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-300",
            mode === 'business'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Briefcase className="h-3.5 w-3.5" />
          <span>Business</span>
        </button>
        <button
          onClick={() => handleModeSwitch('presenter')}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-300",
            mode === 'presenter'
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          )}
        >
          <Presentation className="h-3.5 w-3.5" />
          <span>Presenter</span>
        </button>
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Enter Business Mode
            </DialogTitle>
            <DialogDescription>
              Business Mode contains sensitive internal data. Please enter the password to continue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleDialogClose} disabled={isVerifying}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={isVerifying}>
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

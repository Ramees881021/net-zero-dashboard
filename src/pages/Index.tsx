import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlmacLogo } from '@/components/ui/AlmacLogo';
import { useAdmin } from '@/hooks/useAdmin';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const navigate = useNavigate();
  const [displayText, setDisplayText] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const fullText = 'Track. Reduce. Zero.';

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (loading) return;
    
    let currentIndex = 0;
    let isPaused = false;
    
    const runTyping = () => {
      const typingInterval = setInterval(() => {
        if (currentIndex <= fullText.length) {
          setDisplayText(fullText.slice(0, currentIndex));
          currentIndex++;
          if (currentIndex > fullText.length) {
            setIsTypingComplete(true);
            clearInterval(typingInterval);
            // 2 second pause then clear and restart
            setTimeout(() => {
              setDisplayText('');
              setIsTypingComplete(false);
              currentIndex = 0;
              runTyping();
            }, 2000);
          }
        }
      }, 150); // Slower typing speed
      
      return typingInterval;
    };
    
    const interval = runTyping();
    return () => clearInterval(interval);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse">
          <AlmacLogo className="h-12" />
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header with logo left, tabs right */}
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <AlmacLogo className="h-10" />
        <div className="flex items-center gap-4">
          {user && isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Button>
          )}
          {!user && (
            <Tabs defaultValue="signin" className="w-auto">
              <TabsList className="bg-muted">
                <TabsTrigger 
                  value="signin" 
                  onClick={() => navigate('/auth?tab=login')}
                  className="data-[state=active]:bg-background"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="register" 
                  onClick={() => navigate('/auth?tab=signup')}
                  className="data-[state=active]:bg-background"
                >
                  Register
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </header>

      {/* Hero - Centered content */}
      <main className="flex-1 flex items-center justify-center pb-20">
        <div className="text-center space-y-6">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            <span className="text-foreground">Net-Z</span>
            <span style={{ color: '#00d084' }}> Platform</span>
          </h1>
          <p className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight">
            {displayText}
            <span 
              className={`inline-block w-1 h-12 md:h-16 lg:h-20 bg-primary ml-1 align-middle ${
                isTypingComplete ? 'animate-pulse' : 'animate-pulse'
              }`}
            />
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-6 py-4 text-center text-muted-foreground text-sm">
        © {new Date().getFullYear()} Net-Z Platform. All Rights Reserved.
      </footer>
    </div>
  );
};

export default Index;

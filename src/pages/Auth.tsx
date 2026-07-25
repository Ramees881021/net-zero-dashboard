import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignupForm } from '@/components/auth/SignupForm';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { AlmacLogo } from '@/components/ui/AlmacLogo';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type AuthView = 'login' | 'signup' | 'forgot-password';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [view, setView] = useState<AuthView>(tabParam === 'signup' ? 'signup' : 'login');

  useEffect(() => {
    if (tabParam === 'signup') {
      setView('signup');
    } else if (tabParam === 'login') {
      setView('login');
    }
  }, [tabParam]);

  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <header className="w-full px-6 py-4 flex items-center justify-between">
          <a href="/">
            <AlmacLogo className="h-10" />
          </a>
          <button
            onClick={() => setView('login')}
            className="text-sm text-primary hover:underline"
          >
            Back to Sign In
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <ForgotPasswordForm onBack={() => setView('login')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="w-full px-6 py-4 flex items-center justify-between">
        <a href="/">
          <AlmacLogo className="h-10" />
        </a>
        <Tabs value={view} onValueChange={(v) => setView(v as AuthView)} className="w-auto">
          <TabsList className="bg-muted">
            <TabsTrigger value="login" className="data-[state=active]:bg-background">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" className="data-[state=active]:bg-background">
              Register
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {view === 'login' ? (
            <LoginForm 
              onSwitchToSignup={() => setView('signup')} 
              onForgotPassword={() => setView('forgot-password')} 
            />
          ) : (
            <SignupForm onSwitchToLogin={() => setView('login')} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;

import { createContext, useContext, useState, ReactNode } from 'react';

export type AppMode = 'business' | 'presenter';

interface ModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isPresenterMode: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export const ModeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<AppMode>('business');

  const isPresenterMode = mode === 'presenter';

  return (
    <ModeContext.Provider value={{ mode, setMode, isPresenterMode }}>
      {children}
    </ModeContext.Provider>
  );
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';
import { getCurrentEmployee } from '@/services/auth';

interface AuthContextType {
  currentUser: User | null;
  authError: string | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    // Client-side guard: if setup not complete, redirect to wizard (server should already redirect)
    const boot = (window as unknown as { frappe?: { boot?: { setup_complete?: boolean } } }).frappe?.boot;
    if (boot && !boot.setup_complete) {
      window.location.href = '/desk/setup-wizard';
      return;
    }
    const result = await getCurrentEmployee();
    setCurrentUser(result.user);
    setAuthError(result.error);
  };

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authError,
        isLoading,
        refetch: async () => {
          setIsLoading(true);
          await load();
          setIsLoading(false);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth-service';
import { onSessionExpired, ApiError } from '@/services/api-client';
import { tokenStore, vault } from '@/services/vault';
import type { PublicUser } from '@/types/auth';
import type { SignInStage } from '@/services/native-google-flow';
interface Auth { user: PublicUser | null; loading: boolean; error: unknown; signingIn:boolean;signInError:unknown; reload: () => Promise<void>; signIn: (onProgress?:(stage:SignInStage)=>void) => Promise<boolean>; logout: (all?: boolean) => Promise<void>; deleteAccount: () => Promise<void>; update: (user: PublicUser) => void }
const Context = createContext<Auth | null>(null);
export function AuthProvider({children}: {children: ReactNode}) {
  const [user,setUser] = useState<PublicUser|null>(null); const [loading,setLoading] = useState(true); const [error,setError] = useState<unknown>(null);
  const [signingIn,setSigningIn]=useState(false);const [signInError,setSignInError]=useState<unknown>(null);
  const cache = useQueryClient();
  const generation=useRef(0);
  const reload = useCallback(async () => {
    const current=++generation.current;
    setLoading(true); setError(null);
    try { const next=await tokenStore.read()?await authService.me():null; if(current===generation.current)setUser(next); }
    catch(err) { if(current===generation.current){if (!(err instanceof ApiError && err.status === 401)) setError(err); else setUser(null);} }
    finally { if(current===generation.current)setLoading(false); }
  },[]);
  useEffect(() => { void Promise.resolve().then(reload); return onSessionExpired(() => { generation.current++;setUser(null);setLoading(false);setError(null);cache.clear(); }); },[reload,cache]);
  const signIn = async (onProgress?:(stage:SignInStage)=>void) => {
    if(signingIn)throw new Error('Sign-in is already in progress.');
    const current=++generation.current;
    setSigningIn(true);setSignInError(null);
    try {
      const next=await authService.signIn(onProgress);
      if(!next)return false;
      if(current!==generation.current)throw new Error('Sign-in was interrupted. Please try again.');
      cache.clear();setUser(next);setError(null);
      return true;
    } catch(err) { setSignInError(err);throw err; }
    finally { setSigningIn(false); }
  };
  const logout = async (all = false) => {
    try { await authService.logout(all); }
    finally { try { await vault.clear(); } finally { cache.clear(); setUser(null); } }
  };
  const deleteAccount = async () => {
    await authService.deleteAccount();
    try { await vault.clear(); } finally { cache.clear(); setUser(null); }
  };
  const update=useCallback((next:PublicUser)=>setUser(current=>current?.id===next.id?next:current),[]);
  return <Context.Provider value={{user,loading,error,signingIn,signInError,reload,signIn,logout,deleteAccount,update}}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Missing auth provider'); return value; }

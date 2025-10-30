import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const ProfileContext = createContext(undefined);

export const ProfileProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      console.log('🔍 DEBUG ProfileContext: Fetching profile for user:', user.id);
      
      const { data, error } = await supabase.rpc('get_my_profile_info');

      console.log('🔍 DEBUG ProfileContext: Raw profile data from RPC:', data);
      
      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (data && data.length > 0) {
        const profileData = data[0];
        console.log('🔍 DEBUG ProfileContext: Profile data received:', profileData);
        
        // ✅ CORREÇÃO CRÍTICA: A stored procedure não retorna 'id', então usamos user.id
        const enhancedProfile = {
          ...profileData,
          id: user.id, // ✅ USA O user.id DO AUTH
          userId: user.id, // Para compatibilidade
          email: user.email,
          // A stored procedure retorna: full_name, role, estado, municipio
        };
        
        console.log('🔍 DEBUG ProfileContext: Enhanced profile:', enhancedProfile);
        setProfile(enhancedProfile);
      } else {
        console.log('🔍 DEBUG ProfileContext: No profile data found');
        // ✅ CORREÇÃO: Mesmo sem dados da RPC, criamos um perfil básico
        const basicProfile = {
          id: user.id,
          userId: user.id,
          email: user.email,
          role: 'coletor', // Default
          full_name: user.email
        };
        setProfile(basicProfile);
      }
    } catch (e) {
      console.error('Exception fetching profile:', e);
      // ✅ CORREÇÃO: Mesmo com erro, criamos perfil básico
      const basicProfile = {
        id: user?.id,
        userId: user?.id,
        email: user?.email,
        role: 'coletor',
        full_name: user?.email
      };
      setProfile(basicProfile);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [user, authLoading, fetchProfile]);

  const value = useMemo(() => ({
    profile,
    loading: authLoading || loading,
    refetchProfile: fetchProfile,
  }), [profile, authLoading, loading, fetchProfile]);

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
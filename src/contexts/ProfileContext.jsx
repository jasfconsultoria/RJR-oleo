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
      const { data, error } = await supabase.rpc('get_my_profile_info');

      if (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } else if (data && data.length > 0) {
        setProfile(data[0]);
      } else {
         setProfile(null);
      }
    } catch (e) {
      console.error('Exception fetching profile:', e);
      setProfile(null);
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
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MASTER_ACCOUNT_ID } from '@/hooks/useAdmin';

/**
 * Copies master account data to the current user on first login
 * via an edge function that bypasses RLS.
 */
export const useMasterDataCopy = (userId: string | undefined) => {
  const [ready, setReady] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (userId === MASTER_ACCOUNT_ID) {
      setReady(true);
      return;
    }

    const storageKey = `master_data_copied_${userId}`;
    if (localStorage.getItem(storageKey) === 'true') {
      setReady(true);
      return;
    }
    if (running.current) return;
    running.current = true;

    const copyIfNeeded = async () => {
      try {
        console.log('Calling copy-master-data edge function for user:', userId);
        const { data, error } = await supabase.functions.invoke('copy-master-data');
        
        if (error) {
          console.error('Edge function error:', error);
        } else {
          console.log('Copy master data result:', data);
          localStorage.setItem(storageKey, 'true');
        }
      } catch (err) {
        console.error('Error copying master data:', err);
      } finally {
        setReady(true);
      }
    };

    copyIfNeeded();
  }, [userId]);

  return ready;
};

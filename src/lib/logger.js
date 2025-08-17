import { supabase } from './customSupabaseClient';

export const logAction = async (action, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('Log attempt without a user session.');
      return;
    }

    const { error } = await supabase.from('logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      details,
    });

    if (error) {
      console.error('Error logging action:', error);
    }
  } catch (error) {
    console.error('Unexpected error in logAction:', error);
  }
};
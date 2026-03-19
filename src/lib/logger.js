import { supabase } from './customSupabaseClient';
import { getActiveEnvironment } from './getActiveEnvironment';

export const logAction = async (action, details = {}) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('Log attempt without a user session.');
      return;
    }

    // Busca o ambiente ativo para o usuário
    const env = await getActiveEnvironment(false, null, user.id);
    const environment = env?.tipo || 'producao';

    const { error } = await supabase.from('logs').insert({
      user_id: user.id,
      user_email: user.email,
      action,
      details,
      environment,
    });

    if (error) {
      console.error('Error logging action:', error);
    }
  } catch (error) {
    console.error('Unexpected error in logAction:', error);
  }
};
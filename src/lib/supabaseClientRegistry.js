import { createClient } from '@supabase/supabase-js';

// Cache global de instâncias do SupabaseClient para evitar o aviso "Multiple GoTrueClient instances"
// e garantir consistência na gestão de sessões.
const clientsCache = new Map();

/**
 * Cria ou retorna uma instância cacheada do SupabaseClient.
 * @param {string} supabaseUrl - URL do projeto Supabase
 * @param {string} supabaseKey - Chave (Anon ou Service Role)
 * @param {Object} options - Opções passadas para createClient
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getOrCreateSupabaseClient(supabaseUrl, supabaseKey, options = {}) {
    const cacheKey = supabaseUrl;

    // Se já temos a instância e não estamos forçando uma atualização crítica (como injeção de fetch)
    if (clientsCache.has(cacheKey)) {
        const cached = clientsCache.get(cacheKey);
        
        // Se o cliente cacheado não tem o custom fetch mas agora estamos tentando passar um,
        // precisamos recriar a instância.
        if (options?.global?.fetch && !cached.realFetchApplied) {
            console.log(`📡 [Registry] Recriando cliente para ${supabaseUrl} para aplicar custom fetch.`);
        } else {
            return cached;
        }
    }

    const client = createClient(supabaseUrl, supabaseKey, options);
    
    // Marcador interno para sabermos que o custom fetch foi aplicado nesta instância
    if (options?.global?.fetch) {
        client.realFetchApplied = true;
    }
    
    clientsCache.set(cacheKey, client);
    return client;
}

import { supabase } from './src/lib/customSupabaseClient.js';

async function check() {
    const { data: rotas, error: err1 } = await supabase
        .from('rotas')
        .select('*')
        .limit(10)
        .order('created_at', { ascending: false });

    console.log("ROTAS RECENTS:", JSON.stringify(rotas, null, 2));

    const specificId = rotas?.find(r => r.id.toLowerCase().startsWith('61f1d514'))?.id;
    if (specificId) {
        const { data: routeItems, error: err2 } = await supabase
            .from('rota_clientes')
            .select('*')
            .eq('rota_id', specificId);
        console.log("ITENS DA ROTA 61F1D514:", JSON.stringify(routeItems, null, 2));
    }
}

check();

// Script temporário para limpar funções register_payment duplicadas no banco
// Execute com: node fix_register_payment.mjs
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://itegudxajerdxhnhlqat.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWd1ZHhhamVyZHhobmhscWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODYzMjMsImV4cCI6MjA2OTQ2MjMyM30.7buIgCbI9iwOdd3OFVBxTjF-Yw48aqeX6HxozN53PtA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// SQL para limpar as versões duplicadas e recriar a correta
const sql = `
-- 1. Remover todas as versões duplicadas de register_payment
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text);
DROP FUNCTION IF EXISTS public.register_payment(uuid, numeric, date, text, text, integer, date, numeric);

-- 2. Recriar com a versão correta (com cast explícito no payment_method)
CREATE OR REPLACE FUNCTION public.register_payment(
    p_credito_debito_id UUID,
    p_paid_amount NUMERIC,
    p_payment_date DATE,
    p_payment_method TEXT,
    p_notes TEXT DEFAULT NULL,
    p_installment_number INTEGER DEFAULT NULL,
    p_due_date DATE DEFAULT NULL,
    p_expected_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    new_payment_id UUID;
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado.');
    END IF;

    INSERT INTO public.pagamento (credito_debito_id, paid_amount, payment_date, payment_method, notes, user_id)
    VALUES (p_credito_debito_id, p_paid_amount, p_payment_date, p_payment_method::public.payment_method, p_notes, current_user_id)
    RETURNING id INTO new_payment_id;

    RETURN jsonb_build_object('success', true, 'message', 'Pagamento registrado com sucesso.', 'payment_id', new_payment_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'message', 'Erro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

async function fixDatabase() {
    console.log('Conectando ao Supabase...');

    // Usa a função exec_sql se disponível, ou rpc
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Erro ao executar via exec_sql:', error.message);
        console.log('\n⚠️  Você precisa rodar o SQL manualmente no painel do Supabase.');
        console.log('Acesse: https://supabase.com/dashboard > SQL Editor');
        console.log('Cole e execute o conteúdo do arquivo: supabase/migrations/2100_fix_total_value_semantics.sql');
    } else {
        console.log('✅ Funções atualizadas com sucesso!', data);
    }
}

fixDatabase();

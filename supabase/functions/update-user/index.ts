import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify the user is authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    // Extract token from Authorization header
    const token = authHeader.replace('Bearer ', '');
    
    // Create a client to verify the user token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verify the token by getting the user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: authError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is an administrator
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'administrador') {
      return new Response(
        JSON.stringify({ error: 'User not allowed', code: 403, error_code: 'not_admin' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body', details: parseError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, userData } = requestBody;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userData || typeof userData !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid userData' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing user to preserve metadata
    let existingUserMetadata: Record<string, any> = {};
    let existingAppMetadata: Record<string, any> = {};
    
    try {
      const { data: existingUserData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
      
      if (!getUserError && existingUserData?.user) {
        const existingUser = existingUserData.user;
        existingUserMetadata = existingUser.user_metadata || {};
        existingAppMetadata = existingUser.app_metadata || {};
      }
    } catch (getUserErr) {
      console.warn('Could not get existing user, will use empty metadata:', getUserErr);
      // Continue anyway, we'll just use empty metadata
    }

    // Prepare update data for auth.users
    // Always include both user_metadata and app_metadata to avoid issues
    const updateData: any = {
      user_metadata: { ...existingUserMetadata },
      app_metadata: { ...existingAppMetadata }
    };

    // Update user_metadata (full_name)
    if (userData.full_name !== undefined && userData.full_name !== null) {
      updateData.user_metadata.full_name = String(userData.full_name);
    }

    // Update app_metadata (role, estado, municipio)
    if (userData.role !== undefined) {
      updateData.app_metadata.role = userData.role;
    }
    if (userData.estado !== undefined) {
      updateData.app_metadata.estado = userData.estado || null;
    }
    if (userData.municipio !== undefined) {
      updateData.app_metadata.municipio = userData.municipio || null;
    }

    // Check if there's anything meaningful to update
    const hasUserMetadataChange = userData.full_name !== undefined && userData.full_name !== null;
    const hasAppMetadataChange = userData.role !== undefined || 
                                userData.estado !== undefined || 
                                userData.municipio !== undefined;
    
    if (!hasUserMetadataChange && !hasAppMetadataChange) {
      return new Response(
        JSON.stringify({ error: 'No data to update', userData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Updating user:', userId, 'with data:', updateData);

    // Update the user using admin API
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

    if (error) {
      console.error('Error updating user:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Error updating user', 
          message: error.message,
          code: error.status || 500,
          details: error
        }),
        { status: error.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in update-user function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


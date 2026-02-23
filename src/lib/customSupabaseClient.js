import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = 'https://itegudxajerdxhnhlqat.supabase.co';
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWd1ZHhhamVyZHhobmhscWF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4ODYzMjMsImV4cCI6MjA2OTQ2MjMyM30.7buIgCbI9iwOdd3OFVBxTjF-Yw48aqeX6HxozN53PtA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
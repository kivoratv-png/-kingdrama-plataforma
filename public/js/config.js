// Endereço e chave pública do Supabase.
//
// A chave "anon" é feita para ficar no navegador — quem protege os dados são as
// regras de RLS do banco (supabase/01-schema.sql), não o sigilo desta chave.
// A chave "service_role" NUNCA entra aqui: ela ignora todas as regras e só pode
// viver como variável de ambiente no servidor.
window.__KD_CONFIG__ = {
  supabaseUrl: 'https://yvwdhuphzyjfhfsqdeho.supabase.co',
  supabaseAnonKey: 'sb_publishable_IQvvsvkAF1gtF1rp-f2ffQ_mf0hZNdi',
};

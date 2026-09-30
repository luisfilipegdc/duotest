// Configuração pública do site. NUNCA coloque a chave da Anthropic aqui:
// ela fica só no servidor (segredo ANTHROPIC_API_KEY da função gerar-trilha).
window.Duo = window.Duo || {};
Duo.Config = {
  // Endereço da função, ex.: https://SEU-PROJETO.supabase.co/functions/v1/gerar-trilha
  aiEndpoint: '',
  // Chave pública (anon/publishable) do Supabase — pode ficar no site.
  aiPublicKey: '',
};

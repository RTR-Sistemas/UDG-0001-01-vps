import { corsHeaders, createAdminClient } from './_shared.js';

/**
 * Recuperação de conta via Chave de Segurança (UDG).
 *
 * POST /.netlify/functions/auth-recover
 * Body:
 *   { action: "lookup", securityKey: "..." }
 *     -> valida a chave e retorna { ok, email, registrationNumber, hasProfile }
 *   { action: "reset", securityKey: "...", newPassword: "..." }
 *     -> valida a chave e redefine a senha do usuário (admin API)
 */
export async function handler(event) {
  const headers = corsHeaders('POST, OPTIONS');
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const securityKey = String(body.securityKey || '').trim();
  if (!securityKey) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Informe a chave de segurança.' }) };
  }

  const action = body.action === 'reset' ? 'reset' : 'lookup';

  try {
    // 1) Localiza a chave na tabela privada
    const { data: keyRow, error: keyError } = await supabaseAdmin
      .from('account_security_keys')
      .select('user_id')
      .eq('security_key', securityKey)
      .maybeSingle();

    if (keyError) throw keyError;
    if (!keyRow) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Chave de segurança inválida ou não encontrada.' }) };
    }

    // 2) Busca o usuário auth correspondente
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(keyRow.user_id);
    if (userError || !authUser?.user) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Conta não encontrada para esta chave.' }) };
    }

    // 3) Dados públicos do perfil (número do selo)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('username, registration_number')
      .eq('id', keyRow.user_id)
      .maybeSingle();

    if (action === 'reset') {
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 6) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'A nova senha deve ter pelo menos 6 caracteres.' }) };
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(keyRow.user_id, {
        password: newPassword,
      });
      if (updateError) throw updateError;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          action: 'reset',
          message: 'Senha redefinida com sucesso. Use a nova senha para entrar.',
          email: authUser.user.email,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        action: 'lookup',
        email: authUser.user.email,
        username: profile?.username || null,
        registrationNumber: profile?.registration_number ?? null,
        message: 'Chave válida. Conta encontrada.',
      }),
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message || 'Erro ao recuperar conta' }) };
  }
}

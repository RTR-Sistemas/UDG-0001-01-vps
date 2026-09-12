/* ===========================================================================
   CONSOLIDADO EM 06/09/2026.

   Existiam DOIS arquivos com o mesmo carimbo de tempo
   (20260906120000_pq_key_binding.sql e ..._pq_key_binding-1.sql), com
   conteudos diferentes. O CLI aplicaria os dois, em ordem indefinida, ou
   falharia - justamente na migracao do binding de chave, que e a peca que
   sustenta a promessa de seguranca do aplicativo.

   Este arquivo e a versao boa (a que tem as verificacoes de pre-requisito e
   so caracteres ASCII). O outro virou um arquivo vazio de propriedade, que
   nao executa nada.
   =========================================================================== */

/* ===========================================================================
   UndoinG - Criptografia pos-quantica: registro de chaves publicas

   COMO RODAR
     Opcao A (recomendada):  supabase db push
     Opcao B:                copie ESTE arquivo inteiro e cole no SQL Editor

   NOTA SOBRE COMENTARIOS
     Este arquivo usa apenas comentarios de bloco e caracteres ASCII.
     Comentarios de linha (os de duplo hifen) somem quando o texto passa
     por alguns editores e visualizadores; o banco entao tenta executar o
     texto do comentario. Foi exatamente o erro:
       syntax error at or near "UndoinG"
     Por isso nao existe nenhum duplo hifen neste arquivo.

   O QUE ESTE ARQUIVO FAZ
     1. profiles.pq_mldsa_sig      - assinatura de binding (o item central)
     2. profiles.pq_keys_updated_at - carimbo de rotacao, via trigger
     3. indice parcial de quem ja ativou a criptografia
     4. messages.is_pq_encrypted e messages.pq_signature

   POR QUE O BINDING IMPORTA
     Sem ele, um servidor comprometido poderia trocar a chave ML-KEM de
     alguem pela sua e ler tudo. Com ele, trocar a chave KEM exige trocar
     tambem a identidade ML-DSA, e ai o codigo de seguranca que o usuario
     ve na tela muda - o ataque fica visivel.

   E IDEMPOTENTE: rodar duas vezes nao quebra nada.
   =========================================================================== */


/* ==========================================================================
   PASSO 0: conferir que as tabelas esperadas existem.
   Se faltar alguma, para aqui com uma mensagem clara em vez de um erro
   confuso no meio da execucao.
   ========================================================================== */

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception
      'Tabela public.profiles nao encontrada. Rode as migracoes anteriores antes desta.';
  end if;
  if to_regclass('public.messages') is null then
    raise exception
      'Tabela public.messages nao encontrada. Rode as migracoes anteriores antes desta.';
  end if;
end $$;


/* ==========================================================================
   PASSO 1: chaves publicas no perfil
   ========================================================================== */

alter table public.profiles
  add column if not exists pq_mldsa_pubkey    text,
  add column if not exists pq_mlkem_pubkey    text,
  add column if not exists pq_mldsa_sig       text,
  add column if not exists pq_keys_updated_at timestamptz;

comment on column public.profiles.pq_mldsa_pubkey is
  'Chave publica ML-DSA-65 (FIPS 204) em base64url. Ancora de identidade: o codigo de seguranca que o usuario compara e o hash dela.';

comment on column public.profiles.pq_mlkem_pubkey is
  'Chave publica ML-KEM-768 (FIPS 203) em base64url. Usada para encapsular a raiz de sessao.';

comment on column public.profiles.pq_mldsa_sig is
  'Assinatura ML-DSA-65 sobre o dominio de binding concatenado com a chave ML-KEM. Prova que as duas chaves sao da mesma identidade.';

comment on column public.profiles.pq_keys_updated_at is
  'Momento da ultima rotacao de chaves, mantido por trigger.';


/* ==========================================================================
   PASSO 2: sanidade de tamanho

   Nao valida criptografia (isso e papel do cliente), so barra lixo obvio.
   Em base64url: ML-DSA pub = 2603 chars, ML-KEM pub = 1579, assinatura = 4412.
   Criada como NOT VALID para nao travar em linhas antigas; valide depois com
     alter table public.profiles validate constraint profiles_pq_key_lengths_chk;
   ========================================================================== */

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_pq_key_lengths_chk'
  ) then
    alter table public.profiles
      add constraint profiles_pq_key_lengths_chk check (
        (pq_mldsa_pubkey is null or length(pq_mldsa_pubkey) between 2000 and 3000)
        and (pq_mlkem_pubkey is null or length(pq_mlkem_pubkey) between 1400 and 2000)
        and (pq_mldsa_sig   is null or length(pq_mldsa_sig)   between 4000 and 5000)
      ) not valid;
  end if;
end $$;


/* ==========================================================================
   PASSO 3: carimbo automatico de rotacao
   ========================================================================== */

create or replace function public.touch_pq_keys_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  if new.pq_mldsa_pubkey is distinct from old.pq_mldsa_pubkey
     or new.pq_mlkem_pubkey is distinct from old.pq_mlkem_pubkey
     or new.pq_mldsa_sig is distinct from old.pq_mldsa_sig then
    new.pq_keys_updated_at := now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists profiles_touch_pq_keys on public.profiles;

create trigger profiles_touch_pq_keys
  before update on public.profiles
  for each row
  execute function public.touch_pq_keys_updated_at();


/* ==========================================================================
   PASSO 4: indice de quem ja tem criptografia ativa
   ========================================================================== */

create index if not exists profiles_pq_ready_idx
  on public.profiles (id)
  where pq_mlkem_pubkey is not null
    and pq_mldsa_pubkey is not null
    and pq_mldsa_sig is not null;


/* ==========================================================================
   PASSO 5: colunas na tabela de mensagens
   ========================================================================== */

alter table public.messages
  add column if not exists is_pq_encrypted boolean not null default false,
  add column if not exists pq_signature    text;

comment on column public.messages.is_pq_encrypted is
  'true quando content e um envelope "pq1." opaco. O backend usa isto para nunca colocar o conteudo em uma notificacao push.';

create index if not exists messages_pq_encrypted_idx
  on public.messages (conversation_id)
  where is_pq_encrypted = true;


/* ==========================================================================
   NOTA SOBRE RLS

   As chaves PUBLICAS precisam ser legiveis por qualquer usuario autenticado
   (e assim que uma pessoa cifra para outra) e gravaveis apenas pelo dono
   (auth.uid() = id). Isso ja e garantido pelas policies existentes de
   profiles. Este arquivo nao afrouxa nenhuma delas.

   Se a sua instalacao tiver policies de select mais restritas, basta garantir
   que as tres colunas pq_ sejam legiveis - sem isso, ninguem consegue cifrar
   para ninguem.
   ========================================================================== */

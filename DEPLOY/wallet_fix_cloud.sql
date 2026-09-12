-- Undoing App - CORRECAO DA CARTEIRA (projeto cloud ipmldkprqdhybedhpgmt)
-- Erro: "[WalletContext] refresh falhou" - as funcoes get_user_coins /
-- get_user_diamonds sao STABLE mas executam INSERT, e o Postgres rejeita
-- ("INSERT is not allowed in a non-volatile function"). Solucao: VOLATILE.
-- Execute este bloco inteiro no Dashboard -> SQL Editor.

DROP FUNCTION IF EXISTS public.get_user_coins(uuid);
DROP FUNCTION IF EXISTS public.get_user_diamonds(uuid);

CREATE FUNCTION public.get_user_coins(p_user_id uuid DEFAULT auth.uid())
 RETURNS user_coins
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.user_coins;
begin
  if p_user_id is null or p_user_id <> auth.uid() then return null; end if;
  select * into v_row from public.user_coins where user_id = p_user_id;
  if not found then
    insert into public.user_coins (user_id) values (p_user_id) returning * into v_row;
  end if;
  return v_row;
end $function$;

CREATE FUNCTION public.get_user_diamonds(p_user_id uuid DEFAULT auth.uid())
 RETURNS user_diamonds
 LANGUAGE plpgsql
 VOLATILE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row public.user_diamonds;
begin
  if p_user_id is null or p_user_id <> auth.uid() then return null; end if;
  select * into v_row from public.user_diamonds where user_id = p_user_id;
  if not found then
    insert into public.user_diamonds (user_id) values (p_user_id) returning * into v_row;
  end if;
  return v_row;
end $function$;
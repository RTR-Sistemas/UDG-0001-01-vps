/* Conferencia do binding de chave pos-quantica.
   Rode no SQL Editor. Todas as linhas devem vir com ok = true. */

select 'profiles.pq_mldsa_pubkey'    as item,
       to_regclass('public.profiles') is not null
       and exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name='profiles'
                     and column_name='pq_mldsa_pubkey') as ok
union all
select 'profiles.pq_mlkem_pubkey',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='profiles'
                 and column_name='pq_mlkem_pubkey')
union all
select 'profiles.pq_mldsa_sig',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='profiles'
                 and column_name='pq_mldsa_sig')
union all
select 'profiles.pq_keys_updated_at',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='profiles'
                 and column_name='pq_keys_updated_at')
union all
select 'messages.is_pq_encrypted',
       exists (select 1 from information_schema.columns
               where table_schema='public' and table_name='messages'
                 and column_name='is_pq_encrypted')
union all
select 'trigger profiles_touch_pq_keys',
       exists (select 1 from pg_trigger
               where tgname='profiles_touch_pq_keys' and not tgisinternal);

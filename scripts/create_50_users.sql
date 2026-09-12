-- UDG Social - seed dos 50 usuarios de teste
-- Rode no Supabase Dashboard (SQL Editor) ou cole no painel admin localhost.
-- Idempotente: pode rodar quantas vezes quiser.
-- Senha padrao de todos os usuarios: Udg#Teste2026

DO $$
DECLARE
  v_id uuid;
  v_email text;
  v_username text;
  v_full_name text;
  v_birth text;
  v_meta jsonb;
BEGIN
  v_email := 'marinasouza@udgtest.com';
  v_username := 'marina.souza';
  v_full_name := 'Marina Souza';
  v_birth := '1994-03-12';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'leticiaalmeida@udgtest.com';
  v_username := 'leticia.almeida';
  v_full_name := 'Letícia Almeida';
  v_birth := '1996-07-02';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'camilarocha@udgtest.com';
  v_username := 'camila.rocha';
  v_full_name := 'Camila Rocha';
  v_birth := '1993-11-24';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'beatrizlima@udgtest.com';
  v_username := 'beatriz.lima';
  v_full_name := 'Beatriz Lima';
  v_birth := '1998-01-16';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'isabelamartins@udgtest.com';
  v_username := 'isabela.martins';
  v_full_name := 'Isabela Martins';
  v_birth := '1992-05-30';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'fernandacosta@udgtest.com';
  v_username := 'fernanda.costa';
  v_full_name := 'Fernanda Costa';
  v_birth := '1995-09-08';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'julianapereira@udgtest.com';
  v_username := 'juliana.pereira';
  v_full_name := 'Juliana Pereira';
  v_birth := '1999-12-19';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'larissasantos@udgtest.com';
  v_username := 'larissa.santos';
  v_full_name := 'Larissa Santos';
  v_birth := '1991-04-27';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'amandaoliveira@udgtest.com';
  v_username := 'amanda.oliveira';
  v_full_name := 'Amanda Oliveira';
  v_birth := '1997-08-14';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'patriciabarbosa@udgtest.com';
  v_username := 'patricia.barbosa';
  v_full_name := 'Patrícia Barbosa';
  v_birth := '1990-02-05';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'renataribeiro@udgtest.com';
  v_username := 'renata.ribeiro';
  v_full_name := 'Renata Ribeiro';
  v_birth := '1996-10-21';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'vanessacarvalho@udgtest.com';
  v_username := 'vanessa.carvalho';
  v_full_name := 'Vanessa Carvalho';
  v_birth := '1993-06-11';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'tatianegomes@udgtest.com';
  v_username := 'tatiane.gomes';
  v_full_name := 'Tatiane Gomes';
  v_birth := '1998-03-03';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'nataliamendes@udgtest.com';
  v_username := 'natalia.mendes';
  v_full_name := 'Natália Mendes';
  v_birth := '1995-12-01';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'carolinafarias@udgtest.com';
  v_username := 'carolina.farias';
  v_full_name := 'Carolina Farias';
  v_birth := '1992-08-19';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'gabrielanunes@udgtest.com';
  v_username := 'gabriela.nunes';
  v_full_name := 'Gabriela Nunes';
  v_birth := '2000-01-25';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'thaiscardoso@udgtest.com';
  v_username := 'thais.cardoso';
  v_full_name := 'Thaís Cardoso';
  v_birth := '1994-07-07';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'jaquelinefreitas@udgtest.com';
  v_username := 'jaqueline.freitas';
  v_full_name := 'Jaqueline Freitas';
  v_birth := '1997-02-28';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'alinemoraes@udgtest.com';
  v_username := 'aline.moraes';
  v_full_name := 'Aline Moraes';
  v_birth := '1991-10-09';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'danielapires@udgtest.com';
  v_username := 'daniela.pires';
  v_full_name := 'Daniela Pires';
  v_birth := '1996-04-04';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'sabrinateles@udgtest.com';
  v_username := 'sabrina.teles';
  v_full_name := 'Sabrina Teles';
  v_birth := '1993-09-17';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'priscilaramos@udgtest.com';
  v_username := 'priscila.ramos';
  v_full_name := 'Priscila Ramos';
  v_birth := '1999-06-30';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'monicaduarte@udgtest.com';
  v_username := 'monica.duarte';
  v_full_name := 'Mônica Duarte';
  v_birth := '1990-12-12';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'raquelferreira@udgtest.com';
  v_username := 'raquel.ferreira';
  v_full_name := 'Raquel Ferreira';
  v_birth := '1995-05-05';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'biancamoreira@udgtest.com';
  v_username := 'bianca.moreira';
  v_full_name := 'Bianca Moreira';
  v_birth := '1998-11-11';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'gabrieloliveira@udgtest.com';
  v_username := 'gabriel.oliveira';
  v_full_name := 'Gabriel Oliveira';
  v_birth := '1993-04-17';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'lucasalmeida@udgtest.com';
  v_username := 'lucas.almeida';
  v_full_name := 'Lucas Almeida';
  v_birth := '1996-08-08';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'rafaelsantos@udgtest.com';
  v_username := 'rafael.santos';
  v_full_name := 'Rafael Santos';
  v_birth := '1992-11-03';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'felipecosta@udgtest.com';
  v_username := 'felipe.costa';
  v_full_name := 'Felipe Costa';
  v_birth := '1995-01-21';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'matheuslima@udgtest.com';
  v_username := 'matheus.lima';
  v_full_name := 'Matheus Lima';
  v_birth := '1998-09-09';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'pedromartins@udgtest.com';
  v_username := 'pedro.martins';
  v_full_name := 'Pedro Henrique Martins';
  v_birth := '1991-07-13';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'joaorocha@udgtest.com';
  v_username := 'joao.rocha';
  v_full_name := 'João Pedro Rocha';
  v_birth := '1999-03-27';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'gustavopereira@udgtest.com';
  v_username := 'gustavo.pereira';
  v_full_name := 'Gustavo Pereira';
  v_birth := '1994-10-10';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'andrecarvalho@udgtest.com';
  v_username := 'andre.carvalho';
  v_full_name := 'André Carvalho';
  v_birth := '1990-02-02';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'diegonunes@udgtest.com';
  v_username := 'diego.nunes';
  v_full_name := 'Diego Nunes';
  v_birth := '1997-05-19';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'brunoribeiro@udgtest.com';
  v_username := 'bruno.ribeiro';
  v_full_name := 'Bruno Ribeiro';
  v_birth := '1993-12-05';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'thiagocardoso@udgtest.com';
  v_username := 'thiago.cardoso';
  v_full_name := 'Thiago Cardoso';
  v_birth := '1996-06-16';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'marcelofreitas@udgtest.com';
  v_username := 'marcelo.freitas';
  v_full_name := 'Marcelo Freitas';
  v_birth := '1992-09-25';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'viniciusmoraes@udgtest.com';
  v_username := 'vinicius.moraes';
  v_full_name := 'Vinícius Moraes';
  v_birth := '1995-04-02';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'eduardopires@udgtest.com';
  v_username := 'eduardo.pires';
  v_full_name := 'Eduardo Pires';
  v_birth := '1998-12-23';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'caioteles@udgtest.com';
  v_username := 'caio.teles';
  v_full_name := 'Caio Teles';
  v_birth := '1994-05-15';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'icaroramos@udgtest.com';
  v_username := 'icaro.ramos';
  v_full_name := 'Ícaro Ramos';
  v_birth := '1997-07-07';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'henriqueduarte@udgtest.com';
  v_username := 'henrique.duarte';
  v_full_name := 'Henrique Duarte';
  v_birth := '1991-01-31';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'pauloferreira@udgtest.com';
  v_username := 'paulo.ferreira';
  v_full_name := 'Paulo Ferreira';
  v_birth := '1996-03-08';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'ricardomoreira@udgtest.com';
  v_username := 'ricardo.moreira';
  v_full_name := 'Ricardo Moreira';
  v_birth := '1993-08-29';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'leandrobarbosa@udgtest.com';
  v_username := 'leandro.barbosa';
  v_full_name := 'Leandro Barbosa';
  v_birth := '1999-10-19';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'fabiogomes@udgtest.com';
  v_username := 'fabio.gomes';
  v_full_name := 'Fábio Gomes';
  v_birth := '1992-06-06';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'renanfarias@udgtest.com';
  v_username := 'renan.farias';
  v_full_name := 'Renan Farias';
  v_birth := '1995-11-11';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'otavionascimento@udgtest.com';
  v_username := 'otavio.nascimento';
  v_full_name := 'Otávio Nascimento';
  v_birth := '1990-04-04';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;

  v_email := 'wesleyaraujo@udgtest.com';
  v_username := 'wesley.araujo';
  v_full_name := 'Wesley Araújo';
  v_birth := '1997-02-14';
  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(), 'authenticated', 'authenticated', v_email,
      crypt('Udg#Teste2026', gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      v_meta,
      now(), now(), now(), '', ''
    ) RETURNING id INTO v_id;

    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_email, v_id,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name),
      'email', now(), now(), now()
    );
  END IF;
END $$;

-- amizade bidirecional entre todos os bots (necessario p/ votar/curtir na Arena)
INSERT INTO friendships (user_id, friend_id)
SELECT a.id, b.id
FROM profiles a
JOIN profiles b ON b.id <> a.id
WHERE a.username IN ('marina.souza', 'leticia.almeida', 'camila.rocha', 'beatriz.lima', 'isabela.martins', 'fernanda.costa', 'juliana.pereira', 'larissa.santos', 'amanda.oliveira', 'patricia.barbosa', 'renata.ribeiro', 'vanessa.carvalho', 'tatiane.gomes', 'natalia.mendes', 'carolina.farias', 'gabriela.nunes', 'thais.cardoso', 'jaqueline.freitas', 'aline.moraes', 'daniela.pires', 'sabrina.teles', 'priscila.ramos', 'monica.duarte', 'raquel.ferreira', 'bianca.moreira', 'gabriel.oliveira', 'lucas.almeida', 'rafael.santos', 'felipe.costa', 'matheus.lima', 'pedro.martins', 'joao.rocha', 'gustavo.pereira', 'andre.carvalho', 'diego.nunes', 'bruno.ribeiro', 'thiago.cardoso', 'marcelo.freitas', 'vinicius.moraes', 'eduardo.pires', 'caio.teles', 'icaro.ramos', 'henrique.duarte', 'paulo.ferreira', 'ricardo.moreira', 'leandro.barbosa', 'fabio.gomes', 'renan.farias', 'otavio.nascimento', 'wesley.araujo')
AND b.username IN ('marina.souza', 'leticia.almeida', 'camila.rocha', 'beatriz.lima', 'isabela.martins', 'fernanda.costa', 'juliana.pereira', 'larissa.santos', 'amanda.oliveira', 'patricia.barbosa', 'renata.ribeiro', 'vanessa.carvalho', 'tatiane.gomes', 'natalia.mendes', 'carolina.farias', 'gabriela.nunes', 'thais.cardoso', 'jaqueline.freitas', 'aline.moraes', 'daniela.pires', 'sabrina.teles', 'priscila.ramos', 'monica.duarte', 'raquel.ferreira', 'bianca.moreira', 'gabriel.oliveira', 'lucas.almeida', 'rafael.santos', 'felipe.costa', 'matheus.lima', 'pedro.martins', 'joao.rocha', 'gustavo.pereira', 'andre.carvalho', 'diego.nunes', 'bruno.ribeiro', 'thiago.cardoso', 'marcelo.freitas', 'vinicius.moraes', 'eduardo.pires', 'caio.teles', 'icaro.ramos', 'henrique.duarte', 'paulo.ferreira', 'ricardo.moreira', 'leandro.barbosa', 'fabio.gomes', 'renan.farias', 'otavio.nascimento', 'wesley.araujo')
ON CONFLICT DO NOTHING;

INSERT INTO followers (follower_id, following_id)
SELECT a.id, b.id
FROM profiles a
JOIN profiles b ON b.id <> a.id
WHERE a.username IN ('marina.souza', 'leticia.almeida', 'camila.rocha', 'beatriz.lima', 'isabela.martins', 'fernanda.costa', 'juliana.pereira', 'larissa.santos', 'amanda.oliveira', 'patricia.barbosa', 'renata.ribeiro', 'vanessa.carvalho', 'tatiane.gomes', 'natalia.mendes', 'carolina.farias', 'gabriela.nunes', 'thais.cardoso', 'jaqueline.freitas', 'aline.moraes', 'daniela.pires', 'sabrina.teles', 'priscila.ramos', 'monica.duarte', 'raquel.ferreira', 'bianca.moreira', 'gabriel.oliveira', 'lucas.almeida', 'rafael.santos', 'felipe.costa', 'matheus.lima', 'pedro.martins', 'joao.rocha', 'gustavo.pereira', 'andre.carvalho', 'diego.nunes', 'bruno.ribeiro', 'thiago.cardoso', 'marcelo.freitas', 'vinicius.moraes', 'eduardo.pires', 'caio.teles', 'icaro.ramos', 'henrique.duarte', 'paulo.ferreira', 'ricardo.moreira', 'leandro.barbosa', 'fabio.gomes', 'renan.farias', 'otavio.nascimento', 'wesley.araujo')
AND b.username IN ('marina.souza', 'leticia.almeida', 'camila.rocha', 'beatriz.lima', 'isabela.martins', 'fernanda.costa', 'juliana.pereira', 'larissa.santos', 'amanda.oliveira', 'patricia.barbosa', 'renata.ribeiro', 'vanessa.carvalho', 'tatiane.gomes', 'natalia.mendes', 'carolina.farias', 'gabriela.nunes', 'thais.cardoso', 'jaqueline.freitas', 'aline.moraes', 'daniela.pires', 'sabrina.teles', 'priscila.ramos', 'monica.duarte', 'raquel.ferreira', 'bianca.moreira', 'gabriel.oliveira', 'lucas.almeida', 'rafael.santos', 'felipe.costa', 'matheus.lima', 'pedro.martins', 'joao.rocha', 'gustavo.pereira', 'andre.carvalho', 'diego.nunes', 'bruno.ribeiro', 'thiago.cardoso', 'marcelo.freitas', 'vinicius.moraes', 'eduardo.pires', 'caio.teles', 'icaro.ramos', 'henrique.duarte', 'paulo.ferreira', 'ricardo.moreira', 'leandro.barbosa', 'fabio.gomes', 'renan.farias', 'otavio.nascimento', 'wesley.araujo')
ON CONFLICT DO NOTHING;

#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { users } = require("../bots/users");

const header = [
  "-- UDG Social - seed dos 50 usuarios de teste",
  "-- Rode no Supabase Dashboard (SQL Editor) ou cole no painel admin localhost.",
  "-- Idempotente: pode rodar quantas vezes quiser.",
  "-- Senha padrao de todos os usuarios: Udg#Teste2026",
  "",
  "DO $$",
  "DECLARE",
  "  v_id uuid;",
  "  v_email text;",
  "  v_username text;",
  "  v_full_name text;",
  "  v_birth text;",
  "  v_meta jsonb;",
  "BEGIN"
].join("\n");

const rows = users
  .map((u) => {
    return [
      "",
      "  v_email := '" + u.email + "';",
      "  v_username := '" + u.username + "';",
      "  v_full_name := '" + u.name + "';",
      "  v_birth := '" + u.birth + "';",
      "  v_meta := jsonb_build_object('username', v_username, 'full_name', v_full_name, 'birth_date', v_birth, 'birth_date_public', true);",
      "",
      "  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN",
      "    INSERT INTO auth.users (",
      "      instance_id, id, aud, role, email,",
      "      encrypted_password, email_confirmed_at,",
      "      raw_app_meta_data, raw_user_meta_data,",
      "      created_at, updated_at, last_sign_in_at, confirmation_token, recovery_token",
      "    ) VALUES (",
      "      '00000000-0000-0000-0000-000000000000',",
      "      gen_random_uuid(), 'authenticated', 'authenticated', v_email,",
      "      crypt('" + u.password + "', gen_salt('bf', 10)),",
      "      now(),",
      "      '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,",
      "      v_meta,",
      "      now(), now(), now(), '', ''",
      "    ) RETURNING id INTO v_id;",
      "",
      "    INSERT INTO auth.identities (",
      "      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at",
      "    ) VALUES (",
      "      v_email, v_id,",
      "      jsonb_build_object('sub', v_id::text, 'email', v_email, 'username', v_username, 'full_name', v_full_name)," ,
      "      'email', now(), now(), now()",
      "    );",
      "  END IF;"
    ].join("\n");
  })
  .join("\n");

const tail = [
  "",
  "END $$;",
  "",
  "-- amizade bidirecional entre todos os bots (necessario p/ votar/curtir na Arena)",
  "INSERT INTO friendships (user_id, friend_id)",
  "SELECT a.id, b.id",
  "FROM profiles a",
  "JOIN profiles b ON b.id <> a.id",
  "WHERE a.username IN (" +
    users.map((u) => "'" + u.username + "'").join(", ") +
    ")",
  "AND b.username IN (" +
    users.map((u) => "'" + u.username + "'").join(", ") +
    ")",
  "ON CONFLICT DO NOTHING;",
  "",
  "INSERT INTO followers (follower_id, following_id)",
  "SELECT a.id, b.id",
  "FROM profiles a",
  "JOIN profiles b ON b.id <> a.id",
  "WHERE a.username IN (" +
    users.map((u) => "'" + u.username + "'").join(", ") +
    ")",
  "AND b.username IN (" +
    users.map((u) => "'" + u.username + "'").join(", ") +
    ")",
  "ON CONFLICT DO NOTHING;",
  ""
].join("\n");

const out = header + rows + tail;
const dest = path.join(__dirname, "..", "scripts", "create_50_users.sql");
fs.writeFileSync(dest, out, "utf8");
console.log("gerado:", dest, `(${out.length} bytes, ${users.length} usuarios)`);
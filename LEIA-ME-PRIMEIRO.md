# UndoinG — repositório novo: os 3 passos que faltam

Esta pasta é o projeto limpo. Ela **não tem histórico antigo** — e é justamente
esse o ponto: o repositório anterior carregava a senha de root do VPS em texto
claro, em todos os commits desde sempre. Aqui ela não existe.

A pasta antiga (`UDG-MASTER`) continua onde estava, intacta. Não apague nada —
nem ela, nem o repositório antigo no GitHub — até o site novo estar no ar e
funcionando.

Quando estiver tudo certo, vale **arquivar ou apagar o repositório antigo**
no GitHub. Enquanto ele existir, a senha antiga continua acessível no histórico
dele para quem tiver acesso.

---

## Passo 1 — Trocar a senha de root do VPS

**Faça isto antes de qualquer outra coisa.**

A senha antiga esteve no GitHub, dentro de `.github/workflows/deploy.yml`, em
todo commit do repositório anterior. Mesmo que o repositório seja privado,
mesmo que você apague o repositório, ela deve ser considerada vazada: qualquer
clone, fork ou backup ainda a tem.

Enquanto ela não for trocada, nada do resto importa. Quem tem root no servidor
lê todas as mensagens, e aí a criptografia pós-quântica não protege ninguém.

No VPS:

```bash
passwd root
```

Aproveite e feche o login por senha, que é o caminho por onde o vazamento
viraria invasão:

```bash
# /etc/ssh/sshd_config
PermitRootLogin prohibit-password
PasswordAuthentication no
```

> Só desligue o login por senha **depois** de ter chave SSH funcionando, senão
> você se tranca do lado de fora. Se ainda não tem chave, deixe este segundo
> item para depois — trocar a senha já resolve o urgente.

---

## Passo 2 — Commit e push pelo GitHub Desktop

Esta pasta já está ligada ao repositório
`RTR-Sistemas/UDG-0001-01-vps`. Não precisa de `git init` nem de
`git remote add` — já está tudo configurado.

Abra o **GitHub Desktop**. Ele vai mostrar os arquivos novos. Escreva a
mensagem do commit, clique em **Commit to main** e depois em **Push origin**.

Antes de commitar, dê uma olhada na lista de arquivos. Se aparecer
`DEPLOY/vps.local.ps1`, `.env` (sem o `.production`) ou `run_sql.json`,
**não commite** — esses têm segredo. O script avisa se algum passar, mas
conferir com o olho não custa nada.

---

## Passo 3 — Cadastrar 3 segredos no repositório NOVO

Os segredos não vêm junto com o código — eles ficam na configuração do
repositório, e o repositório é outro agora. Então precisam ser criados de novo.

No GitHub, em `RTR-Sistemas/UDG-0001-01-vps`: **Settings → Secrets and
variables → Actions → New repository secret**. Crie os três:

| Nome | Valor |
|---|---|
| `VPS_HOST` | o IP ou domínio do servidor |
| `VPS_USER` | `root` (ou, melhor, um usuário `deploy` dedicado) |
| `VPS_PASSWORD` | a senha **nova**, do Passo 1 |

Sem os três, o deploy falha logo na primeira etapa, com mensagem clara. É de
propósito: melhor falhar do que publicar com credencial exposta.

---

## Passo 4 — Conferir que subiu de verdade

Depois do push, o GitHub Actions roda sozinho (uns 3 minutos).

1. **Aba Actions** do repositório: o job tem que ficar verde.
2. Abra `https://udgservidor.online/build.json`. A data em `builtAt` tem que
   ser a de **hoje**.

Se a data continuar antiga, o rsync não chegou no servidor — o próprio
workflow avisa isso no log, no último passo.

3. No celular, feche e abra o aplicativo. O service worker checa atualização a
   cada 60 segundos e mostra o aviso.

---

# O que mudou em relação ao repositório antigo

**O VPS não precisa de nenhuma mudança.** Conferi: nada no projeto aponta para
a URL do repositório, e o deploy é por `rsync` — o servidor nunca fala com o
GitHub. Trocar de repositório não afeta nada lá dentro.

**O workflow agora envia as `netlify/functions/`.** O antigo mandava só `dist/`
e `public/`, então o backend ficava parado na versão do último envio manual.
Era por isso que a notificação de mensagem nova aparecia mostrando o texto
cifrado cru: a correção existia no código, mas a função velha continuava
rodando no servidor.

**O `.env.production` veio junto, de propósito.** Ele só tem valores públicos —
a URL do Supabase, a chave `anon` e o App ID do Agora. Os três terminam dentro
do JavaScript que qualquer visitante baixa, então escondê-los não protegeria
nada, e o build precisa deles: sem esse arquivo o site sobe sem conseguir falar
com o banco. Quem protege o banco é o RLS, não o sigilo da chave `anon`.

A `service_role key` e a chave VAPID privada **não** estão aqui. Elas vivem em
`/opt/undoing/.env`, no servidor, e é onde devem ficar.

**O `DEPLOY/server.mjs` agora é versionado.** Ele estava no `.gitignore` por
engano, junto com os scripts que têm token. Não tem segredo nenhum (só lê
`process.env.PORT`) e é o processo que o `undoing.service` executa:

```
ExecStart=/usr/bin/node --import tsx /opt/undoing/deploy/server.mjs
```

Sem ele versionado, um servidor novo simplesmente não sobe.

---

# O que ficou de fora

Nada disso é necessário para o sistema funcionar:

- `node_modules/`, `dist/` — refeitos por `npm install` e `npm run build`
- `.git/` antigo — o histórico com a senha
- `DEPLOY/functions-build/` e `DEPLOY/netlify/` (~50 MB) — funções já
  empacotadas, geradas de `netlify/functions/`
- `DEPLOY/models/`, `icons/`, `sounds/`, ícones, `index.html`, `sw.js` — cópias
  do que já está em `public/`
- `public/models/` (13 MB) — recriado a cada `npm install` pelo
  `scripts/copy-face-models.mjs`
- 15 arquivos `.bak` e 4 imagens sem nenhuma referência no código
- `src/sql/`, `supabase/legacy_pending/`, `NAOENVIAR/`
- `DEPLOY/vps.local.ps1` e `run_sql.*` — esses têm segredo

**Depois do primeiro clone em outra máquina**, para o `deploy_vps.ps1` voltar a
funcionar, rode uma vez:

```powershell
.\DEPLOY\deploy_vps.ps1 -Functions -Rebundle -RestartService
```

Isso regenera o `DEPLOY/functions-build/` a partir de `netlify/functions/`.

---

# Uma coisa que continua pendente

As mensagens cifradas antigas, de antes da correção de hoje, **não têm
conserto**. O material de chave delas não existe mais. Elas vão continuar
aparecendo como "mensagem cifrada que este dispositivo não consegue abrir".
Se quiser, dá para limpar essas linhas do banco — é só pedir.

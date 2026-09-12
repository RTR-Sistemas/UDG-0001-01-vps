# UndoinG Admin

Painel de administração, moderação e conformidade do UndoinG. Roda na sua máquina, conversa com
o seu servidor por HTTPS, e **não abre nenhuma porta nova** no firewall.

---

## Começar em 3 minutos

**1. Crie as tabelas que o painel usa** — abra o SQL Editor do Supabase, cole o conteúdo de
`sql/admin_tables.sql` e execute. São duas tabelas (`lgpd_requests`, `admin_audit`) e duas
colunas em `profiles`. É idempotente: rodar duas vezes não quebra nada.

**2. Abra o painel** — dê duplo clique em `INICIAR-ADMIN.bat`. Ele sobe o servidor local e abre
o navegador sozinho.

**3. Configure na primeira tela** — o endereço do Supabase, a chave `service_role` e uma senha
que você escolhe agora. Só isso.

Para gerar o executável (opcional, e só precisa uma vez): duplo clique em `build.bat`. Ele
produz o `UndoinG-Admin.exe`, que roda sem precisar do Node instalado.

---

## O que ele mostra

| Tela | Para quê |
|---|---|
| **Visão geral** | Contas, publicações, mensagens e erros — com gráficos de 30 e 14 dias. Quem está online agora e quantas mensagens na última hora se atualizam sozinhos a cada 10 segundos. |
| **Saúde do sistema** | Testa, ao vivo, o site, as funções em `/api` e o banco. Mostra o tempo de resposta de cada um. |
| **Erros do app** | O que quebrou na mão dos usuários, agrupado por mensagem e ordenado por frequência. |
| **Usuários** | Buscar, abrir o perfil, banir, verificar 18+, exportar dados, excluir a conta. |
| **Moderação** | A fila do que a análise automática não decidiu, mais as denúncias dos usuários. Cada decisão pede um motivo. |
| **Conteúdo** | Publicações e comunidades recentes, com remoção. |
| **LGPD** | Pedidos dos titulares com o prazo de 15 dias contando — vencidos aparecem em vermelho. |
| **Auditoria** | Tudo o que foi feito pelo painel: quem, o quê, quando, por quê. |

---

## Como a segurança foi resolvida

Este programa segura a chave `service_role` — a que ignora todas as regras do banco e enxerga
tudo. Quatro decisões vieram daí:

**Só escuta em `127.0.0.1`.** Uma conexão vinda de outra máquina é recusada antes de qualquer
processamento. Não existe "modo remoto", de propósito.

**A chave nunca é gravada em claro.** O que fica no disco é
`AES-256-GCM(service_role, scrypt(sua_senha))`. Sem a sua senha, o arquivo `dados/config.local.json`
não serve para nada — nem para quem copiar a pasta, nem para um programa que leia seus arquivos.
A chave só existe em memória, e só enquanto a sessão está aberta.

> Consequência: **se você esquecer a senha, não há recuperação.** Apague `dados/config.local.json`
> e configure de novo com a chave do painel do Supabase. Isso é uma propriedade do desenho.

**Zero dependências externas.** Só a biblioteca padrão do Node. Numa ferramenta que segura a
chave mestra, cada pacote de terceiro seria mais uma coisa para auditar — e a cadeia do npm é
uma via conhecida de ataque.

**Toda ação que muda algo é registrada antes de acontecer**, com motivo obrigatório. Sem esse
registro você não consegue responder a um recurso de usuário nem a um pedido da ANPD — e a
Política de Moderação publicada promete exatamente isso.

Além disso: bloqueio após 5 tentativas de senha, sessão que expira em 8 horas e morre quando o
programa fecha, cookie `HttpOnly` + `SameSite=Strict`, verificação de `Host` (contra DNS
rebinding) e de `Origin` (contra CSRF).

---

## O que NÃO fazer

- **Não exponha este painel na internet.** Nem "só para testar", nem atrás de senha. Ele foi
  escrito assumindo que só a sua máquina fala com ele.
- **Não mande a pasta `dados/` para ninguém**, nem coloque no Git (já está no `.gitignore`). O
  `.exe` sozinho é inofensivo; a pasta `dados` não.
- **Não use a chave `anon` no lugar da `service_role`.** O painel até abre, mas as telas ficam
  vazias — a `anon` obedece às regras de RLS e não enxerga os dados de outros usuários.

---

## Quando algo não funcionar

| Sintoma | Causa provável |
|---|---|
| "Não consegui conectar" na configuração | Endereço errado, ou a chave é a `anon` em vez da `service_role` |
| Telas vazias com "Tabela não encontrada" | Aquela tabela não existe neste banco — o painel avisa em vez de quebrar |
| LGPD diz que falta `lgpd_requests` | Rode `sql/admin_tables.sql` |
| Erros do app dizem que falta `client_errors` | Rode `supabase/checks/criar_tabela_client_errors.sql` |
| "ao vivo" pisca "reconectando…" | O servidor local caiu ou o computador dormiu. Feche e abra de novo. |
| O `build.bat` falha | Use o `INICIAR-ADMIN.bat` — é o mesmo painel, sem a etapa de empacotar |

---

## Estrutura

```
ADMIN/
├── INICIAR-ADMIN.bat     abre o painel (duplo clique)
├── build.bat             gera o UndoinG-Admin.exe (uma vez, opcional)
├── server.js             servidor local: rotas, sessão, proteções
├── lib/
│   ├── store.js          cofre cifrado, sessões, auditoria
│   ├── supabase.js       cliente REST tolerante a esquema
│   └── api.js            a lógica de cada tela
├── ui/                   interface (HTML, CSS, gráficos em SVG puro)
├── sql/admin_tables.sql  tabelas a criar no Supabase
└── dados/                criado no primeiro uso — NUNCA versionar
```

---

## Sobre os gráficos

Desenhados à mão em SVG, sem biblioteca. A paleta passou por verificação de acessibilidade
(faixa de luminosidade, croma, separação para daltonismo, contraste) nos modos claro e escuro.
Cada gráfico tem uma série só e o título nomeia o que é — a cor nunca é a única forma de
identificar o dado. O último valor sempre aparece escrito, e passar o mouse mostra o valor de
qualquer dia.

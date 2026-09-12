# ===========================================================================
# DEPLOY\vps.local.ps1  —  CONFIGURACAO LOCAL DO SERVIDOR
#
# Copie este arquivo para  DEPLOY\vps.local.ps1  e preencha os valores.
# O arquivo vps.local.ps1 esta no .gitignore: ele fica SO na sua maquina e
# nunca vai para o GitHub.
#
# Onde achar os valores: ACESSO_VPS_UNDOING.md, na sua Area de Trabalho.
# ===========================================================================

$UDG_VPS_HOST    = 'udgservidor.online'
$UDG_VPS_USER    = 'deploy'
$UDG_VPS_HOSTKEY = 'SHA256:COLE-AQUI-A-IMPRESSAO-DIGITAL'
$UDG_SITE_URL    = 'https://udgservidor.online/'

# A senha (enquanto ainda houver senha) vai por variavel de ambiente, nunca
# em arquivo:
#     $env:UDG_VPS_PASSWORD = 'sua-senha'
# O ideal e migrar para chave SSH e apagar a senha de vez.

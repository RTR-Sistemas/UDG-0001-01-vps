<#
================================================================================
 deploy_vps.ps1 — Build + deploy do UndoinG para o VPS (udgservidor.online)
================================================================================

 Substitui o deploy_prod.bat, que so enviava o `dist`. Este script tambem sabe
 enviar as funcoes do servidor — e sem elas a dublagem NAO funciona no VPS, porque
 `translate-audio.js` nunca foi publicado la.

 USO (PowerShell, na pasta do projeto):

   # 1) So o site (equivale ao deploy_prod.bat de antes)
   .\DEPLOY\deploy_vps.ps1

   # 2) Site + funcoes do servidor (necessario para tradcao/dublagem no VPS)
   .\DEPLOY\deploy_vps.ps1 -Functions

   # 3) Sem rebuildar (usa o dist que ja existe)
   .\DEPLOY\deploy_vps.ps1 -SkipBuild -Functions

   # 4) Reempacotar as functions a partir de netlify/functions
   .\DEPLOY\deploy_vps.ps1 -Functions -Rebundle -RestartService

 As functions ja vem empacotadas em DEPLOY\functions-build\ (39 arquivos,
 codigo atual, incluindo o translate-audio.js que faltava no VPS). O script usa
 essa pasta por padrao; -Rebundle forca gerar de novo do fonte.

 SENHA: o script NAO tem a senha escrita dentro dele. Ele usa, nesta ordem:
   1. a variavel de ambiente $env:UDG_VPS_PASSWORD, se existir;
   2. um prompt seguro (a senha nao aparece na tela nem no historico).

 Para nao digitar toda vez, abra o PowerShell e rode uma vez por sessao:
   $env:UDG_VPS_PASSWORD = 'sua-senha'
================================================================================
#>

[CmdletBinding()]
param(
    [switch]$Functions,      # tambem envia as funcoes do servidor
    [switch]$SkipBuild,      # nao roda "npm run build"
    [switch]$RestartService, # reinicia o servico undoing apos enviar as functions
    [switch]$Rebundle,       # reempacota as functions em vez de usar DEPLOY\functions-build
    [string]$VpsHost,
    [string]$VpsUser,
    [string]$HostKey,
    [string]$SiteUrl
)

# ---------------------------------------------------------------------------
# CORRIGIDO EM 06/09/2026: o endereco, o usuario e a impressao digital da chave
# do servidor NAO ficam mais escritos aqui. Eles vem, nesta ordem:
#   1. dos parametros da linha de comando;
#   2. das variaveis de ambiente UDG_VPS_HOST / UDG_VPS_USER / UDG_VPS_HOSTKEY;
#   3. do arquivo DEPLOY\vps.local.ps1, que fica so na sua maquina
#      (esta no .gitignore e NUNCA vai para o Git).
# Assim o repositorio deixa de ser um mapa do caminho ate o servidor.
# ---------------------------------------------------------------------------
$LocalConfig = Join-Path $PSScriptRoot 'vps.local.ps1'
if (Test-Path $LocalConfig) { . $LocalConfig }

if (-not $VpsHost) { $VpsHost = $env:UDG_VPS_HOST    ; if (-not $VpsHost) { $VpsHost = $UDG_VPS_HOST } }
if (-not $VpsUser) { $VpsUser = $env:UDG_VPS_USER    ; if (-not $VpsUser) { $VpsUser = $UDG_VPS_USER } }
if (-not $HostKey) { $HostKey = $env:UDG_VPS_HOSTKEY ; if (-not $HostKey) { $HostKey = $UDG_VPS_HOSTKEY } }
if (-not $SiteUrl) { $SiteUrl = $env:UDG_SITE_URL    ; if (-not $SiteUrl) { $SiteUrl = $UDG_SITE_URL } }

if (-not $VpsHost -or -not $VpsUser -or -not $HostKey) {
    throw @'
Faltam os dados do servidor.

Copie DEPLOY\vps.local.exemplo.ps1 para DEPLOY\vps.local.ps1 e preencha:
    $UDG_VPS_HOST    = 'seu.servidor.com'
    $UDG_VPS_USER    = 'deploy'
    $UDG_VPS_HOSTKEY = 'SHA256:...'
    $UDG_SITE_URL    = 'https://seu.servidor.com/'

Esse arquivo fica so na sua maquina (esta no .gitignore).
Os valores atuais estao em ACESSO_VPS_UNDOING.md, na sua Area de Trabalho.
'@
}

$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

function Write-Step { param([string]$Text) Write-Host "`n=== $Text" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Text) Write-Host "  OK  $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "  !   $Text" -ForegroundColor Yellow }

# ── Ferramentas PuTTY ────────────────────────────────────────────────────────
$Pscp  = Join-Path $env:LOCALAPPDATA 'Programs\pscp.exe'
$Plink = Join-Path $env:LOCALAPPDATA 'Programs\plink.exe'
if (-not (Test-Path $Pscp))  { $Pscp  = 'C:\Program Files\PuTTY\pscp.exe' }
if (-not (Test-Path $Plink)) { $Plink = 'C:\Program Files\PuTTY\plink.exe' }
if (-not (Test-Path $Pscp)) {
    throw "pscp.exe nao encontrado. Baixe em https://the.earth.li/~sgtatham/putty/latest/w64/ e coloque em $env:LOCALAPPDATA\Programs\"
}

# ── Senha ────────────────────────────────────────────────────────────────────
$Password = $env:UDG_VPS_PASSWORD
if ([string]::IsNullOrWhiteSpace($Password)) {
    $secure = Read-Host "Senha do root@$VpsHost" -AsSecureString
    $Password = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}
if ([string]::IsNullOrWhiteSpace($Password)) { throw 'Senha vazia. Abortando.' }

# ── 1. Build ─────────────────────────────────────────────────────────────────
if ($SkipBuild) {
    Write-Step '1/5 Build — pulado (-SkipBuild)'
    if (-not (Test-Path 'dist\index.html')) { throw 'dist\index.html nao existe. Rode sem -SkipBuild.' }
} else {
    Write-Step '1/5 Build do Vite'
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build falhou (codigo $LASTEXITCODE)" }
    Write-Ok 'dist gerado'
}

# ── 2. Bundle das funcoes do servidor ──────────────────────────────────────────
# O VPS nao tem node_modules: cada function precisa ir com as dependencias
# embutidas (foi assim que as atuais em DEPLOY/netlify/functions foram geradas).
$PrebuiltDir = Join-Path $PSScriptRoot 'functions-build'
$BundleDir   = $PrebuiltDir
if ($Functions) {
    if ((Test-Path $PrebuiltDir) -and -not $Rebundle) {
        # Pasta ja empacotada (gerada com esbuild --bundle --platform=node
        # --format=esm --target=node20, com shim de require p/ pacotes CommonJS).
        $count = (Get-ChildItem $PrebuiltDir -Filter *.js -File).Count
        Write-Step "2/5 Usando functions ja empacotadas ($count arquivos)"
        Write-Ok $PrebuiltDir
        Write-Warn 'Se voce alterou netlify/functions depois disso, rode com -Rebundle.'
    } else {
        Write-Step '2/5 Empacotando as funcoes do servidor (esbuild)'
        $BundleDir = Join-Path $env:TEMP 'udg-functions-bundle'
        if (Test-Path $BundleDir) { Remove-Item $BundleDir -Recurse -Force }
        New-Item -ItemType Directory -Path $BundleDir | Out-Null

        # Shim: pacotes CommonJS (ex.: agora-access-token) fazem require('crypto'),
        # que quebra em bundle ESM sem isto.
        $banner = "import{createRequire as __ndReq}from'node:module';" +
                  "import{fileURLToPath as __ndFU}from'node:url';" +
                  "import{dirname as __ndDir}from'node:path';" +
                  "const require=__ndReq(import.meta.url);" +
                  "const __filename=__ndFU(import.meta.url);" +
                  "const __dirname=__ndDir(__filename);"

        $sources = Get-ChildItem 'netlify\functions\*.js' -File |
                   Where-Object { $_.Name -ne '_shared.js' }

        foreach ($src in $sources) {
            $out = Join-Path $BundleDir $src.Name
            & npx --yes esbuild $src.FullName `
                --bundle --platform=node --format=esm --target=node20 `
                --log-level=error --banner:js=$banner --outfile=$out
            if ($LASTEXITCODE -ne 0) { throw "esbuild falhou em $($src.Name)" }
        }
        Copy-Item 'netlify\functions\_shared.js' (Join-Path $BundleDir '_shared.js')

        $count = (Get-ChildItem $BundleDir -File).Count
        Write-Ok "$count functions empacotadas em $BundleDir"
    }
} else {
    Write-Step '2/5 Functions — pulado (use -Functions para enviar)'
    Write-Warn 'Sem -Functions, translate-audio NAO chega ao VPS e a dublagem continua 404 la.'
}

# ── 3. Upload do site ────────────────────────────────────────────────────────
Write-Step '3/5 Enviando dist -> /opt/undoing/dist/'
& $Pscp -pw $Password -hostkey $HostKey -r 'dist\*' "$VpsUser@${VpsHost}:/opt/undoing/dist/"
if ($LASTEXITCODE -ne 0) { throw "Upload do dist falhou (codigo $LASTEXITCODE)" }
Write-Ok 'dist enviado'

# ── 4. Upload das functions ──────────────────────────────────────────────────
if ($Functions) {
    # A documentacao diverge: VPS_ACCESS.md e dados-vps.md dizem
    # /opt/undoing/functions/, mas o server.mjs resolve
    # join(__dirname,'..','netlify','functions') = /opt/undoing/netlify/functions.
    # Subir no lugar errado nao da erro nenhum — so nao surte efeito.
    # Entao perguntamos ao proprio servidor qual pasta o server.mjs esta lendo.
    $FunctionsPath = '/opt/undoing/netlify/functions'
    if (Test-Path $Plink) {
        Write-Step '4/5 Descobrindo a pasta de functions no servidor'
        # String de aspas SIMPLES: no PowerShell o $ e as aspas ficam literais,
        # que e exatamente o que o bash do servidor precisa receber.
        $remoteProbe = 'for d in /opt/undoing/netlify/functions /opt/undoing/functions; do [ -d "$d" ] && echo "DIR:$d:$(ls -1 "$d"/*.js 2>/dev/null | wc -l)"; done'
        $probe = & $Plink -batch -pw $Password -hostkey $HostKey "$VpsUser@$VpsHost" $remoteProbe 2>&1
        $found = @($probe | Where-Object { $_ -match '^DIR:' })
        if ($found.Count -gt 0) {
            # Prefere a pasta que realmente tem arquivos .js
            $best = $found | Sort-Object { [int]($_ -split ':')[2] } -Descending | Select-Object -First 1
            $FunctionsPath = ($best -split ':')[1]
            $qtd = ($best -split ':')[2]
            Write-Ok "usando $FunctionsPath ($qtd arquivos .js hoje)"
            if ($found.Count -gt 1) { Write-Warn "as duas pastas existem: $($found -join ' | ')" }
        } else {
            Write-Warn "nenhuma das duas pastas foi encontrada; tentando $FunctionsPath"
        }
    } else {
        Write-Warn "plink.exe ausente — assumindo $FunctionsPath sem verificar"
    }

    Write-Step "4/5 Enviando functions -> $FunctionsPath/"
    & $Pscp -pw $Password -hostkey $HostKey -r "$BundleDir\*" "$VpsUser@${VpsHost}:$FunctionsPath/"
    if ($LASTEXITCODE -ne 0) { throw "Upload das functions falhou (codigo $LASTEXITCODE)" }
    Write-Ok 'functions enviadas'

    if ($RestartService) {
        if (-not (Test-Path $Plink)) {
            Write-Warn 'plink.exe nao encontrado — reinicie o servico a mao: systemctl restart undoing'
        } else {
            Write-Step '   Reiniciando o servico undoing'
            & $Plink -batch -pw $Password -hostkey $HostKey "$VpsUser@$VpsHost" `
                "systemctl restart undoing && sleep 2 && systemctl is-active undoing"
            Write-Ok 'servico reiniciado'
        }
    } else {
        Write-Warn 'As functions so passam a valer apos reiniciar o servico.'
        Write-Warn 'Rode de novo com -RestartService, ou no VPS: systemctl restart undoing'
    }
} else {
    Write-Step '4/5 Upload das functions — pulado'
}

# ── 5. Verificacao ───────────────────────────────────────────────────────────
Write-Step '5/5 Verificando o site'
try {
    $res = Invoke-WebRequest -Uri $SiteUrl -UseBasicParsing -TimeoutSec 30
    Write-Ok "$SiteUrl respondeu HTTP $($res.StatusCode)"
    if ($res.Content -match 'assets/(index-[A-Za-z0-9_-]+\.js)') {
        Write-Ok "bundle no ar: $($Matches[1])"
    }
} catch {
    Write-Warn "Nao consegui verificar o site: $($_.Exception.Message)"
}

if ($Functions) {
    Write-Step '   Testando o endpoint de traducao'
    try {
        $body = '{"text":"bom dia","targetLang":"en","type":"translate"}'
        $r = Invoke-RestMethod -Uri "$($SiteUrl.TrimEnd('/'))/api/translate" `
             -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
        if ($r.success) { Write-Ok "traducao respondeu: $($r.data.translatedText)" }
        else { Write-Warn "traducao respondeu sem sucesso: $($r.error)" }
    } catch {
        Write-Warn "endpoint de traducao falhou: $($_.Exception.Message)"
    }
}

Write-Host "`nDeploy concluido.`n" -ForegroundColor Green

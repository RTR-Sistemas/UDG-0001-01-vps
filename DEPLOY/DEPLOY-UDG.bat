@echo off
setlocal
chcp 65001 >nul
title UDG - DEPLOY COMPLETO (site + functions)
color 0B

cd /d "%~dp0.."

echo.
echo  ============================================================
echo   UDG - DEPLOY COMPLETO
echo  ============================================================
echo   Destino : udgservidor.online  (187.127.51.179)
echo   Pasta   : %CD%
echo.
echo   O que este deploy faz:
echo     1. npm run build            (gera o dist com o codigo atual)
echo     2. Envia dist               -^> /opt/undoing/dist/
echo     3. Envia as Netlify Functions (inclui o translate-audio.js,
echo        que a dublagem precisa e que nunca subiu ao servidor)
echo     4. Reinicia o servico "undoing"
echo     5. Testa o site e o endpoint de traducao
echo  ============================================================
echo.

REM -- Verificacoes rapidas antes de comecar -----------------------------
if not exist "%~dp0deploy_vps.ps1" (
  echo  [ERRO] Nao encontrei DEPLOY\deploy_vps.ps1 ao lado deste .bat.
  goto :fim_erro
)
if not exist "package.json" (
  echo  [ERRO] Nao encontrei package.json em %CD%.
  echo         Este .bat precisa estar dentro da pasta DEPLOY do projeto.
  goto :fim_erro
)

where npm >nul 2>&1
if errorlevel 1 (
  echo  [ERRO] npm nao encontrado no PATH. Instale o Node 20+ e tente de novo.
  goto :fim_erro
)

set "PSCP1=%LOCALAPPDATA%\Programs\pscp.exe"
set "PSCP2=C:\Program Files\PuTTY\pscp.exe"
if not exist "%PSCP1%" if not exist "%PSCP2%" (
  echo  [ERRO] pscp.exe nao encontrado.
  echo         Baixe pscp.exe e plink.exe em:
  echo         https://the.earth.li/~sgtatham/putty/latest/w64/
  echo         e coloque em: %LOCALAPPDATA%\Programs\
  goto :fim_erro
)

echo  Tudo certo para comecar. A senha do servidor sera pedida a seguir
echo  (ou defina UDG_VPS_PASSWORD antes para nao digitar).
echo.
pause

REM -- Executa o script de deploy ----------------------------------------
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_vps.ps1" -Functions -RestartService
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  color 0A
  echo  ============================================================
  echo   DEPLOY CONCLUIDO
  echo  ============================================================
  echo.
  echo   Confira agora em https://udgservidor.online :
  echo     - abra o chat e teste "Traduzir mensagens"
  echo     - ligue "Dublar audios" e receba um audio
  echo     - no console, o aviso [Sessao] deve aparecer 1 vez, nao 16
  echo.
  echo   Dica: se o site parecer o de antes, force o recarregamento
  echo         com Ctrl + Shift + R.
) else (
  color 0C
  echo  ============================================================
  echo   O DEPLOY FALHOU  ^(codigo %RC%^)
  echo  ============================================================
  echo.
  echo   Role a tela para cima e veja a ultima linha em vermelho.
  echo   Nada foi perdido: o servidor so muda quando o envio termina.
  echo.
  echo   Se preferir, copie a mensagem de erro e me mande.
)

echo.
:fim
echo  Pressione qualquer tecla para fechar esta janela.
pause >nul
endlocal & exit /b %RC%

:fim_erro
echo.
color 0C
echo  Deploy nao iniciado.
echo.
pause >nul
endlocal & exit /b 1

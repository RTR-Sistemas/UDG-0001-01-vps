@echo off
setlocal
chcp 65001 >nul
title UDG - DEPLOY PROD
cd /d "%~dp0.."

REM ============================================================================
REM  CORRIGIDO EM 06/09/2026 - INCIDENTE DE SEGURANCA
REM
REM  A versao anterior deste arquivo tinha a SENHA DE ROOT do servidor escrita
REM  dentro dele (pscp -pw ...). Qualquer pessoa com acesso a pasta, ao Git ou
REM  a um backup tinha o servidor inteiro.
REM
REM  Agora este .bat nao guarda segredo nenhum: ele so chama o deploy_vps.ps1,
REM  que pergunta a senha (ou le a variavel de ambiente UDG_VPS_PASSWORD) e le
REM  o endereco do servidor de DEPLOY\vps.local.ps1 - um arquivo que fica so na
REM  sua maquina e nunca vai para o Git.
REM
REM  O CAMINHO NORMAL DE PUBLICACAO HOJE E O GIT:
REM     git push  ->  GitHub Actions  ->  verifica  ->  publica no VPS
REM  Este .bat existe para publicacao manual de emergencia.
REM ============================================================================

echo.
echo  ============================================================
echo   UDG - DEPLOY MANUAL PARA O VPS
echo  ============================================================
echo   O caminho normal e "git push" (o GitHub publica sozinho).
echo   Use este atalho so quando precisar publicar na mao.
echo  ============================================================
echo.

if not exist "DEPLOY\vps.local.ps1" (
  echo  [ATENCAO] DEPLOY\vps.local.ps1 nao existe.
  echo            Copie DEPLOY\vps.local.exemplo.ps1 para DEPLOY\vps.local.ps1
  echo            e preencha o endereco do servidor.
  echo.
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy_vps.ps1" %*
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
  echo  Deploy concluido.
) else (
  echo  O deploy falhou (codigo %RC%). Role a tela e leia a ultima mensagem.
)
echo.
pause
endlocal & exit /b %RC%

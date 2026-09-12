@echo off
setlocal
chcp 65001 >nul
title UDG - Limpar arquivos .bak
cd /d "%~dp0.."

REM ============================================================================
REM  Remove os arquivos .bak que estao dentro de src\.
REM  Sao copias antigas (Messages, Feed, Arena, Profile, News, MessageInput...)
REM  que somam quase 1 MB de codigo morto: confundem a busca no editor, poluem
REM  o refactor e nao sao usadas por nada.
REM
REM  Eles JA estao no .gitignore, entao nunca foram para o GitHub - isto aqui e
REM  so faxina local.
REM
REM  O script move para a Lixeira? Nao: apaga de vez. Por isso ele LISTA tudo e
REM  pede confirmacao antes.
REM ============================================================================

echo.
echo  Arquivos .bak encontrados em src\:
echo  ---------------------------------------------------------------
dir /s /b "src\*.bak" 2>nul
echo  ---------------------------------------------------------------
echo.

dir /s /b "src\*.bak" >nul 2>&1
if errorlevel 1 (
  echo  Nenhum arquivo .bak encontrado. Nada a fazer.
  echo.
  pause
  exit /b 0
)

echo  Estes arquivos serao APAGADOS.
echo  Se quiser guardar algum, feche esta janela agora (X) e salve antes.
echo.
set /p CONFIRMA="Digite APAGAR e pressione Enter para confirmar: "

if /I not "%CONFIRMA%"=="APAGAR" (
  echo.
  echo  Cancelado. Nenhum arquivo foi tocado.
  echo.
  pause
  exit /b 0
)

del /s /q "src\*.bak"
echo.
echo  Pronto. Arquivos .bak removidos de src\.
echo.
pause
endlocal

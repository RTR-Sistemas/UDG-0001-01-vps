@echo off
setlocal
chcp 65001 >nul
title UndoinG Admin
cd /d "%~dp0"

echo.
echo   ============================================================
echo    UndoinG Admin
echo   ============================================================
echo    O painel abre no navegador em http://127.0.0.1:3456
echo    Feche ESTA janela para encerrar o painel.
echo   ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   [ERRO] Node.js nao encontrado.
  echo          Instale o Node 20 ou superior em https://nodejs.org
  echo          Ou use o UndoinG-Admin.exe, que nao precisa de Node.
  echo.
  pause
  exit /b 1
)

node server.js
echo.
echo   Painel encerrado.
pause
endlocal

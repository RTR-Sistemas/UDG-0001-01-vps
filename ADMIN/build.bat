@echo off
setlocal
chcp 65001 >nul
title UndoinG Admin - gerar o .exe
cd /d "%~dp0"

echo.
echo   ============================================================
echo    Gerando UndoinG-Admin.exe
echo   ============================================================
echo    Isto baixa o empacotador na primeira vez (uns 40 MB) e
echo    junta o Node + o painel num unico arquivo executavel.
echo    Depois disso o .exe roda sozinho, sem precisar de Node.
echo   ============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo   [ERRO] Node.js nao encontrado. Instale o Node 20+ em https://nodejs.org
  pause
  exit /b 1
)

echo   [1/2] Empacotando...
call npx --yes @yao-pkg/pkg . --targets node20-win-x64 --output UndoinG-Admin.exe
if errorlevel 1 goto :erro

echo.
echo   [2/2] Conferindo...
if not exist "UndoinG-Admin.exe" goto :erro

echo.
echo   ============================================================
echo    PRONTO
echo   ============================================================
echo    Arquivo: %CD%\UndoinG-Admin.exe
echo.
echo    Voce pode mover esse .exe para onde quiser. Ele cria uma
echo    pasta "dados" ao lado dele na primeira execucao - e nessa
echo    pasta que fica a configuracao cifrada e a auditoria.
echo.
echo    NAO envie o .exe junto com a pasta "dados" para ninguem:
echo    o exe e inofensivo, a pasta dados nao.
echo   ============================================================
echo.
pause
exit /b 0

:erro
echo.
echo   [FALHOU] Nao consegui gerar o executavel.
echo.
echo   Alternativa que sempre funciona: use o INICIAR-ADMIN.bat.
echo   Ele roda o mesmo painel com o Node que voce ja tem instalado.
echo.
pause
exit /b 1

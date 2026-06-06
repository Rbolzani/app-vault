@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ==========================================
echo    DocVault ^| Publicar na Nuvem
echo  ==========================================
echo.

REM ── 1. Exportar dados e copiar PDFs ──────────────────────
echo  [1/3]  Exportando documentos e arquivos...
node scripts/export-cloud.js
if errorlevel 1 (
    echo.
    echo  ERRO: Falha na exportacao dos dados.
    echo  Verifique se o Node.js esta instalado.
    echo.
    pause
    exit /b 1
)

REM ── 2. Preparar arquivos para envio ──────────────────────
git add frontend/public/uploads/ frontend/public/data.json

REM  Se nao houver mudancas, encerrar sem erro
git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo  Nenhuma alteracao encontrada.
    echo  O painel ja esta atualizado na nuvem.
    echo.
    timeout /t 4 /nobreak >nul
    exit /b 0
)

REM ── 3. Commit com timestamp (sem espacos) ─────────────────
echo  [2/3]  Criando versao...
powershell -NoProfile -Command "git commit -m ('atualiza documentos - ' + (Get-Date -Format 'dd/MM/yyyy HH:mm'))"
if errorlevel 1 (
    echo.
    echo  ERRO ao criar commit. Detalhes acima.
    echo.
    pause
    exit /b 1
)

REM ── 4. Publicar no GitHub ─────────────────────────────────
echo  [3/3]  Publicando no GitHub Pages...
git push origin main
if errorlevel 1 (
    echo.
    echo  ERRO ao publicar.
    echo  Verifique sua conexao com a internet.
    echo.
    pause
    exit /b 1
)

echo.
echo  ==========================================
echo    Publicado com sucesso!
echo    https://rbolzani.github.io/app-vault/
echo  ==========================================
echo.
timeout /t 6 /nobreak

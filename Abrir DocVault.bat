@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ==========================================
echo    DocVault ^| Abrindo no navegador...
echo  ==========================================
echo.

REM Abre o link na nuvem (GitHub Pages) — funciona sem servidor local
start https://rbolzani.github.io/app-vault/

echo  Abrindo https://rbolzani.github.io/app-vault/
echo.
echo  Para desenvolvimento local, rode:  npm run dev
echo.
timeout /t 3 /nobreak >nul

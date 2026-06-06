@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ==========================================
echo    DocVault ^| Iniciando...
echo  ==========================================
echo.
echo  Aguarde, abrindo o navegador em 5 segundos.
echo  Para encerrar, feche esta janela (ou Ctrl+C).
echo.

REM Abre o navegador automaticamente apos 5 segundos
start /b "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:5173"

REM Inicia backend + frontend juntos
npm run dev

echo.
echo  App encerrado. Pressione qualquer tecla para fechar.
pause >nul

@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"

echo.
echo  ==========================================
echo    DocVault ^| Migrar dados para Supabase
echo  ==========================================
echo.
echo  Este script vai copiar todos os seus documentos
echo  do banco local (SQLite) para o Supabase.
echo.
echo  ANTES DE CONTINUAR, certifique-se de que:
echo    1. Criou sua conta em supabase.com
echo    2. Criou o projeto e as tabelas (veja supabase-schema.sql)
echo    3. Preencheu o arquivo frontend/.env.local
echo.

set /p SUPABASE_URL="Cole aqui a URL do seu projeto Supabase: "
set /p SUPABASE_ANON_KEY="Cole aqui a Anon Key do Supabase: "

if "%SUPABASE_URL%"=="" (
    echo ERRO: URL nao informada.
    pause & exit /b 1
)
if "%SUPABASE_ANON_KEY%"=="" (
    echo ERRO: Anon Key nao informada.
    pause & exit /b 1
)

echo.
echo  Instalando dependencias...
npm install --silent
if errorlevel 1 (
    echo ERRO ao instalar dependencias.
    pause & exit /b 1
)

echo  Iniciando migracao...
echo.
node scripts/migrate-to-supabase.js

echo.
pause

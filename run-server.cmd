@echo off
cd /d "%~dp0"
npm.cmd run dev -- --host 127.0.0.1 --port 8766 1>"%~dp0vite-8766.log" 2>"%~dp0vite-8766-error.log"

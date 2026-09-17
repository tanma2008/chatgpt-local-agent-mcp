@echo off
setlocal
title chatgpt-local-agent-mcp auto-start
cd /d "%~dp0.."

:: Skip if already listening on 8789
netstat -ano | findstr ":8789.*LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [%date% %time%] MCP already listening on 8789, skipping.
    exit /b 0
)

echo [%date% %time%] Starting MCP server...
node --env-file=.env dist/index.js

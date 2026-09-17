@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows-reporter.ps1" %*

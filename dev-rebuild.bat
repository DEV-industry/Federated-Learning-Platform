@echo off
REM ============================================================
REM  dev-rebuild.bat — Smart rebuild for Federated Learning
REM  Usage:
REM    dev-rebuild.bat              (rebuild everything)
REM    dev-rebuild.bat frontend     (rebuild only frontend)
REM    dev-rebuild.bat aggregator   (rebuild only aggregator)
REM    dev-rebuild.bat nodes        (rebuild only node clients)
REM    dev-rebuild.bat fa           (rebuild frontend + aggregator)
REM ============================================================

setlocal
set TARGET=%1

if "%TARGET%"=="" (
    echo [*] Full rebuild of all services...
    docker-compose up -d --build
    goto :done
)

if "%TARGET%"=="frontend" (
    echo [*] Rebuilding frontend only...
    docker-compose up -d --build frontend
    goto :done
)

if "%TARGET%"=="aggregator" (
    echo [*] Rebuilding aggregator only...
    docker-compose up -d --build aggregator
    goto :done
)

if "%TARGET%"=="nodes" (
    echo [*] Rebuilding node clients only...
    docker-compose up -d --build node_client_1 node_client_2 node_client_3
    goto :done
)

if "%TARGET%"=="fa" (
    echo [*] Rebuilding frontend + aggregator...
    docker-compose up -d --build frontend aggregator
    goto :done
)

echo [!] Unknown target: %TARGET%
echo Usage: dev-rebuild.bat [frontend ^| aggregator ^| nodes ^| fa]

:done
endlocal

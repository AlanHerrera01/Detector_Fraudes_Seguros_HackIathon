$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
Set-Location $backendRoot

$modelsPath = Join-Path $backendRoot ".ollama-models"
$env:OLLAMA_MODELS = $modelsPath
$env:PYTHONPATH = "."

Write-Host "Backend FraudIA en: $backendRoot"
Write-Host "Modelos Ollama esperados en: $modelsPath"

py -3.11 -m uvicorn src.app.main:app --host 127.0.0.1 --port 8000 --reload

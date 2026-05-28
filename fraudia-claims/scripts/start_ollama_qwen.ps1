$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$modelsPath = Join-Path $backendRoot ".ollama-models"

New-Item -ItemType Directory -Force -Path $modelsPath | Out-Null
$env:OLLAMA_MODELS = $modelsPath

Write-Host "Usando modelos Ollama en: $modelsPath"

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    Write-Host "Ollama no esta instalado o no esta en PATH."
    Write-Host "Instalalo con: winget install Ollama.Ollama"
    exit 1
}

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null
    Write-Host "Servicio Ollama ya esta activo."
} catch {
    Write-Host "Levantando servicio Ollama..."
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden -WorkingDirectory $backendRoot
    Start-Sleep -Seconds 4
}

Write-Host "Descargando/verificando qwen2.5:3b..."
ollama pull qwen2.5:3b

Write-Host "Qwen local listo. Endpoint: http://127.0.0.1:11434/api/generate"
Write-Host "Puedes dejar esta ventana abierta o iniciar el backend en otra terminal."

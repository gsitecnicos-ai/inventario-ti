param(
    [Parameter(Mandatory=$false)]
    [string]$SignCert,

    [Parameter(Mandatory=$false)]
    [string]$SignPassword
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
    Write-Error "Go nao esta instalado ou nao esta no PATH"
    exit 1
}

$AgentDir = (Split-Path -Parent $PSScriptRoot) + "\agent"
$ExePath = "$AgentDir\inventario-ti-agent-windows-amd64.exe"

Write-Host "Compilando agente Go..."
Write-Host "Diretorio: $AgentDir"

Push-Location $AgentDir

try {
    go build -o inventario-ti-agent-windows-amd64.exe -ldflags="-s -w" .
    
    if (-not (Test-Path $ExePath)) {
        Write-Error "Falha ao compilar executavel"
        exit 1
    }
    
    Write-Host "Compilacao concluida: $ExePath"
    
    if ($SignCert -and $SignPassword) {
        Write-Host ""
        Write-Host "Assinando executavel..."
        
        $SignScript = (Split-Path -Parent $PSScriptRoot) + "\scripts\sign-agent.ps1"
        & $SignScript -CertPath $SignCert -CertPassword $SignPassword -ExePath $ExePath
    } else {
        Write-Host ""
        Write-Host "Nota: Executavel nao assinado."
        Write-Host "Para assinar, use: -SignCert <caminho> -SignPassword <senha>"
    }
    
} finally {
    Pop-Location
}

Write-Host "Build finalizado!"

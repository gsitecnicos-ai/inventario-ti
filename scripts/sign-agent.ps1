# sign-agent.ps1
# Script para assinar o executavel do agente Inventario TI com certificado code signing
# 
# Uso:
#   $certPassword = Read-Host -AsSecureString "Digite a senha do certificado"
#   .\scripts\sign-agent.ps1 -CertPath "C:\path\to\cert.pfx" -CertPassword $certPassword
#   .\scripts\sign-agent.ps1 -CertPath "C:\path\to\cert.pfx" -CertPassword $certPassword -ExePath "agent\inventario-ti-agent-windows-amd64.exe"

param(
    [Parameter(Mandatory=$true)]
    [string]$CertPath,

    [Parameter(Mandatory=$true)]
    [System.Security.SecureString]$CertPassword,

    [Parameter(Mandatory=$false)]
    [string]$ExePath = "agent\inventario-ti-agent-windows-amd64.exe",

    [Parameter(Mandatory=$false)]
    [string]$TimestampServer = "http://timestamp.sectigo.com"
)

# Validar parametros
if (-not (Test-Path $CertPath)) {
    Write-Error "Certificado nao encontrado: $CertPath"
    exit 1
}

if (-not (Test-Path $ExePath)) {
    Write-Error "Executavel nao encontrado: $ExePath"
    exit 1
}

Write-Host "Assinando agente: $ExePath"
Write-Host "Certificado: $CertPath"
Write-Host "Servidor de timestamp: $TimestampServer"

try {
    # Usar a senha segura fornecida pelo parâmetro
    $SecPassword = $CertPassword
    
    # Carregar certificado protegido por senha
    $Certificate = Get-PfxCertificate -FilePath $CertPath -Password $SecPassword
    Write-Host "Certificado carregado: $($Certificate.Subject)"
    
    # Assinar executavel
    $SignResult = Set-AuthenticodeSignature -FilePath $ExePath `
        -Certificate $Certificate `
        -IncludeChain All `
        -TimestampServer $TimestampServer `
        -Force
    
    if ($SignResult.Status -eq "Valid") {
        Write-Host "✓ Executavel assinado com sucesso!" -ForegroundColor Green
        Write-Host "Thumbprint: $($SignResult.SignerCertificate.Thumbprint)"
    } else {
        Write-Error "Falha ao assinar executavel. Status: $($SignResult.Status)"
        exit 1
    }
    
    # Verificar assinatura
    Write-Host ""
    Write-Host "Verificando assinatura..."
    $VerifyResult = Get-AuthenticodeSignature -FilePath $ExePath
    
    if ($VerifyResult.Status -eq "Valid") {
        Write-Host "✓ Assinatura verificada com sucesso!" -ForegroundColor Green
        Write-Host "Issuer: $($VerifyResult.SignerCertificate.Issuer)"
        Write-Host "Subject: $($VerifyResult.SignerCertificate.Subject)"
        Write-Host "Valid From: $($VerifyResult.SignerCertificate.NotBefore)"
        Write-Host "Valid Until: $($VerifyResult.SignerCertificate.NotAfter)"
    } else {
        Write-Warning "Status da assinatura: $($VerifyResult.Status)"
    }
    
} catch {
    Write-Error "Erro ao assinar executavel: $_"
    exit 1
}

Write-Host ""
Write-Host "Feito!" -ForegroundColor Green

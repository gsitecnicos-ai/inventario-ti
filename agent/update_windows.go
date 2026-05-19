//go:build windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
)

func applyUpdate(updatePath string, exePath string, config *Config) error {
	pid := os.Getpid()
	serviceName := config.ServiceName
	if strings.TrimSpace(serviceName) == "" {
		serviceName = defaultServiceName
	}

	script := fmt.Sprintf(`$ErrorActionPreference = 'Stop'
$UpdatePath = %s
$ExePath = %s
$ServiceName = %s
$PidToWait = %d

Wait-Process -Id $PidToWait -ErrorAction SilentlyContinue
Copy-Item -LiteralPath $UpdatePath -Destination $ExePath -Force
Remove-Item -LiteralPath $UpdatePath -Force -ErrorAction SilentlyContinue

$Service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($Service) {
  Start-Service -Name $ServiceName
} else {
  Start-Process -FilePath $ExePath -WorkingDirectory (Split-Path -Parent $ExePath) -WindowStyle Hidden
}
`, psLiteral(updatePath), psLiteral(exePath), psLiteral(serviceName), pid)

	cmd := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", script)
	return cmd.Start()
}

func psLiteral(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "''") + "'"
}

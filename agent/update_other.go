//go:build !windows

package main

import "fmt"

func applyUpdate(updatePath string, exePath string, config *Config) error {
	return fmt.Errorf("auto update ainda nao suportado nesta plataforma")
}

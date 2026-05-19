package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type UpdateManifest struct {
	Version     string `json:"version"`
	DownloadURL string `json:"download_url"`
	SHA256      string `json:"sha256"`
	SizeBytes   int64  `json:"size_bytes"`
}

var versionPartPattern = regexp.MustCompile(`\d+`)

func checkForUpdate(config *Config) {
	manifest, err := fetchUpdateManifest(config)
	if err != nil {
		log.Println("Auto update: erro ao consultar versao:", err)
		return
	}

	if !isNewerVersion(manifest.Version, AgentVersion) {
		log.Println("Auto update: agente ja esta na versao mais recente:", AgentVersion)
		return
	}

	if manifest.DownloadURL == "" || manifest.SHA256 == "" {
		log.Println("Auto update: manifesto incompleto")
		return
	}

	exePath, err := os.Executable()
	if err != nil {
		log.Println("Auto update: erro ao resolver executavel:", err)
		return
	}

	updateDir := filepath.Join(filepath.Dir(exePath), "updates")
	if err := os.MkdirAll(updateDir, 0755); err != nil {
		log.Println("Auto update: erro ao criar diretorio de updates:", err)
		return
	}

	tempPath := filepath.Join(updateDir, fmt.Sprintf("inventario-ti-agent-%s.exe", sanitizeVersion(manifest.Version)))
	if err := downloadFile(manifest.DownloadURL, tempPath); err != nil {
		log.Println("Auto update: erro ao baixar binario:", err)
		return
	}

	ok, err := fileMatchesSHA256(tempPath, manifest.SHA256)
	if err != nil {
		log.Println("Auto update: erro ao validar hash:", err)
		return
	}

	if !ok {
		log.Println("Auto update: hash invalido; binario descartado")
		_ = os.Remove(tempPath)
		return
	}

	log.Println("Auto update: versao", manifest.Version, "validada; preparando substituicao")
	if err := applyUpdate(tempPath, exePath, config); err != nil {
		log.Println("Auto update: erro ao aplicar update:", err)
		return
	}

	log.Println("Auto update: processo atual sera encerrado para reiniciar atualizado")
	os.Exit(0)
}

func fetchUpdateManifest(config *Config) (*UpdateManifest, error) {
	updateURL, err := url.Parse(config.UpdateEndpoint)
	if err != nil {
		return nil, err
	}

	query := updateURL.Query()
	query.Set("tenant_slug", config.TenantSlug)
	query.Set("api_key", config.APIKey)
	query.Set("version", AgentVersion)
	updateURL.RawQuery = query.Encode()

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(updateURL.String())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNoContent {
		return &UpdateManifest{Version: AgentVersion}, nil
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4*1024))
		return nil, fmt.Errorf("status %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var manifest UpdateManifest
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64*1024)).Decode(&manifest); err != nil {
		return nil, err
	}

	return &manifest, nil
}

func downloadFile(downloadURL string, targetPath string) error {
	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Get(downloadURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("status %s", resp.Status)
	}

	tempPath := targetPath + ".download"
	file, err := os.Create(tempPath)
	if err != nil {
		return err
	}

	_, copyErr := io.Copy(file, resp.Body)
	closeErr := file.Close()

	if copyErr != nil {
		_ = os.Remove(tempPath)
		return copyErr
	}

	if closeErr != nil {
		_ = os.Remove(tempPath)
		return closeErr
	}

	return os.Rename(tempPath, targetPath)
}

func fileMatchesSHA256(path string, expected string) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, err
	}
	defer file.Close()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return false, err
	}

	actual := hex.EncodeToString(hash.Sum(nil))
	return strings.EqualFold(actual, strings.TrimSpace(expected)), nil
}

func isNewerVersion(candidate string, current string) bool {
	candidateParts := versionParts(candidate)
	currentParts := versionParts(current)
	maxParts := len(candidateParts)

	if len(currentParts) > maxParts {
		maxParts = len(currentParts)
	}

	for i := 0; i < maxParts; i++ {
		candidateValue := partAt(candidateParts, i)
		currentValue := partAt(currentParts, i)

		if candidateValue > currentValue {
			return true
		}

		if candidateValue < currentValue {
			return false
		}
	}

	return false
}

func versionParts(version string) []int {
	matches := versionPartPattern.FindAllString(version, -1)
	parts := make([]int, 0, len(matches))

	for _, match := range matches {
		value, err := strconv.Atoi(match)
		if err != nil {
			continue
		}

		parts = append(parts, value)
	}

	return parts
}

func partAt(parts []int, index int) int {
	if index >= len(parts) {
		return 0
	}

	return parts[index]
}

func sanitizeVersion(version string) string {
	value := strings.TrimSpace(version)
	value = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '-' || r == '_' {
			return r
		}

		return '-'
	}, value)

	if value == "" {
		return "latest"
	}

	return value
}

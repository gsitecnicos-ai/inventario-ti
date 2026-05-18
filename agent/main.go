package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"gopkg.in/natefinch/lumberjack.v2"
)

type Config struct {
	Endpoint          string `json:"endpoint"`
	HeartbeatEndpoint string `json:"heartbeat_endpoint"`
	TenantSlug        string `json:"tenant_slug"`
	DeviceID          string `json:"device_id"`
	APIKey            string `json:"api_key"`
	IntervalMinutes   int    `json:"interval_minutes"`
	HeartbeatMinutes  int    `json:"heartbeat_minutes"`
	InventoryHours    int    `json:"inventory_hours"`
}

type HeartbeatPayload struct {
	TenantSlug         string  `json:"tenant_slug"`
	DeviceID           string  `json:"device_id"`
	APIKey             string  `json:"api_key"`
	Hostname           string  `json:"hostname"`
	IP                 string  `json:"ip"`
	CPUUsagePercent    float64 `json:"cpu_usage_percent"`
	MemoryUsagePercent float64 `json:"memory_usage_percent"`
	UptimeSeconds      int64   `json:"uptime_seconds"`
}

type Software struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Publisher string `json:"publisher"`
}

type Payload struct {
	TenantSlug string     `json:"tenant_slug"`
	DeviceID   string     `json:"device_id"`
	APIKey     string     `json:"api_key"`
	Hostname   string     `json:"hostname"`
	OS         string     `json:"os"`
	Platform   string     `json:"platform"`
	CPU        string     `json:"cpu"`
	RAM        uint64     `json:"ram"`
	IP         string     `json:"ip"`
	Softwares  []Software `json:"softwares"`
}

// QueuedPayload é um payload armazenado em fila
type QueuedPayload struct {
	Type      string          `json:"type"` // "inventory" ou "heartbeat"
	Endpoint  string          `json:"endpoint"`
	Timestamp string          `json:"timestamp"`
	Data      json.RawMessage `json:"data"`
}

// Queue manager global
var queueMutex sync.Mutex

func initLogger() error {
	programData := os.Getenv("ProgramData")
	if programData == "" {
		return fmt.Errorf("ProgramData environment variable not set")
	}

	logsDir := filepath.Join(programData, "InventarioTIAgent", "logs")

	// Criar diretório se não existe
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return fmt.Errorf("erro ao criar diretorio de logs: %w", err)
	}

	// Configurar lumberjack para rotação de logs
	logFile := &lumberjack.Logger{
		Filename:   filepath.Join(logsDir, "agent.log"),
		MaxSize:    10,   // MB
		MaxBackups: 5,    // Manter últimos 5 arquivos
		MaxAge:     30,   // Dias
		Compress:   true, // Comprimir arquivos antigos
	}

	// Configurar log para escrever em arquivo e console simultaneamente
	log.SetOutput(io.MultiWriter(os.Stdout, logFile))
	log.SetFlags(log.LstdFlags)
	log.SetPrefix("")

	return nil
}

func getQueueDir() (string, error) {
	programData := os.Getenv("ProgramData")
	if programData == "" {
		return "", fmt.Errorf("ProgramData environment variable not set")
	}

	queueDir := filepath.Join(programData, "InventarioTIAgent", "Queue")

	// Criar diretório se não existe
	if err := os.MkdirAll(queueDir, 0755); err != nil {
		return "", fmt.Errorf("erro ao criar diretorio de fila: %w", err)
	}

	return queueDir, nil
}

func getNextQueueNumber(queueDir string) int {
	files, err := os.ReadDir(queueDir)
	if err != nil {
		return 1
	}

	maxNum := 0
	for _, f := range files {
		if f.IsDir() {
			continue
		}

		// Extrair número do arquivo: payload-001.json -> 1
		var num int
		_, err := fmt.Sscanf(f.Name(), "payload-%d.json", &num)
		if err == nil && num > maxNum {
			maxNum = num
		}
	}

	return maxNum + 1
}

func queuePayload(payloadType string, endpoint string, data interface{}) error {
	queueDir, err := getQueueDir()
	if err != nil {
		log.Println("Erro ao acessar fila:", err)
		return err
	}

	queueMutex.Lock()
	defer queueMutex.Unlock()

	queueNum := getNextQueueNumber(queueDir)
	filename := filepath.Join(queueDir, fmt.Sprintf("payload-%03d.json", queueNum))

	jsonData, _ := json.Marshal(data)

	queued := QueuedPayload{
		Type:      payloadType,
		Endpoint:  endpoint,
		Timestamp: time.Now().Format(time.RFC3339),
		Data:      jsonData,
	}

	queuedJSON, _ := json.MarshalIndent(queued, "", "  ")

	if err := os.WriteFile(filename, queuedJSON, 0644); err != nil {
		log.Println("Erro ao salvar em fila:", err)
		return err
	}

	log.Println("Payload enfileirado:", filename)
	return nil
}

func processQueue() {
	queueDir, err := getQueueDir()
	if err != nil {
		return
	}

	queueMutex.Lock()
	files, err := os.ReadDir(queueDir)
	queueMutex.Unlock()

	if err != nil {
		return
	}

	// Ordenar arquivos por número
	var payloadFiles []os.DirEntry
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(f.Name()) == ".json" {
			payloadFiles = append(payloadFiles, f)
		}
	}

	sort.Slice(payloadFiles, func(i, j int) bool {
		return payloadFiles[i].Name() < payloadFiles[j].Name()
	})

	for _, f := range payloadFiles {
		filePath := filepath.Join(queueDir, f.Name())

		// Ler arquivo
		fileContent, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("Erro ao ler fila %s: %v\n", f.Name(), err)
			continue
		}

		var queued QueuedPayload
		if err := json.Unmarshal(fileContent, &queued); err != nil {
			fmt.Printf("Erro ao desserializar fila %s: %v\n", f.Name(), err)
			continue
		}

		// Tentar enviar
		success := false

		if queued.Type == "heartbeat" {
			var hb HeartbeatPayload
			if err := json.Unmarshal(queued.Data, &hb); err == nil {
				success = sendHeartbeatWithRetry(queued.Endpoint, &hb, false)
			}
		} else if queued.Type == "inventory" {
			var payload Payload
			if err := json.Unmarshal(queued.Data, &payload); err == nil {
				success = sendWithRetry(queued.Endpoint, &payload, false)
			}
		}

		// Se enviado com sucesso, remover arquivo
		if success {
			queueMutex.Lock()
			os.Remove(filePath)
			queueMutex.Unlock()

			fmt.Println("Fila enviada e removida:", f.Name())
		}
	}
}

func sendWithRetry(endpoint string, data *Payload, queue bool) bool {
	jsonData, _ := json.Marshal(data)

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		fmt.Println("Erro ao enviar:", err)
		if queue {
			queuePayload("inventory", endpoint, data)
		}
		return false
	}
	defer resp.Body.Close()

	fmt.Println("Enviado para:", endpoint)
	fmt.Println("Enviado com status:", resp.Status)

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	if len(bodyBytes) > 0 {
		fmt.Println("Resposta:", string(bodyBytes))
	}

	// Considerar sucesso apenas se status 2xx
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func sendHeartbeatWithRetry(endpoint string, data *HeartbeatPayload, queue bool) bool {
	jsonData, _ := json.Marshal(data)

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		fmt.Println("Erro ao enviar heartbeat:", err)
		if queue {
			queuePayload("heartbeat", endpoint, data)
		}
		return false
	}
	defer resp.Body.Close()

	fmt.Println("Heartbeat enviado para:", endpoint, "Status:", resp.Status)

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	if len(bodyBytes) > 0 {
		fmt.Println("Resposta heartbeat:", string(bodyBytes))
	}

	// Considerar sucesso apenas se status 2xx
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func loadConfig() (*Config, error) {
	configPaths := []string{"config.json"}

	if exePath, err := os.Executable(); err == nil {
		configPaths = append(configPaths, filepath.Join(filepath.Dir(exePath), "config.json"))
	}

	if programData := os.Getenv("ProgramData"); programData != "" {
		configPaths = append(configPaths, filepath.Join(programData, "InventarioTIAgent", "config.json"))
	}

	var readErr error

	for _, path := range configPaths {
		bytes, err := os.ReadFile(path)
		if err != nil {
			readErr = err
			continue
		}

		var config Config
		if err := json.Unmarshal(bytes, &config); err != nil {
			return nil, fmt.Errorf("erro ao ler %s: %w", path, err)
		}

		if config.IntervalMinutes <= 0 {
			config.IntervalMinutes = 10
		}

		if config.HeartbeatMinutes <= 0 {
			config.HeartbeatMinutes = 5
		}

		if config.InventoryHours <= 0 {
			config.InventoryHours = 12
		}

		if config.HeartbeatEndpoint == "" {
			config.HeartbeatEndpoint = config.Endpoint + "/api/agent/heartbeat"
		}

		log.Println("Config carregada:", path)
		return &config, nil
	}

	if readErr != nil {
		return nil, readErr
	}

	return nil, fmt.Errorf("config.json nao encontrado")
}

func getIP() string {
	addrs, _ := net.InterfaceAddrs()
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			return ipnet.IP.String()
		}
	}
	return ""
}

func collectSystem() (string, string, string, string, uint64) {
	h, _ := host.Info()
	c, _ := cpu.Info()
	m, _ := mem.VirtualMemory()

	cpuName := ""
	if len(c) > 0 {
		cpuName = c[0].ModelName
	}

	return h.Hostname, h.OS, h.Platform, cpuName, m.Total
}

func collectCPUUsage() float64 {
	percent, _ := cpu.Percent(time.Second, false)
	if len(percent) > 0 {
		return percent[0]
	}
	return 0.0
}

func collectMemoryUsage() float64 {
	m, _ := mem.VirtualMemory()
	return m.UsedPercent
}

func collectUptime() int64 {
	h, _ := host.Info()
	return int64(h.Uptime)
}

func main() {
	if err := initLogger(); err != nil {
		fmt.Println("Erro ao inicializar logger:", err)
		return
	}

	log.Println("Agent iniciado...")

	config, err := loadConfig()
	if err != nil {
		log.Println("Erro ao carregar config.json:", err)
		return
	}

	if config.Endpoint == "" || config.TenantSlug == "" || config.APIKey == "" {
		log.Println("config.json precisa de endpoint, tenant_slug e api_key")
		return
	}

	hostname, osys, platform, cpuName, ram := collectSystem()
	identity := resolveDeviceIdentity(config.DeviceID, hostname)

	log.Println("Device ID:", identity.DeviceID, "fonte:", identity.Source)
	log.Println("Heartbeat a cada", config.HeartbeatMinutes, "minutos")
	log.Println("Inventario completo a cada", config.InventoryHours, "horas")

	heartbeatTicker := time.NewTicker(time.Duration(config.HeartbeatMinutes) * time.Minute)
	inventoryTicker := time.NewTicker(time.Duration(config.InventoryHours) * time.Hour)
	queueTicker := time.NewTicker(1 * time.Minute) // Processar fila a cada minuto

	defer heartbeatTicker.Stop()
	defer inventoryTicker.Stop()
	defer queueTicker.Stop()

	// Enviar heartbeat e inventario na inicializacao
	go func() {
		sendHeartbeatWithRetry(config.HeartbeatEndpoint, &HeartbeatPayload{
			TenantSlug:         config.TenantSlug,
			DeviceID:           identity.DeviceID,
			APIKey:             config.APIKey,
			Hostname:           hostname,
			IP:                 getIP(),
			CPUUsagePercent:    collectCPUUsage(),
			MemoryUsagePercent: collectMemoryUsage(),
			UptimeSeconds:      collectUptime(),
		}, true)
	}()

	go func() {
		ip := getIP()
		softwares := collectSoftwares()

		payload := &Payload{
			TenantSlug: config.TenantSlug,
			DeviceID:   identity.DeviceID,
			APIKey:     config.APIKey,
			Hostname:   hostname,
			OS:         osys,
			Platform:   platform,
			CPU:        cpuName,
			RAM:        ram,
			IP:         ip,
			Softwares:  softwares,
		}

		sendWithRetry(config.Endpoint, payload, true)
	}()

	// Processar fila na inicializacao
	go processQueue()

	for {
		select {
		case <-heartbeatTicker.C:
			go func() {
				sendHeartbeatWithRetry(config.HeartbeatEndpoint, &HeartbeatPayload{
					TenantSlug:         config.TenantSlug,
					DeviceID:           identity.DeviceID,
					APIKey:             config.APIKey,
					Hostname:           hostname,
					IP:                 getIP(),
					CPUUsagePercent:    collectCPUUsage(),
					MemoryUsagePercent: collectMemoryUsage(),
					UptimeSeconds:      collectUptime(),
				}, true)
			}()

		case <-inventoryTicker.C:
			go func() {
				ip := getIP()
				softwares := collectSoftwares()

				payload := &Payload{
					TenantSlug: config.TenantSlug,
					DeviceID:   identity.DeviceID,
					APIKey:     config.APIKey,
					Hostname:   hostname,
					OS:         osys,
					Platform:   platform,
					CPU:        cpuName,
					RAM:        ram,
					IP:         ip,
					Softwares:  softwares,
				}

				sendWithRetry(config.Endpoint, payload, true)
			}()

		case <-queueTicker.C:
			go processQueue()
		}
	}
}

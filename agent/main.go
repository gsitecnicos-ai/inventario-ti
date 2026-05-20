package main

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kardianos/service"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"gopkg.in/natefinch/lumberjack.v2"
)

const AgentVersion = "0.3.0"
const defaultServiceName = "InventarioTIAgent"
const defaultServiceDisplayName = "Inventario TI Agent"

type Config struct {
	Endpoint          string `json:"endpoint"`
	HeartbeatEndpoint string `json:"heartbeat_endpoint"`
	UpdateEndpoint    string `json:"update_endpoint"`
	TenantSlug        string `json:"tenant_slug"`
	DeviceID          string `json:"device_id"`
	APIKey            string `json:"api_key"`
	IntervalMinutes   int    `json:"interval_minutes"`
	HeartbeatMinutes  int    `json:"heartbeat_minutes"`
	InventoryHours    int    `json:"inventory_hours"`
	UpdateMinutes     int    `json:"update_minutes"`
	ServiceName       string `json:"service_name"`
}

type HeartbeatPayload struct {
	TenantSlug         string     `json:"tenant_slug"`
	DeviceID           string     `json:"device_id"`
	APIKey             string     `json:"api_key"`
	Hostname           string     `json:"hostname"`
	IP                 string     `json:"ip"`
	CPUUsagePercent    float64    `json:"cpu_usage_percent"`
	MemoryUsagePercent float64    `json:"memory_usage_percent"`
	UptimeSeconds      int64      `json:"uptime_seconds"`
	Telemetry          *Telemetry `json:"telemetry,omitempty"`
}

type Software struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Publisher string `json:"publisher"`
}

type StorageDevice struct {
	Model     string `json:"model"`
	Serial    string `json:"serial"`
	SizeBytes uint64 `json:"size_bytes"`
	MediaType string `json:"media_type"`
}

type Payload struct {
	TenantSlug            string          `json:"tenant_slug"`
	DeviceID              string          `json:"device_id"`
	APIKey                string          `json:"api_key"`
	Hostname              string          `json:"hostname"`
	OS                    string          `json:"os"`
	Platform              string          `json:"platform"`
	CPU                   string          `json:"cpu"`
	RAM                   uint64          `json:"ram"`
	IP                    string          `json:"ip"`
	Softwares             []Software      `json:"softwares,omitempty"`
	StorageDevices        []StorageDevice `json:"storage_devices,omitempty"`
	PayloadType           string          `json:"payload_type,omitempty"`
	InventoryHash         string          `json:"inventory_hash,omitempty"`
	PreviousInventoryHash string          `json:"previous_inventory_hash,omitempty"`
	Telemetry             *Telemetry      `json:"telemetry,omitempty"`
}

type Telemetry struct {
	CollectionDurationMs int64  `json:"collection_duration_ms,omitempty"`
	RetryCount           int    `json:"retry_count,omitempty"`
	MemoryUsageBytes     uint64 `json:"memory_usage_bytes,omitempty"`
	QueueDepth           int    `json:"queue_depth,omitempty"`
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

type agentService struct {
	config *Config
	stop   chan struct{}
	done   chan struct{}
}

func (agent *agentService) Start(service.Service) error {
	agent.stop = make(chan struct{})
	agent.done = make(chan struct{})

	go func() {
		defer close(agent.done)
		runAgent(agent.config, agent.stop)
	}()

	return nil
}

func (agent *agentService) Stop(service.Service) error {
	close(agent.stop)

	select {
	case <-agent.done:
	case <-time.After(15 * time.Second):
	}

	return nil
}

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

func countQueueFiles() int {
	queueDir, err := getQueueDir()
	if err != nil {
		return 0
	}

	files, err := os.ReadDir(queueDir)
	if err != nil {
		return 0
	}

	count := 0
	for _, f := range files {
		if !f.IsDir() && filepath.Ext(f.Name()) == ".json" {
			count++
		}
	}

	return count
}

func gzipPayload(data []byte) ([]byte, error) {
	var buffer bytes.Buffer
	writer := gzip.NewWriter(&buffer)
	if _, err := writer.Write(data); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func computeInventoryHash(osName, platform, cpuName string, ram uint64, softwares []Software, storageDevices []StorageDevice) string {
	sortedSoftwares := append([]Software(nil), softwares...)
	sort.Slice(sortedSoftwares, func(i, j int) bool {
		if sortedSoftwares[i].Name != sortedSoftwares[j].Name {
			return sortedSoftwares[i].Name < sortedSoftwares[j].Name
		}
		if sortedSoftwares[i].Version != sortedSoftwares[j].Version {
			return sortedSoftwares[i].Version < sortedSoftwares[j].Version
		}
		return sortedSoftwares[i].Publisher < sortedSoftwares[j].Publisher
	})

	sortedStorage := append([]StorageDevice(nil), storageDevices...)
	sort.Slice(sortedStorage, func(i, j int) bool {
		if sortedStorage[i].Model != sortedStorage[j].Model {
			return sortedStorage[i].Model < sortedStorage[j].Model
		}
		if sortedStorage[i].Serial != sortedStorage[j].Serial {
			return sortedStorage[i].Serial < sortedStorage[j].Serial
		}
		if sortedStorage[i].MediaType != sortedStorage[j].MediaType {
			return sortedStorage[i].MediaType < sortedStorage[j].MediaType
		}
		return sortedStorage[i].SizeBytes < sortedStorage[j].SizeBytes
	})

	payloadData, _ := json.Marshal(struct {
		OS             string          `json:"os"`
		Platform       string          `json:"platform"`
		CPU            string          `json:"cpu"`
		RAM            uint64          `json:"ram"`
		Softwares      []Software      `json:"softwares"`
		StorageDevices []StorageDevice `json:"storage_devices"`
	}{
		OS:             osName,
		Platform:       platform,
		CPU:            cpuName,
		RAM:            ram,
		Softwares:      sortedSoftwares,
		StorageDevices: sortedStorage,
	})

	hash := sha256.Sum256(payloadData)
	return hex.EncodeToString(hash[:])
}

func loadInventoryState() (string, error) {
	queueDir, err := getQueueDir()
	if err != nil {
		return "", err
	}

	statePath := filepath.Join(queueDir, "inventory-state.json")
	content, err := os.ReadFile(statePath)
	if err != nil {
		return "", nil
	}

	var state struct {
		LastInventoryHash string `json:"last_inventory_hash"`
	}
	if err := json.Unmarshal(content, &state); err != nil {
		return "", nil
	}

	return state.LastInventoryHash, nil
}

func saveInventoryState(hash string) error {
	queueDir, err := getQueueDir()
	if err != nil {
		return err
	}

	statePath := filepath.Join(queueDir, "inventory-state.json")
	state := struct {
		LastInventoryHash string `json:"last_inventory_hash"`
	}{
		LastInventoryHash: hash,
	}

	content, err := json.Marshal(state)
	if err != nil {
		return err
	}

	return os.WriteFile(statePath, content, 0644)
}

func buildTelemetry(durationMs int64, retryCount int) *Telemetry {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)

	return &Telemetry{
		CollectionDurationMs: durationMs,
		RetryCount:           retryCount,
		MemoryUsageBytes:     mem.Alloc,
		QueueDepth:           countQueueFiles(),
	}
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
			log.Printf("Erro ao ler fila %s: %v", f.Name(), err)
			continue
		}

		var queued QueuedPayload
		if err := json.Unmarshal(fileContent, &queued); err != nil {
			log.Printf("Erro ao desserializar fila %s: %v", f.Name(), err)
			continue
		}

		// Tentar enviar
		success := false

		switch queued.Type {
		case "heartbeat":
			var hb HeartbeatPayload
			if err := json.Unmarshal(queued.Data, &hb); err == nil {
				success = sendHeartbeatWithRetry(queued.Endpoint, &hb, false)
			}
		case "inventory":
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

			log.Println("Fila enviada e removida:", f.Name())
		}
	}
}

func sendWithRetry(endpoint string, data *Payload, queue bool) bool {
	jsonData, _ := json.Marshal(data)
	compressed, err := gzipPayload(jsonData)
	if err != nil {
		log.Println("Erro ao comprimir payload:", err)
		return false
	}

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(compressed))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		log.Println("Erro ao enviar:", err)
		if queue {
			queuePayload("inventory", endpoint, data)
		}
		return false
	}
	defer resp.Body.Close()

	log.Println("Enviado para:", endpoint)
	log.Println("Enviado com status:", resp.Status)

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	if len(bodyBytes) > 0 {
		log.Println("Resposta:", string(bodyBytes))
	}

	// Considerar sucesso apenas se status 2xx
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func sendHeartbeatWithRetry(endpoint string, data *HeartbeatPayload, queue bool) bool {
	jsonData, _ := json.Marshal(data)
	compressed, err := gzipPayload(jsonData)
	if err != nil {
		log.Println("Erro ao comprimir heartbeat:", err)
		return false
	}

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(compressed))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		log.Println("Erro ao enviar heartbeat:", err)
		if queue {
			queuePayload("heartbeat", endpoint, data)
		}
		return false
	}
	defer resp.Body.Close()

	log.Println("Heartbeat enviado para:", endpoint, "Status:", resp.Status)

	bodyBytes, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	if len(bodyBytes) > 0 {
		log.Println("Resposta heartbeat:", string(bodyBytes))
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

		if config.UpdateMinutes <= 0 {
			config.UpdateMinutes = 60
		}

		if config.HeartbeatEndpoint == "" {
			config.HeartbeatEndpoint = config.Endpoint + "/api/agent/heartbeat"
		}

		if config.UpdateEndpoint == "" {
			config.UpdateEndpoint = config.Endpoint + "/api/agent/update"
		}

		if config.ServiceName == "" {
			config.ServiceName = defaultServiceName
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

func runAgent(config *Config, stop <-chan struct{}) {
	if config.Endpoint == "" || config.TenantSlug == "" || config.APIKey == "" {
		log.Println("config.json precisa de endpoint, tenant_slug e api_key")
		return
	}

	allowHttp := strings.ToLower(os.Getenv("ALLOW_HTTP")) == "true" || strings.ToLower(os.Getenv("NODE_ENV")) == "development"
	if !allowHttp {
		// Ensure endpoints use HTTPS to avoid MITM in production
		if !strings.HasPrefix(strings.ToLower(config.Endpoint), "https://") {
			log.Println("Endpoint nao usa HTTPS. Defina ALLOW_HTTP=true para permitir HTTP em desenvolvimento.")
			return
		}
		if !strings.HasPrefix(strings.ToLower(config.HeartbeatEndpoint), "https://") {
			log.Println("HeartbeatEndpoint nao usa HTTPS. Defina ALLOW_HTTP=true para permitir HTTP em desenvolvimento.")
			return
		}
		if !strings.HasPrefix(strings.ToLower(config.UpdateEndpoint), "https://") {
			log.Println("UpdateEndpoint nao usa HTTPS. Defina ALLOW_HTTP=true para permitir HTTP em desenvolvimento.")
			return
		}
	}

	hostname, osys, platform, cpuName, ram := collectSystem()
	identity := resolveDeviceIdentity(config.DeviceID, hostname)

	log.Println("Device ID:", identity.DeviceID, "fonte:", identity.Source)
	log.Println("Versao do agente:", AgentVersion)
	log.Println("Heartbeat a cada", config.HeartbeatMinutes, "minutos")
	log.Println("Inventario completo a cada", config.InventoryHours, "horas")
	log.Println("Auto update a cada", config.UpdateMinutes, "minutos")

	heartbeatTicker := time.NewTicker(time.Duration(config.HeartbeatMinutes) * time.Minute)
	inventoryTicker := time.NewTicker(time.Duration(config.InventoryHours) * time.Hour)
	updateTicker := time.NewTicker(time.Duration(config.UpdateMinutes) * time.Minute)
	queueTicker := time.NewTicker(1 * time.Minute) // Processar fila a cada minuto

	defer heartbeatTicker.Stop()
	defer inventoryTicker.Stop()
	defer updateTicker.Stop()
	defer queueTicker.Stop()

	lastInventoryHash, _ := loadInventoryState()

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
			Telemetry:          buildTelemetry(0, 0),
		}, true)
	}()

	go func() {
		start := time.Now()
		ip := getIP()
		softwares := collectSoftwares()
		storageDevices := collectStorageDevices()
		collectionDuration := time.Since(start).Milliseconds()
		hash := computeInventoryHash(osys, platform, cpuName, ram, softwares, storageDevices)
		payloadType := "inventory_snapshot"
		if hash == lastInventoryHash && hash != "" {
			payloadType = "inventory_delta"
		}

		payload := &Payload{
			TenantSlug:            config.TenantSlug,
			DeviceID:              identity.DeviceID,
			APIKey:                config.APIKey,
			Hostname:              hostname,
			OS:                    osys,
			Platform:              platform,
			CPU:                   cpuName,
			RAM:                   ram,
			IP:                    ip,
			PayloadType:           payloadType,
			InventoryHash:         hash,
			PreviousInventoryHash: lastInventoryHash,
			Telemetry:             buildTelemetry(collectionDuration, 0),
		}

		if payloadType == "inventory_snapshot" {
			payload.Softwares = softwares
			payload.StorageDevices = storageDevices
		}

		success := sendWithRetry(config.Endpoint, payload, true)
		if success && payloadType == "inventory_snapshot" {
			_ = saveInventoryState(hash)
			lastInventoryHash = hash
		}
	}()

	// Processar fila na inicializacao
	go processQueue()
	go checkForUpdate(config)

	for {
		select {
		case <-stop:
			log.Println("Agent parado.")
			return

		case <-heartbeatTicker.C:
			go func() {
				start := time.Now()
				sendHeartbeatWithRetry(config.HeartbeatEndpoint, &HeartbeatPayload{
					TenantSlug:         config.TenantSlug,
					DeviceID:           identity.DeviceID,
					APIKey:             config.APIKey,
					Hostname:           hostname,
					IP:                 getIP(),
					CPUUsagePercent:    collectCPUUsage(),
					MemoryUsagePercent: collectMemoryUsage(),
					UptimeSeconds:      collectUptime(),
					Telemetry:          buildTelemetry(time.Since(start).Milliseconds(), 0),
				}, true)
			}()

		case <-inventoryTicker.C:
			go func() {
				start := time.Now()
				ip := getIP()
				softwares := collectSoftwares()
				storageDevices := collectStorageDevices()
				collectionDuration := time.Since(start).Milliseconds()
				hash := computeInventoryHash(osys, platform, cpuName, ram, softwares, storageDevices)
				payloadType := "inventory_snapshot"
				if hash == lastInventoryHash && hash != "" {
					payloadType = "inventory_delta"
				}

				payload := &Payload{
					TenantSlug:            config.TenantSlug,
					DeviceID:              identity.DeviceID,
					APIKey:                config.APIKey,
					Hostname:              hostname,
					OS:                    osys,
					Platform:              platform,
					CPU:                   cpuName,
					RAM:                   ram,
					IP:                    ip,
					PayloadType:           payloadType,
					InventoryHash:         hash,
					PreviousInventoryHash: lastInventoryHash,
					Telemetry:             buildTelemetry(collectionDuration, 0),
				}

				if payloadType == "inventory_snapshot" {
					payload.Softwares = softwares
					payload.StorageDevices = storageDevices
				}

				success := sendWithRetry(config.Endpoint, payload, true)
				if success && payloadType == "inventory_snapshot" {
					_ = saveInventoryState(hash)
					lastInventoryHash = hash
				}
			}()

		case <-queueTicker.C:
			go processQueue()

		case <-updateTicker.C:
			go checkForUpdate(config)
		}
	}
}

func buildService(config *Config) (service.Service, error) {
	serviceConfig := &service.Config{
		Name:        config.ServiceName,
		DisplayName: defaultServiceDisplayName,
		Description: "Envia inventario, heartbeats e updates de ativos para Inventario TI.",
		Option: service.KeyValue{
			"StartType": "automatic",
		},
	}

	return service.New(&agentService{config: config}, serviceConfig)
}

func runServiceCommand(svc service.Service, command string) bool {
	if command == "" {
		return false
	}

	switch command {
	case "install", "uninstall", "start", "stop", "restart":
		if err := service.Control(svc, command); err != nil {
			log.Printf("Erro ao executar comando de servico %s: %v", command, err)
			os.Exit(1)
		}

		log.Println("Comando de servico executado:", command)
		return true
	default:
		return false
	}
}

func main() {
	if err := initLogger(); err != nil {
		log.Println("Erro ao inicializar logger:", err)
		return
	}

	log.Println("Agent iniciado...")

	config, err := loadConfig()
	if err != nil {
		log.Println("Erro ao carregar config.json:", err)
		return
	}

	svc, err := buildService(config)
	if err != nil {
		log.Println("Erro ao preparar servico:", err)
		return
	}

	if len(os.Args) > 1 && runServiceCommand(svc, strings.ToLower(os.Args[1])) {
		return
	}

	if err := svc.Run(); err != nil {
		log.Println("Erro ao executar servico:", err)
	}
}

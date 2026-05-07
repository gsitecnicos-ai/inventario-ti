package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type Config struct {
	Endpoint        string `json:"endpoint"`
	TenantSlug      string `json:"tenant_slug"`
	DeviceID        string `json:"device_id"`
	APIKey          string `json:"api_key"`
	IntervalMinutes int    `json:"interval_minutes"`
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

func loadConfig() (*Config, error) {
	file, err := os.Open("config.json")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, err := os.ReadFile(file.Name())
	if err != nil {
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(bytes, &config); err != nil {
		return nil, err
	}

	if config.IntervalMinutes <= 0 {
		config.IntervalMinutes = 10
	}

	return &config, nil
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

func send(endpoint string, data *Payload) {
	jsonData, _ := json.Marshal(data)

	req, _ := http.NewRequest("POST", endpoint, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)

	if err != nil {
		fmt.Println("Erro ao enviar:", err)
		return
	}
	defer resp.Body.Close()

	fmt.Println("Enviado com status:", resp.Status)
}

func main() {
	fmt.Println("Agent iniciado...")

	config, err := loadConfig()
	if err != nil {
		fmt.Println("Erro ao carregar config.json")
		return
	}

	if config.Endpoint == "" || config.TenantSlug == "" || config.DeviceID == "" || config.APIKey == "" {
		fmt.Println("config.json precisa de endpoint, tenant_slug, device_id e api_key")
		return
	}

	for {
		hostname, osys, platform, cpuName, ram := collectSystem()
		ip := getIP()
		softwares := collectSoftwares()

		payload := &Payload{
			TenantSlug: config.TenantSlug,
			DeviceID:   config.DeviceID,
			APIKey:     config.APIKey,
			Hostname:   hostname,
			OS:         osys,
			Platform:   platform,
			CPU:        cpuName,
			RAM:        ram,
			IP:         ip,
			Softwares:  softwares,
		}

		send(config.Endpoint, payload)

		time.Sleep(time.Duration(config.IntervalMinutes) * time.Minute)
	}
}

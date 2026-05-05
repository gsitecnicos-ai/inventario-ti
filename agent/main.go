package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net"
	"net/http"
	"os"
	"time"

	"golang.org/x/sys/windows/registry"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
)

type Config struct {
	DeviceID string `json:"device_id"`
	APIKey   string `json:"api_key"`
}

type Software struct {
	Name      string `json:"name"`
	Version   string `json:"version"`
	Publisher string `json:"publisher"`
}

type Payload struct {
	DeviceID string     `json:"device_id"`
	APIKey   string     `json:"api_key"`
	Hostname string     `json:"hostname"`
	OS       string     `json:"os"`
	Platform string     `json:"platform"`
	CPU      string     `json:"cpu"`
	RAM      uint64     `json:"ram"`
	IP       string     `json:"ip"`
	Softwares []Software `json:"softwares"`
}

func loadConfig() (*Config, error) {
	file, err := os.Open("config.json")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	bytes, _ := ioutil.ReadAll(file)

	var config Config
	json.Unmarshal(bytes, &config)

	return &config, nil
}

func getIP() string {
	addrs, _ := net.InterfaceAddrs()
	for _, addr := range addrs {
		if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			return ipnet.IP.String()
		}
	}
	return ""
}

func getSoftwares(path string) []Software {
	var softwares []Software

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, path, registry.READ)
	if err != nil {
		return softwares
	}
	defer k.Close()

	subKeys, _ := k.ReadSubKeyNames(-1)

	for _, subKey := range subKeys {
		sk, err := registry.OpenKey(k, subKey, registry.READ)
		if err != nil {
			continue
		}

		name, _, _ := sk.GetStringValue("DisplayName")
		version, _, _ := sk.GetStringValue("DisplayVersion")
		publisher, _, _ := sk.GetStringValue("Publisher")

		if name != "" {
			softwares = append(softwares, Software{
				Name:      name,
				Version:   version,
				Publisher: publisher,
			})
		}

		sk.Close()
	}

	return softwares
}

func collectSoftwares() []Software {
	paths := []string{
		`SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
		`SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall`,
	}

	var all []Software

	for _, p := range paths {
		list := getSoftwares(p)
		all = append(all, list...)
	}

	return all
}

func collectSystem() (string, string, string, string, uint64) {
	h, _ := host.Info()
	c, _ := cpu.Info()
	m, _ := mem.VirtualMemory()

	return h.Hostname, h.OS, h.Platform, c[0].ModelName, m.Total
}

func send(data *Payload) {
	jsonData, _ := json.Marshal(data)

	req, _ := http.NewRequest("POST", "https://SUA-API.com/api/agent/checkin", bytes.NewBuffer(jsonData))
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

	for {
		hostname, osys, platform, cpuName, ram := collectSystem()
		ip := getIP()
		softwares := collectSoftwares()

		payload := &Payload{
			DeviceID: config.DeviceID,
			APIKey:   config.APIKey,
			Hostname: hostname,
			OS:       osys,
			Platform: platform,
			CPU:      cpuName,
			RAM:      ram,
			IP:       ip,
			Softwares: softwares,
		}

		send(payload)

		time.Sleep(10 * time.Minute)
	}
}
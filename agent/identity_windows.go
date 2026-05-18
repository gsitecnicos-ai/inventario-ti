//go:build windows

package main

import (
	"net"
	"sort"
	"strings"

	"github.com/yusufpapurcu/wmi"
	"golang.org/x/sys/windows/registry"
)

type Win32_BIOS struct {
	SerialNumber string
}

type Win32_ComputerSystemProduct struct {
	UUID string
}

func collectIdentityCandidates() []IdentityCandidate {
	return []IdentityCandidate{
		{Source: "bios_serial", Value: queryBiosSerial()},
		{Source: "motherboard_uuid", Value: queryMotherboardUUID()},
		{Source: "machine_guid", Value: queryMachineGuid()},
		{Source: "primary_mac", Value: queryPrimaryMAC()},
	}
}

func queryMachineGuid() string {
	key, err := registry.OpenKey(
		registry.LOCAL_MACHINE,
		`SOFTWARE\Microsoft\Cryptography`,
		registry.QUERY_VALUE|registry.WOW64_64KEY,
	)
	if err != nil {
		return ""
	}
	defer key.Close()

	value, _, err := key.GetStringValue("MachineGuid")
	if err != nil {
		return ""
	}

	return value
}

func queryBiosSerial() string {
	var dst []Win32_BIOS
	if err := wmi.Query(wmi.CreateQuery(&dst, ""), &dst); err != nil || len(dst) == 0 {
		return ""
	}

	return dst[0].SerialNumber
}

func queryMotherboardUUID() string {
	var dst []Win32_ComputerSystemProduct
	if err := wmi.Query(wmi.CreateQuery(&dst, ""), &dst); err != nil || len(dst) == 0 {
		return ""
	}

	return dst[0].UUID
}

func queryPrimaryMAC() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	var candidates []string
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 ||
			iface.Flags&net.FlagLoopback != 0 ||
			len(iface.HardwareAddr) == 0 {
			continue
		}

		name := strings.ToLower(iface.Name)
		if strings.Contains(name, "virtual") ||
			strings.Contains(name, "loopback") ||
			strings.Contains(name, "bluetooth") {
			continue
		}

		candidates = append(candidates, iface.HardwareAddr.String())
	}

	sort.Strings(candidates)
	if len(candidates) == 0 {
		return ""
	}

	return candidates[0]
}

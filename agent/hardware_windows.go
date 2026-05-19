//go:build windows

package main

import (
	"sort"
	"strings"

	"github.com/yusufpapurcu/wmi"
)

type Win32_DiskDrive struct {
	Model        string
	SerialNumber string
	Size         uint64
	MediaType    string
}

func collectStorageDevices() []StorageDevice {
	var dst []Win32_DiskDrive
	if err := wmi.Query(wmi.CreateQuery(&dst, ""), &dst); err != nil {
		return []StorageDevice{}
	}

	devices := make([]StorageDevice, 0, len(dst))
	for _, drive := range dst {
		model := strings.TrimSpace(drive.Model)
		serial := strings.TrimSpace(drive.SerialNumber)
		mediaType := strings.TrimSpace(drive.MediaType)

		if model == "" && serial == "" && drive.Size == 0 {
			continue
		}

		devices = append(devices, StorageDevice{
			Model:     model,
			Serial:    serial,
			SizeBytes: drive.Size,
			MediaType: mediaType,
		})
	}

	sort.Slice(devices, func(i, j int) bool {
		left := devices[i].Model + devices[i].Serial
		right := devices[j].Model + devices[j].Serial

		return left < right
	})

	return devices
}

//go:build !windows

package main

func collectStorageDevices() []StorageDevice {
	return []StorageDevice{}
}

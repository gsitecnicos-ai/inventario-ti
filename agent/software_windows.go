//go:build windows

package main

import "golang.org/x/sys/windows/registry"

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
		`SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`,
		`SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`,
	}

	var all []Software

	for _, p := range paths {
		list := getSoftwares(p)
		all = append(all, list...)
	}

	return all
}

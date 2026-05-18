//go:build !windows

package main

import (
	"net"
	"sort"
)

func collectIdentityCandidates() []IdentityCandidate {
	return []IdentityCandidate{
		{Source: "primary_mac", Value: queryPrimaryMAC()},
	}
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

		candidates = append(candidates, iface.HardwareAddr.String())
	}

	sort.Strings(candidates)
	if len(candidates) == 0 {
		return ""
	}

	return candidates[0]
}

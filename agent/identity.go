package main

import (
	"crypto/sha256"
	"encoding/base32"
	"strings"
)

type IdentityCandidate struct {
	Source string
	Value  string
}

type DeviceIdentity struct {
	DeviceID string
	Source   string
}

func resolveDeviceIdentity(configDeviceID string, hostname string) DeviceIdentity {
	if manual := strings.TrimSpace(configDeviceID); manual != "" {
		return DeviceIdentity{
			DeviceID: manual,
			Source:   "config.device_id",
		}
	}

	for _, candidate := range collectIdentityCandidates() {
		value := normalizeIdentityValue(candidate.Value)
		if !isUsefulIdentityValue(value) {
			continue
		}

		return DeviceIdentity{
			DeviceID: hashedDeviceID(candidate.Source, value),
			Source:   candidate.Source,
		}
	}

	if fallback := strings.TrimSpace(hostname); fallback != "" {
		return DeviceIdentity{
			DeviceID: hashedDeviceID("hostname", fallback),
			Source:   "hostname",
		}
	}

	return DeviceIdentity{
		DeviceID: hashedDeviceID("agent", "unknown-device"),
		Source:   "fallback",
	}
}

func hashedDeviceID(source string, value string) string {
	sum := sha256.Sum256([]byte(source + "\x00" + value))
	encoded := base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(sum[:])

	return "DEV-" + encoded[:20]
}

func normalizeIdentityValue(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Trim(value, "\x00")
	value = strings.Join(strings.Fields(value), " ")

	return strings.ToUpper(value)
}

func isUsefulIdentityValue(value string) bool {
	if value == "" {
		return false
	}

	compact := strings.NewReplacer("-", "", ":", "", " ", "", ".", "").Replace(value)
	if compact == "" || strings.Trim(compact, "0") == "" || strings.Trim(compact, "F") == "" {
		return false
	}

	invalidValues := map[string]struct{}{
		"DEFAULT STRING":         {},
		"NONE":                   {},
		"NOT APPLICABLE":         {},
		"NOT AVAILABLE":          {},
		"NULL":                   {},
		"O.E.M.":                 {},
		"SYSTEM SERIAL NUMBER":   {},
		"TO BE FILLED BY O.E.M.": {},
		"UNKNOWN":                {},
		"UNKNOWN UUID":           {},
		"UNSPECIFIED":            {},
	}

	_, invalid := invalidValues[value]
	return !invalid
}

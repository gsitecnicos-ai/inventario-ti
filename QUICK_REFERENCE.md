# Quick Reference - Agent Offline Queue

## 📍 Queue Location
```
C:\ProgramData\InventarioTIAgent\Queue\
```

## 📄 File Format
```
payload-001.json
payload-002.json
payload-003.json
...
```

---

## 🔍 Check Queue Status

### Windows Command Line
```bash
# List queue files
dir C:\ProgramData\InventarioTIAgent\Queue\

# Count pending items
dir C:\ProgramData\InventarioTIAgent\Queue\*.json | find /c ".json"

# View first queued payload
type C:\ProgramData\InventarioTIAgent\Queue\payload-001.json
```

### PowerShell
```powershell
# List with details
Get-ChildItem "$env:ProgramData\InventarioTIAgent\Queue\" -Filter "*.json"

# Count pending
(Get-ChildItem "$env:ProgramData\InventarioTIAgent\Queue\" -Filter "*.json").Count

# Total size
(Get-ChildItem "$env:ProgramData\InventarioTIAgent\Queue\" -Filter "*.json" | Measure-Object -Sum Length).Sum
```

---

## 🚀 Start/Stop Agent

### Windows Service (if installed)
```bash
# Start
net start InventarioTIAgent

# Stop
net stop InventarioTIAgent

# Status
nssm status InventarioTIAgent
```

### Manual Start
```bash
C:\ProgramData\InventarioTIAgent\inventario-ti.exe
```

---

## 🧪 Simulate Network Issues

### Block API (Test Queue)
```batch
netsh advfirewall firewall add rule name="Block-API" dir=out action=block remoteip=192.0.2.1

REM (run agent for 5-10 minutes)

netsh advfirewall firewall delete rule name="Block-API"
```

### Verify Queue Populated
```bash
dir C:\ProgramData\InventarioTIAgent\Queue\

REM Wait 1 minute, should see files deleted as API comes back online
```

---

## 🔧 Configuration

**File**: `C:\ProgramData\InventarioTIAgent\config.json`

```json
{
  "endpoint": "https://api.example.com/api/agent/checkin",
  "heartbeat_endpoint": "https://api.example.com/api/agent/heartbeat",
  "tenant_slug": "empresa-cliente",
  "device_id": "optional-id",
  "api_key": "your-secret-key",
  "heartbeat_minutes": 5,
  "inventory_hours": 12
}
```

**Key Settings**:
- `heartbeat_minutes`: How often to check in (5 = every 5 minutes)
- `inventory_hours`: Full inventory frequency (12 = every 12 hours)
- Queue automatically retries every 1 minute

---

## 📊 Expected Behavior

### Normal (API Online)
```
10:05 → Heartbeat sent ✓
10:10 → Heartbeat sent ✓
10:15 → Heartbeat sent ✓
10:20 → Heartbeat sent ✓
(Queue empty)
```

### Outage (API Down for 20 min)
```
10:05 → Heartbeat queued ✗ (payload-001.json created)
10:06 → Queue processor tries payload-001 ✗ (API still down)
10:10 → Heartbeat queued ✗ (payload-002.json created)
10:11 → Queue processor tries 001,002 ✗ (API still down)
...
10:25 → API back online
10:26 → Queue processor:
        ✓ Sends payload-001 successfully
        ✓ Deletes payload-001.json
        ✓ Sends payload-002 successfully
        ✓ Deletes payload-002.json
(Queue empty)
```

---

## ⚠️ Alerts to Watch For

| Alert | Cause | Action |
|-------|-------|--------|
| Queue has 10+ files | API intermittently unavailable | Check API health |
| Queue files > 1 week old | API down for extended period | Check network/API |
| Queue directory full | Disk space issue | Free disk space |
| Agent process not running | Crash or service stopped | Restart service |

---

## 🚨 Emergency Actions

### Clear Queue (Last Resort)
```bash
REM ONLY if absolutely necessary
REM This will lose queued data!

del C:\ProgramData\InventarioTIAgent\Queue\payload-*.json

REM Verify empty
dir C:\ProgramData\InventarioTIAgent\Queue\
```

### Restart Agent
```batch
REM Kill process
taskkill /IM inventario-ti.exe /F

REM Wait 5 seconds
timeout /T 5

REM Restart
net start InventarioTIAgent
REM OR
C:\ProgramData\InventarioTIAgent\inventario-ti.exe
```

### Reset Config
```batch
REM Backup current
copy C:\ProgramData\InventarioTIAgent\config.json config.json.backup

REM Restore from example
copy agent\config.example.json C:\ProgramData\InventarioTIAgent\config.json

REM Edit with correct values
notepad C:\ProgramData\InventarioTIAgent\config.json
```

---

## 📋 Monitoring Checklist

**Daily**:
- [ ] Queue directory is empty (or < 5 files)
- [ ] Agent process is running
- [ ] No recent error messages

**Weekly**:
- [ ] Review agent logs for errors
- [ ] Check API endpoints are responding
- [ ] Verify heartbeats in database

**Monthly**:
- [ ] Review queue sizes (should be 0)
- [ ] Update config if API endpoints changed
- [ ] Test disaster recovery procedure

---

## 📞 Escalation Path

| Issue | Level | Action |
|-------|-------|--------|
| Queue stuck with files | P2 | Check API, restart agent |
| Agent not running | P1 | Restart service immediately |
| Config file missing | P1 | Restore from backup |
| Disk full | P2 | Clear old logs, expand storage |
| API returns 401 | P2 | Verify API key, update config |

---

## 🔗 Related Docs

- Full implementation: [OFFLINE_QUEUE_SUMMARY.md](OFFLINE_QUEUE_SUMMARY.md)
- Testing guide: [QUEUE_DEPLOYMENT.md](QUEUE_DEPLOYMENT.md)
- Examples: [QUEUE_EXAMPLES.md](QUEUE_EXAMPLES.md)

---

## ✅ Verification

**Agent is working correctly if**:
- ✓ Process `inventario-ti.exe` is running
- ✓ Config file exists at `C:\ProgramData\InventarioTIAgent\config.json`
- ✓ Queue directory exists (usually empty)
- ✓ No obvious errors in console output

**Agent needs attention if**:
- ✗ Process not running
- ✗ Queue directory has 10+ files for > 1 hour
- ✗ Config file is missing or invalid JSON
- ✗ Repeated "Erro ao enviar" messages

---

**Last Updated**: May 18, 2026  
**Version**: 1.0  
**Status**: Production Ready

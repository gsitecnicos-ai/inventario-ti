# Inventario TI

Aplicacao multi-tenant para inventario de ativos de TI. A primeira versao do
produto organiza tenants, ativos, responsaveis, localizacao, criticidade,
status operacional e eventos recentes em um dashboard unico.

## Direcao do Produto

- Isolar dados por tenant/organizacao.
- Controlar ciclo de vida de ativos: uso, estoque, manutencao e atencao.
- Preparar a base para autenticacao, permissoes e persistencia em banco.
- Manter componentes reutilizaveis para evoluir telas de cadastro, auditoria e
  relatorios.

## Estrutura Atual

- `src/app/page.tsx`: roteador inicial de sessao para login, dashboard ou
  gestao de usuarios.
- `src/app/dashboard/page.tsx`: composicao do dashboard principal.
- `src/app/admin/users/page.tsx`: gestao de usuarios, vinculos e admins
  globais.
- `src/components/dashboard`: cards, tabela, lista de tenants e eventos.
- `src/lib/inventory-repository.ts`: leitura do dashboard no Supabase com
  fallback para mocks.
- `src/lib/inventory-data.ts`: tipos do dominio e dados mockados de fallback.
- `supabase/migrations`: schema multi-tenant com RLS.
- `supabase/seed.sql`: carga inicial com os dados da primeira versao.

## Supabase

Crie um arquivo `.env.local` com:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sua-chave-publica"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key"
```

Enquanto as telas de autenticacao ainda nao existem, `SUPABASE_SERVICE_ROLE_KEY`
permite que o dashboard server-side leia os dados iniciais. Mantenha essa chave
somente no servidor. Depois da autenticacao, o app deve usar sessoes de usuario
e deixar as policies de RLS filtrarem dados por tenant.

Para preparar o banco, aplique `supabase/migrations/001_inventory_multitenant.sql`
no Supabase e depois rode `supabase/seed.sql`.

Depois que um usuario criar conta pela tela `/login`, vincule-o a um tenant em
`tenant_members`. O arquivo `supabase/memberships.example.sql` tem um exemplo.

Para um administrador global com acesso a todos os clientes, aplique tambem a
migration `supabase/migrations/002_global_admins.sql` e rode
`supabase/global-admin.example.sql` trocando o e-mail pelo usuario correto.

## TLS/HTTPS Obrigatório

Por padrão, toda comunicação (servidor Next.js e agente Go) força HTTPS em produção para evitar ataques MITM.

### Servidor Next.js

- Middleware (`src/middleware.ts`) redireciona HTTP → HTTPS automaticamente.
- Adiciona header HSTS com `max-age=63072000`.
- Proxy/load-balancer **deve** definir `x-forwarded-proto: https` para requests seguros.

### Agente Go

- Rejeita endpoints sem HTTPS em produção.
- Endpoints no config.json devem começar com `https://`.

### Desenvolvimento Local

Para permitir HTTP em dev, defina:

```bash
ALLOW_HTTP=true
NODE_ENV=development
```

O agente Go respeita as mesmas variáveis para permitir endpoints HTTP.

## Code Signing do Agente

O executável `inventario-ti-agent-windows-amd64.exe` **deve ser assinado digitalmente** para reduzir
falsos positivos de antivírus.

### Obter Certificado Code Signing

1. Adquirir certificado EV (Extended Validation) ou Standard code signing em CA confiada:
   - Sectigo, DigiCert, GlobalSign, etc.
   - EV oferece melhor reputação junto AV.

2. Exportar certificado em formato PFX (chave privada + certificado):
   ```bash
   # Exemplo: salve como cert.pfx
   ```

### Assinar Executável

Após compilar o agente em Windows PowerShell como Administrador:

```powershell
# Variáveis
$CertPath = "C:\path\to\cert.pfx"
$CertPassword = "sua-senha-do-certificado"  # Use SecureString para automatizar
$ExePath = "agent\inventario-ti-agent-windows-amd64.exe"
$Timestamp = "http://timestamp.sectigo.com"  # Servidor de timestamp confiável

# Assinar
$SecPassword = ConvertTo-SecureString -String $CertPassword -AsPlainText -Force
Set-AuthenticodeSignature -FilePath $ExePath `
  -Certificate (Get-PfxCertificate -FilePath $CertPath) `
  -IncludeChain All `
  -TimestampServer $Timestamp `
  -Force

# Verificar assinatura
Get-AuthenticodeSignature -FilePath $ExePath
```

**Nota:** Use um servidor de timestamp confiável (Sectigo, Verisign, etc.) para garantir que a assinatura
permaneça válida após expiração do certificado.

### Scripts de Build e Assinatura

Utilitários PowerShell estão disponíveis em `scripts/`:

#### `scripts/build-agent.ps1`

Compila o agente e opcionalmente assina:

```powershell
# Compilar sem assinar
.\scripts\build-agent.ps1

# Compilar e assinar
.\scripts\build-agent.ps1 -SignCert "C:\path\to\cert.pfx" -SignPassword "sua-senha"

# Usar variáveis de ambiente
.\scripts\build-agent.ps1 -SignCert $env:CODESIGN_CERT_PATH -SignPassword $env:CODESIGN_CERT_PASSWORD
```

#### `scripts/sign-agent.ps1`

Assina um executável já compilado:

```powershell
.\scripts\sign-agent.ps1 -CertPath "C:\path\to\cert.pfx" -CertPassword "sua-senha"
```

### CI/CD (GitHub Actions, etc.)

Para automatizar build e assinatura em pipeline:

```yaml
# .github/workflows/build-agent.yml
- name: Build Agent
  run: |
    ${{ github.workspace }}\scripts\build-agent.ps1 `
      -SignCert ${{ secrets.CODESIGN_CERT_PATH }} `
      -SignPassword ${{ secrets.CODESIGN_CERT_PASSWORD }}
  shell: powershell
```

**Nota:** Armazene certificado e senha como secrets no repositório, nunca committe no Git.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

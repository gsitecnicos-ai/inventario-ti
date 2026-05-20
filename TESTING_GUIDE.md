# Guia de Testes e Desenvolvimento

## Executar Testes

### Rodar todos os testes uma vez

```bash
npm test
```

### Rodar testes em modo watch (re-executa quando arquivos mudam)

```bash
npm test:watch
```

### Gerar relatório de cobertura de testes

```bash
npm test:coverage
```

## Testar Script PowerShell com ngrok

Para testar o script PowerShell em outro computador durante o desenvolvimento, você pode usar ngrok para expor sua instância local via uma URL pública.

### 1. Iniciar o servidor Next.js

```bash
npm run dev
```

### 2. Em outro terminal, iniciar ngrok

```bash
npm run ngrok
```

Você verá algo como:

```text
ngrok                                                              (Ctrl+C to quit)

Session Status                online                                    
Account                       [seu-email]@gmail.com (Plan: Free)
Version                       3.x.x                                      
Region                        United States (us)                         
Forwarding                    https://abc-123-def-456.ngrok.io -> http://localhost:3000
```

### 3. Atualizar .env.local temporariamente

Copie a URL do ngrok (ex: `https://abc-123-def-456.ngrok.io`) e atualize:

```env
APP_BASE_URL=https://abc-123-def-456.ngrok.io
```

### 4. Reiniciar o servidor Next.js

```bash
npm run dev
```

### 5. Agora o script PowerShell pode ser testado em outro PC

Quando você gerar a chave do agente, o script PowerShell será baseado na URL do ngrok e será acessível globalmente.

### ⚠️ Importante

- As URLs do ngrok são temporárias e mudam cada vez que você reconecta
- Para produção, use `APP_BASE_URL` com seu domínio/IP real
- Adicione `APP_BASE_URL` ao `.env.local` (não comitar no git para dev)

## Estrutura de Testes

```text
src/lib/__tests__/
├── admin-repository.test.ts      # Testes do admin-repository
├── agent-request.test.ts         # Testes de parsing de requisições
└── utils/
    └── inventory-data.test.ts    # Testes de funções de formatação
```

## Adicionar Novos Testes

1. Crie um arquivo `.test.ts` próximo ao módulo que quer testar

2. Use Jest para escrever os testes:

   ```typescript
   describe('meu-modulo', () => {
     it('deve fazer algo', () => {
       expect(resultado).toBe(esperado);
     });
   });
   ```

3. Execute `npm test:watch` para desenvolvimento

4. Commit dos testes junto com o código

## Checklist Antes de Produção

- [ ] Todos os testes passam (`npm test`)
- [ ] Cobertura de testes é aceitável (`npm test:coverage`)
- [ ] Não há warnings do linter (`npm run lint`)
- [ ] Build produção funciona (`npm run build && npm run start`)
- [ ] Testou em outro computador via ngrok
- [ ] `APP_BASE_URL` está configurado com domínio/IP real
- [ ] Todas as migrations foram executadas no Supabase

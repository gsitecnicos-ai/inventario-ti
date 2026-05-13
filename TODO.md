# TODO - Correções (após análise)

- [x] Ajustar logs em `src/lib/inventory-repository.ts` (remover/condicionar `console.error` em cenários de fallback esperado).

- [ ] Remover `as never` e tipar payloads em `src/app/actions.ts` usando `src/lib/database.types.ts` (ou inferência) para `insert/update`.
- [ ] Melhorar lookup de usuário por e-mail em `src/app/actions.ts` (evitar `listUsers` grande e filtro em memória).
- [ ] Tratar erros específicos de RPC/função ausente em `src/lib/supabase-server.ts` e/ou `src/app/actions.ts`.
- [ ] Rodar `npm run lint` e `npm run build` para confirmar que compila.


---
name: 'Soft-Delete Universal'
description: 'Skill para implementar e validar soft-delete em toda a aplicação. Nunca deletar dados fisicamente. Usa atributo `deleted: true` com `updatedAt` timestamp. Todos os reads filtram registros deletados automaticamente.'
---

# Skill: Soft-Delete Universal

## Quando usar esta skill

- Ao criar uma **nova entidade** ou revisar uma existente.
- Ao implementar um endpoint `DELETE`.
- Ao verificar se queries filtram registros soft-deleted.
- Ao debugar dados que "sumiram" mas existem no DynamoDB.

## Princípio Central

> **NUNCA** delete dados fisicamente. Soft-delete é a única operação de remoção permitida.

## Como funciona

### Atributos automáticos em todo item

| Atributo    | Tipo      | Valor no Create | Valor no Update | Valor no Remove |
| ----------- | --------- | --------------- | --------------- | --------------- |
| `deleted`   | `boolean` | `false`         | inalterado      | `true`          |
| `createdAt` | `string`  | ISO timestamp   | inalterado      | inalterado      |
| `updatedAt` | `string`  | ISO timestamp   | ISO timestamp   | ISO timestamp   |

### Fluxo de Soft-Delete no BaseResourceService

```typescript
// O método remove() no BaseResourceService:
async remove(tenantId: string, id: string): Promise<T> {
  // 1. Busca o item existente (valida que existe e pertence ao tenant)
  const existing = await this.findOne(tenantId, id);

  // 2. Marca como deletado com timestamp
  const deleted = {
    ...existing,
    deleted: true,
    updatedAt: new Date().toISOString(),
  };

  // 3. Salva de volta (PutItem, não DeleteItem)
  await this.dynamo.putItem(this.tableName, marshall(deleted));
  return deleted as unknown as T;
}
```

### Filtragem automática nos reads

```typescript
// findOne() — rejeita items soft-deleted
async findOne(tenantId: string, id: string): Promise<T> {
  const result = await this.dynamo.getItem(this.tableName, key);
  const item = unmarshall(result.Item);

  if (item.deleted) {
    throw new NotFoundException(`${this.entityName} with ID ${id} not found`);
  }
  return item as T;
}

// findAll() — filtra items soft-deleted (returns PaginatedResult)
async findAll(tenantId: string, options?: PaginationOptions): Promise<PaginatedResult<T>> {
  const result = await this.dynamo.query(this.tableName, pk, queryOptions);
  const items = result.Items
    .map((item) => unmarshall(item))
    .filter((item) => !item.deleted); // ← Filtro de soft-delete
  const cursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : undefined;
  return { items, cursor };
}
```

## Regras de Validação (Checklist)

- [ ] O método `remove()` usa `PutItem` com `deleted: true` — **NUNCA** `DeleteItem`.
- [ ] O `findOne()` verifica `if (item.deleted)` e lança `NotFoundException`.
- [ ] O `findAll()` filtra `.filter((item) => !item.deleted)`.
- [ ] Todo item criado via `create()` recebe `deleted: false` automaticamente.
- [ ] O `updatedAt` é atualizado em toda operação de `update()` e `remove()`.
- [ ] Não existe nenhum import ou uso de `DeleteItemCommand` na codebase.

## Anti-Patterns (NUNCA fazer)

```typescript
// ❌ ERRADO: Deletar fisicamente
import { DeleteItemCommand } from '@aws-sdk/client-dynamodb';
await client.send(new DeleteItemCommand({ TableName: table, Key: key }));

// ❌ ERRADO: Não filtrar soft-deleted no findAll
return result.Items.map((item) => unmarshall(item)); // Retorna deletados!

// ❌ ERRADO: Não checar deleted no findOne
const item = unmarshall(result.Item);
return item as T; // Retorna item deletado!

// ✅ CORRETO: Soft-delete
const deleted = { ...existing, deleted: true, updatedAt: new Date().toISOString() };
await this.dynamo.putItem(this.tableName, marshall(deleted));

// ✅ CORRETO: Filtrar nos reads
return items.filter((item) => !item.deleted);
```

## Recuperação de dados (Admin)

Para recuperar um item soft-deleted (operação administrativa):

```typescript
async restore(tenantId: string, id: string): Promise<T> {
  // Busca direto no DynamoDB sem filtro de deleted
  const key = {
    PK: { S: this.getPk(tenantId) },
    SK: { S: this.getSk(id) },
  };
  const result = await this.dynamo.getItem(this.tableName, key);
  const item = unmarshall(result.Item);

  const restored = {
    ...item,
    deleted: false,
    updatedAt: new Date().toISOString(),
  };
  await this.dynamo.putItem(this.tableName, marshall(restored));
  return restored as T;
}
```

## Testes

```typescript
describe('Soft-Delete', () => {
  it('should mark item as deleted instead of removing', async () => {
    const created = await service.create({
      tenantId: 'tenant-A',
      name: 'Test',
    });
    const removed = await service.remove('tenant-A', created.id);

    expect(removed.deleted).toBe(true);
    expect(removed.updatedAt).toBeDefined();
  });

  it('should not return soft-deleted items in findAll', async () => {
    await service.create({ tenantId: 'tenant-A', name: 'Active' });
    const toDelete = await service.create({ tenantId: 'tenant-A', name: 'ToDelete' });
    await service.remove('tenant-A', toDelete.id);

    const results = await service.findAll('tenant-A');
    expect(results.items).toHaveLength(1);
    expect(results.items[0].name).toBe('Active');
  });

  it('should throw NotFoundException for soft-deleted item', async () => {
    const created = await service.create({ tenantId: 'tenant-A', name: 'Test' });
    await service.remove('tenant-A', created.id);

    await expect(service.findOne('tenant-A', created.id)).rejects.toThrow(NotFoundException);
  });
});
```

/**
 * Seed Script — populates LocalStack DynamoDB with sample data.
 * Usage: npx ts-node scripts/seed.ts
 */
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

const TABLE_NAME = 'dev-fintech-core-dynamodb-main';
const TENANT_ID = 'tenant-demo';

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
});

const sampleOrders = [
  { id: 'order-001', productName: 'Premium Plan', amount: 29900 },
  { id: 'order-002', productName: 'Enterprise Plan', amount: 99900 },
  { id: 'order-003', productName: 'Starter Plan', amount: 9900 },
  { id: 'order-004', productName: 'Add-on: Analytics', amount: 4900 },
  { id: 'order-005', productName: 'Add-on: Support', amount: 14900 },
];

async function seed() {
  console.log(`Seeding ${sampleOrders.length} orders for tenant "${TENANT_ID}"...`);

  for (const order of sampleOrders) {
    const item = {
      PK: `TENANT#${TENANT_ID}#ORDER`,
      SK: `ORDER#${order.id}`,
      id: order.id,
      tenantId: TENANT_ID,
      productName: order.productName,
      amount: order.amount,
      entityType: 'ORDER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deleted: false,
    };

    await client.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item),
    }));

    console.log(`  ✓ ${order.id} — ${order.productName}`);
  }

  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

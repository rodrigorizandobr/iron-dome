/**
 * Script: seed
 * Purpose: Populate DynamoDB with sample data for local development
 * Usage: npx ts-node scripts/seed.ts
 * Required ENV: (none for local dev, uses defaults)
 * Optional ENV: DYNAMODB_TABLE_NAME, DEMO_TENANT_ID, AWS_REGION, AWS_ENDPOINT,
 *               AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 * Exit codes: 0 = success, 1 = error
 * Example: npx ts-node scripts/seed.ts
 */
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

/* eslint-disable i18next/no-literal-string */
const DUMMY_CREDENTIAL = 'dummy';
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'dev-fintech-core-dynamodb-main';
const TENANT_ID = process.env.DEMO_TENANT_ID || 'tenant-demo';
const REGION = process.env.AWS_REGION || 'us-east-1';
const ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || DUMMY_CREDENTIAL;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || DUMMY_CREDENTIAL;
/* eslint-enable i18next/no-literal-string */

interface IOrderData {
  id: string;
  productName: string;
  amount: number;
}

const client = new DynamoDBClient({
  region: REGION,
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const sampleOrders: IOrderData[] = [
  { id: 'order-001', productName: 'Premium Plan', amount: 29900 },
  { id: 'order-002', productName: 'Enterprise Plan', amount: 99900 },
  { id: 'order-003', productName: 'Starter Plan', amount: 9900 },
  { id: 'order-004', productName: 'Add-on: Analytics', amount: 4900 },
  { id: 'order-005', productName: 'Add-on: Support', amount: 14900 },
];

async function seedOrders(orders: IOrderData[]): Promise<void> {
  /* eslint-disable-next-line i18next/no-literal-string */
  console.log(`✓ Seeding ${orders.length} orders for tenant "${TENANT_ID}"...`);

  for (const order of orders) {
    try {
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

      await client.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: marshall(item),
        }),
      );

      /* eslint-disable-next-line i18next/no-literal-string */
      console.log(`  ✓ ${order.id} — ${order.productName}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      /* eslint-disable-next-line i18next/no-literal-string */
      console.error(`  ✗ Failed to seed ${order.id}: ${err.message}`);
      throw error;
    }
  }

  /* eslint-disable-next-line i18next/no-literal-string */
  console.log('✓ Seed complete.');
}

async function main(): Promise<void> {
  try {
    await seedOrders(sampleOrders);
    process.exit(0);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    /* eslint-disable-next-line i18next/no-literal-string */
    console.error(`✗ Seed failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();

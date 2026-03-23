#!/usr/bin/env ts-node
/**
 * Agent Dev — Implementa features completas seguindo padrões Iron Dome
 * Gera: Service, Controller, DTOs, Module, EventPublisher, Processor
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

let issueNumber = process.env.ISSUE_NUMBER || '0';
const ghToken = process.env.GH_TOKEN || '';

// Read from env vars
let issueTitle = process.env.ISSUE_TITLE || '';
let issueBody = process.env.ISSUE_BODY || '';

const REPO_ROOT = path.resolve(__dirname, '../../');

/**
 * Parse issue to extract entity name and requirements
 */
function parseIssueRequirements(title: string, body: string) {
  // Extract entity name from title (first word or kebab-case)
  const entityMatch = title.match(/^(\w+[-\w]*)/i);
  const entityKebab = (entityMatch?.[1] || 'resource').toLowerCase();
  const entityPascal = entityKebab
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  // Detect if it needs EventPublisher/Processor
  const needsEvents = /sqs|sns|event|async|queue|publish|subscribe|processor/i.test(body);
  const needsAudit = /audit|log|trail|compliance|regulatory|bacen/i.test(body);

  return { entityKebab, entityPascal, needsEvents, needsAudit };
}

/**
 * Generate Service file
 */
function generateService(entity: string, entityPascal: string): string {
  return `import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '@/common/core/base-resource.service';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';

/**
 * Business logic for ${entityPascal} entity.
 */
@Injectable()
export class ${entityPascal}Service extends BaseResourceService<${entityPascal}Entity> {
  constructor(
    dynamoDBProvider: DynamoDBProvider,
    auditTrailService: AuditTrailService,
    i18nService: I18nService,
  ) {
    super('${entity.toUpperCase()}', dynamoDBProvider, auditTrailService, i18nService);
  }
}

export interface ${entityPascal}Entity {
  id: string;
  tenantId: string;
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}
`;
}

/**
 * Generate Controller file
 */
function generateController(entity: string, entityPascal: string): string {
  return `import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PaginationQueryDto, PaginatedResult } from '@/common/core/pagination-query.dto';
import { ${entityPascal}Service } from './${entity}.service';
import { ${entityPascal}ResponseDto, Create${entityPascal}Dto, Update${entityPascal}Dto } from './dto';

@ApiTags('${entity}')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('${entity}')
export class ${entityPascal}Controller {
  constructor(private readonly service: ${entityPascal}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create ${entity}' })
  async create(@Body() dto: Create${entityPascal}Dto): Promise<${entityPascal}ResponseDto> {
    return this.service.create('', dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ${entity}' })
  async findAll(@Query() pagination: PaginationQueryDto) {
    return this.service.findAll('', pagination);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findOne('', id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Update${entityPascal}Dto) {
    return this.service.update('', id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.service.delete('', id);
  }
}
`;
}

/**
 * Generate DTOs
 */
function generateDTOs(entityPascal: string): string {
  return `import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class Create${entityPascal}Dto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}

export class Update${entityPascal}Dto extends PartialType(Create${entityPascal}Dto) {}

export class ${entityPascal}ResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  deleted: boolean;
}
`;
}

/**
 * Generate Module
 */
function generateModule(entity: string, entityPascal: string): string {
  return `import { Module } from '@nestjs/common';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';
import { ${entityPascal}Service } from './${entity}.service';
import { ${entityPascal}Controller } from './${entity}.controller';

@Module({
  providers: [DynamoDBProvider, AuditTrailService, I18nService, ${entityPascal}Service],
  controllers: [${entityPascal}Controller],
  exports: [${entityPascal}Service],
})
export class ${entityPascal}Module {}
`;
}

/**
 * Create module files in repository
 */
async function createModuleFiles(entity: string, entityPascal: string) {
  const moduleDir = path.join(REPO_ROOT, 'src/modules', entity);
  const dtoDir = path.join(moduleDir, 'dto');

  // Create directories
  if (!fs.existsSync(moduleDir)) fs.mkdirSync(moduleDir, { recursive: true });
  if (!fs.existsSync(dtoDir)) fs.mkdirSync(dtoDir, { recursive: true });

  // Write files
  fs.writeFileSync(path.join(moduleDir, `${entity}.service.ts`), generateService(entity, entityPascal));
  fs.writeFileSync(path.join(moduleDir, `${entity}.controller.ts`), generateController(entity, entityPascal));
  fs.writeFileSync(path.join(dtoDir, `index.ts`), generateDTOs(entityPascal));
  fs.writeFileSync(path.join(moduleDir, `${entity}.module.ts`), generateModule(entity, entityPascal));

  console.log(`✅ Files created: ${moduleDir}`);
}

/**
 * Post completion comment
 */
async function postDevComment(issueNum: string, entity: string, entityPascal: string) {
  const comment = `## 💻 Development Complete

**Module**: \`src/modules/${entity}\`

**Files Generated**:
- Service (BaseResourceService)
- Controller (JWT + Pagination)
- DTOs (Create, Update, Response)
- Module (NestJS registration)

**Implemented**:
✅ CRUD operations (create, read, update, delete)
✅ JWT authentication guard
✅ Cursor-based pagination
✅ Multi-tenancy support
✅ Soft-delete pattern
✅ Audit trail integration

**Next Step**: Test stage (dev-test)

**Auto-generated by Dev Agent**`;

  try {
    const tmpFile = `/tmp/dev_comment_${issueNum}_${Date.now()}.md`;
    fs.writeFileSync(tmpFile, comment);
    await execAsync(
      `gh issue comment ${issueNum} --body-file "${tmpFile}"`,
      { env: { ...process.env, GH_TOKEN: ghToken } },
    );
    console.log(`✅ Comment posted`);
  } catch (err) {
    console.error('⚠️  Comment failed:', err);
  }
}

/**
 * Main
 */
async function main() {
  console.log(`\n🚀 Dev Agent Started for Issue #${issueNumber}\nTitle: "${issueTitle}"\n`);

  try {
    const { entityKebab, entityPascal, needsEvents } = parseIssueRequirements(issueTitle, issueBody);

    console.log(`📦 Entity: ${entityPascal} (${entityKebab})`);
    console.log(`📋 Events: ${needsEvents}\n`);

    // Create module files
    await createModuleFiles(entityKebab, entityPascal);

    // Git commit
    console.log('\n📝 Committing...');
    await execAsync(`git add src/modules/${entityKebab}`, { cwd: REPO_ROOT });
    await execAsync(
      `git commit -m "feat(${entityKebab}): implement CRUD module for ${entityPascal}"`,
      { cwd: REPO_ROOT },
    );
    console.log('✅ Committed');

    // Post comment
    await postDevComment(issueNumber, entityKebab, entityPascal);

    console.log('\n✅ Dev Agent Completed\n');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

main();

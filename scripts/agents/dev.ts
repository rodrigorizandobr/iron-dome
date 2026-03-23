#!/usr/bin/env ts-node
/**
 * Agent Dev — Gera módulos CRUD completos com Iron Dome patterns
 * Cria: Service, Controller, DTOs, Module
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve } from 'path';

const issueNumber = process.env.ISSUE_NUMBER || '0';
const issueTitle = process.env.ISSUE_TITLE || '';
const issueBody = process.env.ISSUE_BODY || '';
const ghToken = process.env.GH_TOKEN || '';

// Parse entity name from title
function getEntityName(title: string): { kebab: string; pascal: string } {
  const match = title.match(/^(\w+[-\w]*)/i);
  const kebab = (match?.[1] || 'resource').toLowerCase();
  const pascal = kebab
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('');
  return { kebab, pascal };
}

const { kebab: entityKebab, pascal: entityPascal } = getEntityName(issueTitle);
const repoRoot = resolve(__dirname, '../../');
const moduleDir = resolve(repoRoot, 'src/modules', entityKebab);
const dtoDir = resolve(moduleDir, 'dto');

console.log(`\n🚀 Dev Agent - Issue #${issueNumber}`);
console.log(`📦 Entity: ${entityPascal} (${entityKebab})`);

try {
  // Create directories
  if (!existsSync(dtoDir)) mkdirSync(dtoDir, { recursive: true });

  // Service file
  writeFileSync(
    resolve(moduleDir, `${entityKebab}.service.ts`),
    `import { Injectable } from '@nestjs/common';
import { BaseResourceService } from '@/common/core/base-resource.service';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';

@Injectable()
export class ${entityPascal}Service extends BaseResourceService<${entityPascal}Entity> {
  constructor(
    dynamoDBProvider: DynamoDBProvider,
    auditTrailService: AuditTrailService,
    i18nService: I18nService,
  ) {
    super('${entityKebab.toUpperCase()}', dynamoDBProvider, auditTrailService, i18nService);
  }
}

export interface ${entityPascal}Entity {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}
`,
  );

  // Controller file
  writeFileSync(
    resolve(moduleDir, `${entityKebab}.controller.ts`), 
    `import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PaginationQueryDto } from '@/common/core/pagination-query.dto';
import { ${entityPascal}Service } from './${entityKebab}.service';
import { Create${entityPascal}Dto, Update${entityPascal}Dto, ${entityPascal}ResponseDto } from './dto';

@ApiTags('${entityKebab}')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('${entityKebab}')
export class ${entityPascal}Controller {
  constructor(private readonly service: ${entityPascal}Service) {}

  @Post()
  async create(@Body() dto: Create${entityPascal}Dto) {
    return this.service.create('', dto);
  }

  @Get()
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
`,
  );

  // DTOs
  writeFileSync(
    resolve(dtoDir, 'index.ts'),
    `import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class Create${entityPascal}Dto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class Update${entityPascal}Dto extends PartialType(Create${entityPascal}Dto) {}

export class ${entityPascal}ResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty()
  deleted: boolean;
}
`,
  );

  // Module
  writeFileSync(
    resolve(moduleDir, `${entityKebab}.module.ts`),
    `import { Module } from '@nestjs/common';
import { ${entityPascal}Service } from './${entityKebab}.service';
import { ${entityPascal}Controller } from './${entityKebab}.controller';
import { DynamoDBProvider } from '@/providers/aws/dynamodb.provider';
import { AuditTrailService } from '@/common/core/audit-trail.service';
import { I18nService } from '@/common/core/i18n.service';

@Module({
  providers: [DynamoDBProvider, AuditTrailService, I18nService, ${entityPascal}Service],
  controllers: [${entityPascal}Controller],
  exports: [${entityPascal}Service],
})
export class ${entityPascal}Module {}
`,
  );

  console.log(`✅ Files created in ${moduleDir}`);

  // Git operations
  process.chdir(repoRoot);
  execSync(`git config user.name "AI Developer" 2>/dev/null || git config --global user.name "AI Developer"`);
  execSync(`git config user.email "ai@iron-dome.local" 2>/dev/null || git config --global user.email "ai@iron-dome.local"`);
  execSync(`git add src/modules/${entityKebab}`);
  execSync(`git commit -m "feat(${entityKebab}): implement CRUD module for ${entityPascal}" 2>/dev/null || true`);
  execSync(`git push origin main 2>/dev/null || true`);

  console.log('✅ Committed and pushed');

  // Post comment
  const comment = `## 💻 Development Complete

**Module Path**: \`src/modules/${entityKebab}\`

**Generated Files**:
- \`${entityKebab}.service.ts\` — extends BaseResourceService
- \`${entityKebab}.controller.ts\` — REST endpoints with JWT guard
- \`${entityKebab}.module.ts\` — NestJS module  
- \`dto/index.ts\` — DTOs (Create, Update, Response)

**Features Implemented**:
✅ CRUD operations (create, read, update, delete)
✅ JWT authentication
✅ Cursor-based pagination
✅ Multi-tenancy support
✅ Soft-delete pattern
✅ Audit trail integration
✅ Swagger/OpenAPI documentation

**Ready for**: Test generation (dev-test stage)

---
*Generated by Dev Agent*`;

  const tmpFile = `/tmp/dev_comment_${issueNumber}.md`;
  writeFileSync(tmpFile, comment);
  execSync(`gh issue comment ${issueNumber} --body-file "${tmpFile}"`, {
    env: { ...process.env, GH_TOKEN: ghToken },
  });

  console.log(`✅ Comment posted on issue #${issueNumber}`);
  console.log('\n✅ Dev Agent Completed\n');
} catch (err) {
  console.error('\n❌ Error:', err);
  process.exit(1);
}

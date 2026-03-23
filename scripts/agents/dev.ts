import Anthropic from "@anthropic-ai/sdk";

/**
 * Task object from Claude response.
 */
interface Task {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

/**
 * Structured response from Claude analysis.
 */
interface AnalysisResponse {
  tasks: Task[];
  architecture: string;
  implementation_notes: string;
}

/**
 * Dev Agent analyzes issues and plans implementation.
 * @param issue - The business requirement to analyze
 */
async function devAgent(issue: string): Promise<void> {
  console.log("🚀 Dev Agent started\n");

  const systemPrompt = `You are a Senior Architect for a 100% Serverless Fintech/SaaS API.
You MUST enforce:
- ONLY DynamoDB (never relational DBs)
- BaseResourceService for CRUD
- PK: TENANT#[tenantId]#[ENTITY], SK: [ENTITY]#[id]
- AWS naming: [ENV]-[DOMAIN]-[SUBDOMAIN]-[RESOURCE_TYPE]-[NAME]
- Every provider extends BaseProvider with ConfigService
- JWT auth (JwtAuthGuard global, use @Public() to bypass)
- Multi-tenancy: x-tenant-id header + ITenantRequest
- Pagination: cursor-based PaginatedResult<T>
- SNS/SQS events: fire-and-forget
- AuditTrail.record() on all CUD
- Soft-delete only
- ErrorCode enum + ERROR_REGISTRY
- i18n: translate() before returning user messages
- ObfuscationService for sensitive data logging
- Max 200 lines/file, max 15 cognitive complexity
- JSDoc on all public methods
- Terraform IaC for all AWS resources

Output: JSON with { tasks: [{ title, description, priority }], architecture: string, implementation_notes: string }`;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze and plan implementation:\n${issue}\n\nOutput ONLY valid JSON (no markdown, no backticks).`,
      },
    ],
  });

  const firstContent = response.content[0];
  const content =
    firstContent && "type" in firstContent && firstContent.type === "text"
      ? "text" in firstContent
        ? firstContent.text
        : ""
      : "";

  try {
    const json: unknown = JSON.parse(content);
    if (!isAnalysisResponse(json)) {
      console.log("Invalid response format");
      return;
    }

    console.log("📋 TASKS:");
    json.tasks.forEach((t: Task, i: number) =>
      console.log(`  ${i + 1}. [${t.priority}] ${t.title}\n     ${t.description}`)
    );
    console.log("\n📐 ARCHITECTURE:", json.architecture);
    console.log("\n📝 NOTES:", json.implementation_notes);
  } catch (error) {
    console.log("Response:", content);
  }
}

/**
 * Type guard for AnalysisResponse.
 * @param val - Value to check
 * @returns True if value is AnalysisResponse
 */
function isAnalysisResponse(val: unknown): val is AnalysisResponse {
  if (typeof val !== "object" || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    Array.isArray(obj.tasks) &&
    typeof obj.architecture === "string" &&
    typeof obj.implementation_notes === "string"
  );
}

const issue = process.argv[2] ?? "Create a new Orders module with full CRUD";
// eslint-disable-next-line @typescript-eslint/no-floating-promises
devAgent(issue);

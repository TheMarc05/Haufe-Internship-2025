import { AnalysisResult, AnalysisSummary, Issue } from "../types/review";
import axios from "axios";

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export class AIService {
  private ollamaBaseUrl: string;
  private model: string;

  constructor(
    ollamaBaseUrl: string = process.env.OLLAMA_URL || "http://localhost:11434",
    model: string = process.env.OLLAMA_MODEL || "codellama:7b-instruct"
  ) {
    this.ollamaBaseUrl = ollamaBaseUrl;
    this.model = model;
  }

  private buildPrompt(
    code: string,
    language: string,
    filename: string
  ): string {
    return `You are an expert code reviewer. Analyze the following ${language} code and identify issues.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "critical|high|medium|low|info",
      "category": "security|bug|performance|style|best-practice",
      "title": "Brief title",
      "description": "Detailed explanation",
      "suggestion": "How to fix it",
      "fixedCode": "Corrected code snippet (optional)",
      "reasoning": "Why this is an issue"
    }
  ]
}

FILE: ${filename}
LANGUAGE: ${language}

CODE:
\`\`\`${language}
${code}
\`\`\`

Focus on:
1. Security vulnerabilities (SQL injection, XSS, auth issues)
2. Logic bugs and potential runtime errors
3. Performance bottlenecks
4. Code style and best practices
5. Missing error handling

Provide actionable, specific feedback. Include line numbers. Be concise but thorough.`;
  }

  async analyzeCode(
    code: string,
    language: string,
    filename: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(`Starting AI analysis for ${filename}...`);

      const prompt = this.buildPrompt(code, language, filename);

      const promptTokens = Math.ceil(prompt.length / 4);
      console.log(`Sending request (~${promptTokens} tokens)...`);

      const response = await axios.post<OllamaResponse>(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 4000,
          },
        },
        {
          timeout: 600000,
        }
      );

      const rawResponse = response.data.response;
      const responseTokens = Math.ceil(rawResponse.length / 4);
      const totalTokens = promptTokens + responseTokens;

      console.log(
        `AI response received (${rawResponse.length} chars, ~${totalTokens} tokens)`
      );

      const parsedData = this.parseAIResponse(rawResponse);
      const summary = this.calculateSummary(parsedData.issues);
      const processingTime = Date.now() - startTime;

      return {
        issues: parsedData.issues,
        summary,
        metadata: {
          model: this.model,
          processingTime,
          language,
          tokensUsed: totalTokens,
          promptTokens,
          responseTokens,
        },
      };
    } catch (error: any) {
      console.error("AI analysis failed:", error.message);
      throw new Error(`AI analysis failed: ${error.message}`);
    }
  }

  async generateCommentReply(
    userComment: string,
    issue: any,
    codeContext: string,
    language: string
  ): Promise<string> {
    try {
      console.log(`🤖 Generating AI reply to comment...`);

      const prompt = `You are an AI code review assistant helping a developer.

CONTEXT:
- Language: ${language}
- Issue: ${issue.title} (${issue.severity})
- Problem at line ${issue.line}: ${issue.description}

CODE CONTEXT:
\`\`\`${language}
${codeContext}
\`\`\`

USER COMMENT:
"${userComment}"

TASK:
Respond to the user's comment in a helpful, concise way (2-3 sentences max).
- If they ask for clarification, explain the issue better
- If they ask for alternative solutions, provide them
- If they disagree, respectfully explain your reasoning
- Be friendly and supportive

IMPORTANT: Respond ONLY with plain text (no JSON, no markdown formatting).`;

      const response = await axios.post<OllamaResponse>(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7, //more creative for conversation
            top_p: 0.9,
            num_predict: 200, //short responses
          },
        },
        {
          timeout: 60000, //1 min for replies
        }
      );

      const reply = response.data.response.trim();
      console.log(`✅ AI reply generated (${reply.length} chars)`);
      return reply;
    } catch (error: any) {
      console.error("❌ AI reply generation failed:", error.message);
      // Fallback generic response
      return "I'm here to help! Could you provide more details about your question?";
    }
  }

  private parseAIResponse(response: string): { issues: Issue[] } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("⚠️  No valid JSON found in AI response");
        throw new Error("No valid JSON found");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        throw new Error("Invalid response format");
      }

      return parsed;
    } catch (error) {
      console.error("⚠️  Failed to parse AI response, returning fallback");

      //fallback response in case of error
      return {
        issues: [
          {
            line: 1,
            severity: "info",
            category: "best-practice",
            title: "Analysis Parse Error",
            description: "The AI model returned an invalid response format.",
            suggestion: "Try analyzing again or check Ollama configuration.",
            reasoning: "JSON parsing failed",
          },
        ],
      };
    }
  }

  private calculateSummary(issues: Issue[]): AnalysisSummary {
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    issues.forEach((issue) => {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    });

    const criticalCount = bySeverity["critical"] || 0;
    const highCount = bySeverity["high"] || 0;
    const mediumCount = bySeverity["medium"] || 0;
    const lowCount = bySeverity["low"] || 0;

    const estimatedMinutes =
      criticalCount * 30 + highCount * 15 + mediumCount * 10 + lowCount * 5;

    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;

    return {
      totalIssues: issues.length,
      bySeverity,
      byCategory,
      estimatedFixTime: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      console.error("Ollama health check failed:", error);
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
      return response.data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error("Failed to list models:", error);
      return [];
    }
  }
}

export const aiService = new AIService();

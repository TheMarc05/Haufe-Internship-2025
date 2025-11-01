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
    filename: string,
    customRules?: string,
    guidelineRules?: string
  ): string {
    const languageSpecificChecks = this.getLanguageSpecificChecks(language);
    
    let prompt = `You are an expert ${language} code reviewer. Analyze ONLY this ${language} code file and identify REAL issues.

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanations before or after the JSON. Start directly with { and end with }.

Required JSON format (respond EXACTLY like this):
{
  "issues": [
    {
      "line": 10,
      "severity": "medium",
      "category": "bug",
      "title": "Potential null pointer exception",
      "description": "Variable may be null when accessed without null check",
      "suggestion": "Add null check before accessing the variable",
      "fixedCode": "if (variable != null) { variable.doSomething(); }",
      "reasoning": "Null pointer exceptions can cause runtime crashes"
    }
  ]
}

IMPORTANT RULES:
- Respond ONLY with the JSON object, nothing else
- Do NOT wrap JSON in markdown code blocks (\`\`\`json\`\`\`)
- Do NOT add text before or after the JSON
- Escape quotes properly in strings
- All string values must be in double quotes
- Line numbers must be integers
- Severity must be: "critical", "high", "medium", "low", or "info"
- Category must be: "security", "bug", "performance", "style", or "best-practice"

FILE: ${filename}
DETECTED LANGUAGE: ${language}
FILE EXTENSION: ${filename.substring(filename.lastIndexOf('.'))}

LANGUAGE-SPECIFIC CHECKS (ONLY check these for ${language} code):
${languageSpecificChecks}
`;

    if (guidelineRules) {
      prompt += `\n${guidelineRules}\n`;
    }

    if (customRules) {
      prompt += `\nCUSTOM PROJECT RULES:\n${customRules}\n`;
    }

    prompt += `
CODE TO ANALYZE (${language}):
\`\`\`${language}
${code}
\`\`\`

ANALYSIS INSTRUCTIONS - FOLLOW EXACTLY:
1. FIRST STEP: Read the ENTIRE code carefully and identify what it does
2. SECOND STEP: Check ONLY the language-specific issues listed above for ${language}
3. THIRD STEP: For each potential issue found, verify it ACTUALLY exists by checking:
   - Can you see the problematic pattern in the code?
   - Does the line number point to actual problematic code?
   - Is this issue relevant to ${language}?
4. FINAL STEP: Only report issues that pass ALL three checks above

CRITICAL CONTEXT CHECKING:
- If analyzing Java code: Look for BufferedReader, FileReader, Scanner - check if they're closed properly
- If analyzing Java code: Look for try-catch-finally or try-with-resources for file operations
- If code has NO SQL/database operations → DO NOT flag SQL injection
- If code has NO HTML/web content → DO NOT flag XSS
- If code has NO authentication logic → DO NOT flag auth issues

PRIORITY ORDER (check issues in this exact order):
1. Resource leaks (files, streams, connections not closed) - MOST CRITICAL for ${language}
2. Null pointer exceptions (variables used without null checks)
3. Logic bugs and potential runtime errors
4. Exception handling issues (missing try-catch, incorrect exception handling)
5. Code style violations (naming, formatting for ${language})
6. Best practices violations (error handling, resource management patterns)
7. Performance issues (inefficient algorithms)
8. Security issues (ONLY if code actually handles sensitive data/SQL/authentication)

CRITICAL RULES:
- If there's NO SQL code → DO NOT flag SQL injection
- If there's NO user input handling → DO NOT flag injection vulnerabilities
- If there's NO authentication code → DO NOT flag auth vulnerabilities
- Only flag issues that you can SEE in the actual code provided above
- Be SPECIFIC: reference exact line numbers and actual code patterns

VALIDATION BEFORE REPORTING EACH ISSUE:
For EVERY issue you want to report, answer these questions:

1. "Can I see the EXACT problematic code pattern in the ${language} code above?"
   - Look at the specific line number
   - Verify the code actually has that pattern
   - Example for Java: If reporting BufferedReader resource leak, verify BufferedReader is opened but NOT in try-with-resources or finally block
   - If NO → DO NOT flag it

2. "Is this issue specific to ${language} and actually problematic?"
   - For Java: Resource leaks (BufferedReader not in try-with-resources) = REAL
   - For Java: Scanner not closed = REAL
   - For Java: Null pointer after null check = REAL only if variable CAN be null
   - For Java: SQL injection = REAL only if code contains SQL/Statement/PreparedStatement
   - If NO → DO NOT flag it

3. "Is the line number I'm reporting actually pointing to problematic code?"
   - Check the exact line in the code
   - Verify the issue exists at that line
   - Example: If reporting "BufferedReader not closed", the line should show where BufferedReader is created
   - If NO → DO NOT flag it or fix the line number

4. "Am I inventing issues that don't exist?"
   - If the code is clean for ${language} standards → Report fewer issues or empty array
   - Better to report fewer accurate issues than many false positives

ONLY report issues that pass ALL 4 checks above with YES.

NOW RESPOND WITH ONLY THE JSON OBJECT (no other text):`;
    return prompt;
  }

  private getLanguageSpecificChecks(language: string): string {
    const checks: Record<string, string> = {
      java: `For JAVA code, check these REAL issues:
1. Resource leaks (CRITICAL):
   - BufferedReader/BufferedWriter not closed in finally block
   - FileReader/FileWriter not properly handled
   - Scanner not closed
   - Connection/Statement not closed
2. Null pointer exceptions:
   - Variables accessed after potential null assignment
   - Method calls on potentially null objects
   - Array access without null checks
3. Exception handling:
   - IOException not caught or re-thrown properly
   - Missing try-catch-finally blocks for resources
4. Code quality:
   - Uninitialized variables before use
   - Missing @Override annotations where needed
   - Incorrect access modifiers
   - Array index out of bounds
   - Type mismatches

VERY IMPORTANT: For this Java code, focus on:
- BufferedReader/FileReader resource leaks (must use try-with-resources or finally)
- Scanner not closed (resource leak)
- BufferedWriter not closed in finally
- Variables used after null assignment

ONLY check SQL injection if code contains: Statement, PreparedStatement, Connection, JDBC, database queries, SQL strings`,
      
      javascript: `For JAVASCRIPT/TypeScript code, check:
- Undefined/null access errors
- Missing await for async functions
- Memory leaks (event listeners not removed)
- Incorrect use of this/this binding
- Missing error handling (try-catch)
- Type errors (if TypeScript)
- Incorrect React hooks usage (if React code)
- Missing dependencies in useEffect
ONLY check XSS if code handles user-generated HTML/DOM manipulation`,
      
      typescript: `For TYPESCRIPT code, check:
- Type errors and type mismatches
- Undefined/null access without checks
- Missing await for async functions
- React hooks violations (if React)
- Missing dependencies in useEffect/useMemo
- Incorrect type annotations
- Memory leaks (event listeners, subscriptions)
ONLY check XSS if code handles user-generated HTML/DOM`,
      
      python: `For PYTHON code, check:
- Indentation errors
- NameError (undefined variables)
- Missing exception handling (try-except)
- Resource leaks (files not closed)
- Incorrect use of global variables
- Missing type hints (if Python 3.6+)
- List index out of range
- Incorrect import statements
ONLY check SQL injection if code contains: cursor.execute(), sqlite3, mysql, psycopg2`,
      
      csharp: `For C# code, check:
- Null reference exceptions
- Missing using statements for IDisposable
- Resource leaks (not using using/Dispose)
- Incorrect access modifiers
- Missing async/await
- Uninitialized variables
- Type conversion errors
ONLY check SQL injection if code contains: SqlCommand, SqlConnection, Entity Framework raw SQL`,
    };

    return checks[language.toLowerCase()] || `For ${language.toUpperCase()} code:
- Check for syntax errors
- Check for logic bugs
- Check for missing error handling
- Check for resource leaks
- Check for null/undefined access
ONLY check security vulnerabilities if code actually handles sensitive operations`;
  }

  async analyzeCode(
    code: string,
    language: string,
    filename: string,
    customRules?: string,
    guidelineRules?: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(`Starting AI analysis for ${filename}...`);

      const prompt = this.buildPrompt(code, language, filename, customRules, guidelineRules);

      const promptTokens = Math.ceil(prompt.length / 4);
      console.log(`Sending request (~${promptTokens} tokens)...`);

      const response = await axios.post<OllamaResponse>(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_p: 0.85,
            num_predict: 4000,
            repeat_penalty: 1.1,
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

  async analyzeCodeIncremental(
    code: string,
    language: string,
    filename: string,
    changedLines: number[],
    diffSnippet: string,
    customRules?: string,
    guidelineRules?: string
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log(
        `🔄 Starting INCREMENTAL AI analysis for ${filename}... (${changedLines.length} changes)`
      );

      const prompt = this.buildIncrementalPrompt(
        code,
        language,
        filename,
        changedLines,
        diffSnippet,
        customRules,
        guidelineRules
      );

      const promptTokens = Math.ceil(prompt.length / 4);
      console.log(`Sending incremental request (~${promptTokens} tokens)...`);

      const response = await axios.post<OllamaResponse>(
        `${this.ollamaBaseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            num_predict: 2000,
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
        `✅ Incremental AI response received (${rawResponse.length} chars, ~${totalTokens} tokens)`
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
      console.error("Incremental AI analysis failed:", error.message);
      throw new Error(`Incremental AI analysis failed: ${error.message}`);
    }
  }

  private buildIncrementalPrompt(
    code: string,
    language: string,
    filename: string,
    changedLines: number[],
    diffSnippet: string,
    customRules?: string,
    guidelineRules?: string
  ): string {
    const languageSpecificChecks = this.getLanguageSpecificChecks(language);
    
    let prompt = `You are an expert ${language} code reviewer. Perform INCREMENTAL REVIEW of recently changed ${language} code.

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
DETECTED LANGUAGE: ${language}
CHANGED LINES: ${changedLines.join(", ")}

LANGUAGE-SPECIFIC CHECKS (ONLY for ${language}):
${languageSpecificChecks}

FOCUS: Review ONLY these changed/added lines and immediate context:

${diffSnippet}

`;

    if (guidelineRules) {
      prompt += `${guidelineRules}\n`;
    }

    if (customRules) {
      prompt += `CUSTOM PROJECT RULES:\n${customRules}\n\n`;
    }

    prompt += `
INCREMENTAL REVIEW CRITERIA (check ONLY changed lines):
1. NEW Logic bugs in changed code (MOST IMPORTANT - check for ${language}-specific bugs)
2. NEW ${language} syntax or type errors introduced
3. Security issues (ONLY if changed code actually contains vulnerable patterns for ${language})
4. Style violations (naming, formatting for ${language})
5. Missing error handling in new code (${language}-specific error handling)
6. Breaking changes or regressions
7. Compliance with ${language} coding standards

CRITICAL VALIDATION:
Before flagging each issue, verify:
- Is this issue visible in the CHANGED lines shown above?
- Is this issue relevant to ${language} code?
- Does the code actually contain the technology/framework this issue refers to?
- If NO to any → DO NOT flag it

Examples of what NOT to flag:
- SQL injection if changed code has NO database/SQL operations
- XSS if changed code has NO HTML/DOM manipulation
- Auth issues if changed code has NO authentication logic
- Issues for languages/frameworks not used in this file

NOW RESPOND WITH ONLY THE JSON OBJECT (no other text):`;
    return prompt;
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
      console.log(`🔍 Parsing AI response (${response.length} chars)...`);
      
      let cleanedResponse = response.trim();
      const jsonStartIndex = cleanedResponse.indexOf('{');
      const jsonEndIndex = cleanedResponse.lastIndexOf('}');

      if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
        console.warn("⚠️  No valid JSON found in AI response");
        throw new Error("No valid JSON found");
      }

      let jsonString = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);

      jsonString = jsonString
        .replace(/```[\s\S]*?```/g, '""')
        .replace(/`([^`]+)`/g, '"$1"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '');

      let parsed;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        try {
          parsed = JSON.parse(jsonString);
          break;
        } catch (parseError: any) {
          attempts++;
          const errorMsg = parseError.message || '';
          
          if (errorMsg.includes("Expected ',' or ']'")) {
            const posMatch = errorMsg.match(/position (\d+)/);
            if (posMatch) {
              const pos = parseInt(posMatch[1]);
              if (pos > 0 && pos < jsonString.length - 1) {
                const beforePos = jsonString.substring(0, pos);
                const afterPos = jsonString.substring(pos);
                
                if (!beforePos.trim().endsWith(',')) {
                  jsonString = beforePos.trim() + ',' + afterPos.trim();
                  console.log(`🔧 Added missing comma at position ${pos}`);
                  continue;
                }
              }
            }
          }

          if (errorMsg.includes("Unexpected token")) {
            const posMatch = errorMsg.match(/position (\d+)/);
            if (posMatch) {
              const pos = parseInt(posMatch[1]);
              const problemChar = jsonString[pos];
              
              if (problemChar === '\n' || problemChar === '\r' || problemChar === '\t') {
                jsonString = jsonString.substring(0, pos) + ' ' + jsonString.substring(pos + 1);
                console.log(`🔧 Replaced problematic character at position ${pos}`);
                continue;
              }
            }
          }

          if (attempts === 3) {
            const issuesMatch = jsonString.match(/"issues"\s*:\s*\[([\s\S]*?)\]/);
            if (issuesMatch) {
              const issuesContent = issuesMatch[1];
              const issueMatches = issuesContent.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
              
              if (issueMatches.length > 0) {
                const fixedIssues = issueMatches.map((issue: string) => {
                  try {
                    return JSON.parse(issue);
                  } catch {
                    return null;
                  }
                }).filter(Boolean);

                if (fixedIssues.length > 0) {
                  console.log(`🔧 Extracted ${fixedIssues.length} issues from malformed JSON`);
                  parsed = { issues: fixedIssues };
                  break;
                }
              }
            }
          }

          if (attempts >= maxAttempts - 1) {
            const issuesMatch = jsonString.match(/"issues"\s*:\s*\[/);
            if (issuesMatch) {
              let issuesArray: any[] = [];
              let currentIssue = '';
              let braceCount = 0;
              let inString = false;
              let escapeNext = false;

              for (let i = issuesMatch.index! + issuesMatch[0].length; i < jsonString.length; i++) {
                const char = jsonString[i];
                
                if (escapeNext) {
                  currentIssue += char;
                  escapeNext = false;
                  continue;
                }

                if (char === '\\') {
                  escapeNext = true;
                  currentIssue += char;
                  continue;
                }

                if (char === '"') {
                  inString = !inString;
                  currentIssue += char;
                  continue;
                }

                if (!inString) {
                  if (char === '{') braceCount++;
                  if (char === '}') braceCount--;
                  
                  currentIssue += char;

                  if (braceCount === 0 && char === '}') {
                    try {
                      const parsedIssue = JSON.parse(currentIssue.trim());
                      if (parsedIssue.line && parsedIssue.severity) {
                        issuesArray.push(parsedIssue);
                      }
                    } catch {}
                    currentIssue = '';
                    
                    if (jsonString.substring(i + 1).trim().startsWith(']')) {
                      break;
                    }
                  }
                } else {
                  currentIssue += char;
                }
              }

              if (issuesArray.length > 0) {
                console.log(`🔧 Manually extracted ${issuesArray.length} issues from corrupted JSON`);
                parsed = { issues: issuesArray };
                break;
              }
            }
          }

          if (attempts >= maxAttempts) {
            throw parseError;
          }
        }
      }

      if (!parsed || !parsed.issues || !Array.isArray(parsed.issues)) {
        console.error("❌ Invalid response format - missing 'issues' array");
        throw new Error("Invalid response format");
      }

      let validIssues = parsed.issues.filter((issue: any) => 
        issue && 
        typeof issue.line === 'number' && 
        typeof issue.severity === 'string' &&
        typeof issue.title === 'string'
      );

      // Filter out false positives
      validIssues = validIssues.filter((issue: any) => {
        const title = (issue.title || '').toLowerCase();
        const description = (issue.description || '').toLowerCase();
        const suggestion = (issue.suggestion || '').toLowerCase();
        const category = (issue.category || '').toLowerCase();
        
        // Filter SQL injection false positives
        if (title.includes('sql injection') || description.includes('sql injection') || suggestion.includes('sql injection')) {
          const hasSqlKeywords = description.includes('sql') || description.includes('database') || 
                                description.includes('query') || description.includes('statement') ||
                                description.includes('preparedstatement') || description.includes('jdbc') ||
                                description.includes('connection') || description.includes('cursor') ||
                                description.includes('execute');
          if (!hasSqlKeywords) {
            console.log(`⚠️  Filtered out false SQL injection issue at line ${issue.line} - no SQL code detected`);
            return false;
          }
        }
        
        // Filter XSS false positives
        if (title.includes('xss') || description.includes('xss') || (category === 'security' && (title.includes('cross-site') || title.includes('script')))) {
          const hasWebKeywords = description.includes('html') || description.includes('dom') || 
                                description.includes('innerhtml') || description.includes('dangerouslysetinnerhtml') ||
                                description.includes('user input') || description.includes('user-generated') ||
                                description.includes('script') || description.includes('eval');
          if (!hasWebKeywords) {
            console.log(`⚠️  Filtered out false XSS issue at line ${issue.line} - no HTML/web context`);
            return false;
          }
        }
        
        // Filter auth false positives
        if ((category === 'security' && (title.includes('auth') || title.includes('authentication') || title.includes('authorization'))) ||
            description.includes('authentication') || description.includes('authorization')) {
          const hasAuthKeywords = description.includes('token') || description.includes('session') ||
                                 description.includes('login') || description.includes('password') ||
                                 description.includes('jwt') || description.includes('credential') ||
                                 description.includes('cookie') || description.includes('bearer');
          if (!hasAuthKeywords) {
            console.log(`⚠️  Filtered out false auth issue at line ${issue.line} - no auth code detected`);
            return false;
          }
        }
        
        // Enhanced validation for Java null pointer exceptions
        // Only keep if description clearly explains WHY variable can be null
        if (title.includes('null pointer') || title.includes('nullpointer') || description.includes('null pointer')) {
          // Check if description provides actual context (not generic)
          const hasSpecificContext = description.includes('variable') || description.includes('object') || 
                                    description.includes('method') || description.includes('return') ||
                                    description.includes('parameter') || description.includes('field');
          const isGeneric = description.includes('may be null') && !hasSpecificContext;
          
          if (isGeneric && !description.includes('after') && !description.includes('before') && 
              !description.includes('without') && !description.includes('missing')) {
            console.log(`⚠️  Filtered out generic null pointer exception at line ${issue.line} - no specific context`);
            return false;
          }
        }
        
        // Enhanced validation for Java resource leaks (these are CRITICAL - keep them)
        const hasResourceLeakKeywords = title.includes('resource') || title.includes('leak') || 
                                        title.includes('not closed') || title.includes('close') ||
                                        description.includes('resource') || description.includes('leak') || 
                                        description.includes('not closed') || description.includes('close');
        
        const hasJavaResourceTypes = title.includes('bufferedreader') || title.includes('bufferedwriter') || 
                                     title.includes('scanner') || title.includes('filereader') || 
                                     title.includes('filewriter') || title.includes('reader') || title.includes('writer') ||
                                     description.includes('bufferedreader') || description.includes('bufferedwriter') ||
                                     description.includes('scanner') || description.includes('filereader') || 
                                     description.includes('filewriter') || description.includes('reader') || description.includes('writer');
        
        if (hasResourceLeakKeywords && hasJavaResourceTypes) {
          // These are VALID and CRITICAL Java issues - ALWAYS keep them
          console.log(`✅ Keeping CRITICAL Java resource leak issue at line ${issue.line}: "${issue.title}"`);
          return true;
        }
        
        // Validate line number
        if (issue.line < 1 || issue.line > 100000) {
          console.log(`⚠️  Filtered out issue with invalid line number: ${issue.line}`);
          return false;
        }
        
        return true;
      });

      console.log(`✅ Successfully parsed ${validIssues.length} issues (after filtering)`);
      return { issues: validIssues };
    } catch (error: any) {
      console.error("⚠️  Failed to parse AI response, returning fallback");
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

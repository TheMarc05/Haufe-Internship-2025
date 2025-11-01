export interface Issue {
  line: number;
  column?: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "security" | "bug" | "performance" | "style" | "best-practice";
  title: string;
  description: string;
  suggestion: string;
  fixedCode?: string;
  reasoning: string;
}

export interface AnalysisSummary {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  estimatedFixTime: string;
}

export interface AnalysisMetadata {
  model: string;
  tokensUsed?: number;
  promptTokens?: number;
  responseTokens?: number;
  processingTime: number;
  language: string;
}

export interface AnalysisResult {
  issues: Issue[];
  summary: AnalysisSummary;
  metadata: AnalysisMetadata;
}

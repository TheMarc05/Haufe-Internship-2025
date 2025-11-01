import axiosInstance from "./axiosInstance";

// Types
export interface Comment {
  id: number;
  reviewId: number;
  authorId: number;
  lineNumber?: number;
  commentText: string;
  isAI: boolean;
  createdAt: string;
  author: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Project {
  id: number;
  userId: number;
  name: string;
  description?: string;
  repoUrl?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    files: number;
  };
}

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

export interface Review {
  id: number;
  fileId: number;
  modelUsed: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  report: {
    issues: Issue[];
  };
  summary?: AnalysisSummary;
  metadata?: {
    model: string;
    processingTime: number;
    language: string;
  };
  createdAt: string;
  file?: {
    id: number;
    filename: string;
    language: string;
    content: string;
    path: string;
    projectId: number;
  };
  comments?: Comment[];
}

export interface DashboardStats {
  totalProjects: number;
  totalFiles: number;
  totalReviews: number;
  totalIssues: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
  totalTokens: number;
  avgTokensPerFile: number;
  totalProcessingTime: number;
  avgProcessingTime: number;
  topProblematicFiles: Array<{
    filename: string;
    language: string;
    issueCount: number;
    criticalCount: number;
    reviewId: number;
    createdAt: string;
  }>;
  recentReviews: Array<{
    id: number;
    fileId: number;
    modelUsed: string;
    status: string;
    summary: AnalysisSummary;
    createdAt: string;
    file: {
      filename: string;
      language: string;
    };
  }>;
}

// Projects API
export const projectsApi = {
  create: async (data: {
    name: string;
    description?: string;
    repoUrl?: string;
  }) => {
    const response = await axiosInstance.post("/projects", data);
    return response.data;
  },

  getAll: async (): Promise<{ success: boolean; data: Project[] }> => {
    const response = await axiosInstance.get("/projects");
    return response.data;
  },

  getById: async (id: number) => {
    const response = await axiosInstance.get(`/projects/${id}`);
    return response.data;
  },

  update: async (id: number, data: Partial<Project>) => {
    const response = await axiosInstance.put(`/projects/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await axiosInstance.delete(`/projects/${id}`);
    return response.data;
  },
};

// Analyze API
export const analyzeApi = {
  analyzeFile: async (data: {
    projectId: number;
    filename: string;
    content: string;
    path?: string;
  }) => {
    const response = await axiosInstance.post("/analyze", data);
    return response.data;
  },

  analyzeBatch: async (data: { projectId: number; files: Array<any> }) => {
    const response = await axiosInstance.post("/analyze/batch", data);
    return response.data;
  },

  healthCheck: async () => {
    const response = await axiosInstance.get("/analyze/health");
    return response.data;
  },
};

// Reviews API
export const reviewsApi = {
  getById: async (id: number): Promise<{ success: boolean; data: Review }> => {
    const response = await axiosInstance.get(`/reviews/${id}`);
    return response.data;
  },

  getByProject: async (projectId: number) => {
    const response = await axiosInstance.get(`/reviews/project/${projectId}`);
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: DashboardStats }> => {
    const response = await axiosInstance.get("/reviews/stats");
    return response.data;
  },

  addComment: async (
    reviewId: number,
    data: { commentText: string; lineNumber?: number; requestAIReply?: boolean }
  ) => {
    const response = await axiosInstance.post(
      `/reviews/${reviewId}/comments`,
      data
    );
    return response.data;
  },

  delete: async (id: number) => {
    const response = await axiosInstance.delete(`/reviews/${id}`);
    return response.data;
  },
};

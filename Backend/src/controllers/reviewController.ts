import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

//get a specific review
export const getReviewById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const review = await prisma.review.findFirst({
      where: {
        id: parseInt(id),
        file: {
          project: {
            userId,
          },
        },
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            language: true,
            content: true,
            path: true,
            projectId: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    console.error("Get review error:", error);
    res.status(500).json({ error: "Failed to fetch review" });
  }
};

//get all review for a project
export const getProjectReviews = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    // Verifică ownership
    const project = await prisma.project.findFirst({
      where: {
        id: parseInt(projectId),
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const reviews = await prisma.review.findMany({
      where: {
        file: {
          projectId: parseInt(projectId),
        },
      },
      include: {
        file: {
          select: {
            filename: true,
            language: true,
            path: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    console.error("Get project reviews error:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
};

//get dashboard stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    // Total projects
    const totalProjects = await prisma.project.count({
      where: { userId },
    });

    // Total files analyzed
    const totalFiles = await prisma.file.count({
      where: {
        project: { userId },
      },
    });

    // Total reviews
    const totalReviews = await prisma.review.count({
      where: {
        file: {
          project: { userId },
        },
      },
    });

    // Get all reviews with summaries and metadata
    const reviews = await prisma.review.findMany({
      where: {
        file: {
          project: { userId },
        },
        status: "COMPLETED",
      },
      select: {
        summary: true,
        metadata: true,
        createdAt: true,
      },
    });

    //Aggregate stats
    let totalIssues = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;
    let totalTokens = 0;
    let totalProcessingTime = 0;

    reviews.forEach((review: any) => {
      if (review.summary) {
        totalIssues += review.summary.totalIssues || 0;
        criticalIssues += review.summary.bySeverity?.critical || 0;
        highIssues += review.summary.bySeverity?.high || 0;
        mediumIssues += review.summary.bySeverity?.medium || 0;
        lowIssues += review.summary.bySeverity?.low || 0;
      }
      if (review.metadata) {
        totalTokens += review.metadata.tokensUsed || 0;
        totalProcessingTime += review.metadata.processingTime || 0;
      }
    });

    // Top 10 files with the most issues
    const filesWithIssues = await prisma.file.findMany({
      where: {
        project: { userId },
      },
      include: {
        reviews: {
          where: { status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    const topProblematicFiles = filesWithIssues
      .filter((f: any) => f.reviews.length > 0 && f.reviews[0].summary)
      .map((f: any) => ({
        filename: f.filename,
        language: f.language,
        issueCount: (f.reviews[0].summary as any)?.totalIssues || 0,
        criticalCount: (f.reviews[0].summary as any)?.bySeverity?.critical || 0,
        reviewId: f.reviews[0].id,
        createdAt: f.reviews[0].createdAt,
      }))
      .sort((a: any, b: any) => b.issueCount - a.issueCount)
      .slice(0, 10);

    // Recent reviews (last 10)
    const recentReviews = await prisma.review.findMany({
      where: {
        file: {
          project: { userId },
        },
        status: "COMPLETED",
      },
      include: {
        file: {
          select: {
            filename: true,
            language: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        totalProjects,
        totalFiles,
        totalReviews,
        totalIssues,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        totalTokens,
        avgTokensPerFile:
          totalFiles > 0 ? Math.round(totalTokens / totalFiles) : 0,
        totalProcessingTime,
        avgProcessingTime:
          totalReviews > 0 ? Math.round(totalProcessingTime / totalReviews) : 0,
        topProblematicFiles,
        recentReviews,
      },
    });
  } catch (error: any) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};

export const addComment = async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { commentText, lineNumber, requestAIReply = true } = req.body; // ✅ Nou parametru
    const userId = req.user!.id;

    if (!commentText) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    // Verifică review exists and belongs to user
    const review = await prisma.review.findFirst({
      where: {
        id: parseInt(reviewId),
        file: {
          project: {
            userId,
          },
        },
      },
      include: {
        file: {
          select: {
            content: true,
            language: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Create user comment
    const userComment = await prisma.comment.create({
      data: {
        reviewId: parseInt(reviewId),
        authorId: userId,
        commentText,
        lineNumber: lineNumber ? parseInt(lineNumber) : null,
        isAI: false,
      },
      include: {
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // ✅ Generate AI reply (if requested)
    let aiComment = null;
    if (requestAIReply && lineNumber) {
      try {
        // Find relevant issue
        const issues = (review.report as any)?.issues || [];
        const relevantIssue = issues.find(
          (issue: any) => issue.line === parseInt(lineNumber)
        );

        if (relevantIssue) {
          // Extract code context (5 lines before and after)
          const codeLines = review.file.content.split("\n");
          const startLine = Math.max(0, parseInt(lineNumber) - 5);
          const endLine = Math.min(codeLines.length, parseInt(lineNumber) + 5);
          const codeContext = codeLines.slice(startLine, endLine).join("\n");

          // Generate AI reply
          const aiService = new (
            await import("../services/aiService")
          ).AIService();
          const aiReplyText = await aiService.generateCommentReply(
            commentText,
            relevantIssue,
            codeContext,
            review.file.language
          );

          // Save AI reply
          aiComment = await prisma.comment.create({
            data: {
              reviewId: parseInt(reviewId),
              authorId: userId, // same user for simplicity
              commentText: aiReplyText,
              lineNumber: lineNumber ? parseInt(lineNumber) : null,
              isAI: true,
            },
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  avatar: true,
                },
              },
            },
          });

          console.log(`✅ AI replied to comment on line ${lineNumber}`);
        }
      } catch (aiError) {
        console.error("AI reply failed, continuing without it:", aiError);
        // Don't stop the process if AI fails
      }
    }

    res.status(201).json({
      success: true,
      data: {
        userComment,
        aiComment, // can be null if AI didn't reply
      },
    });
  } catch (error: any) {
    console.error("Add comment error:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // verify ownership
    const review = await prisma.review.findFirst({
      where: {
        id: parseInt(id),
        file: {
          project: {
            userId,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    await prisma.review.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
};

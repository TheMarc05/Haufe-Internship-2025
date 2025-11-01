import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { GuidelineService } from "../services/guidelineService";

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description, repoUrl, guidelineIds, customRules } = req.body;
    const userId = req.user!.id;

    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }

    if (guidelineIds && Array.isArray(guidelineIds)) {
      const { valid, invalid } = GuidelineService.validateGuidelineIds(guidelineIds);
      if (invalid.length > 0) {
        return res.status(400).json({
          error: "Invalid guideline IDs",
          invalidIds: invalid,
        });
      }
    }

    const project = await prisma.project.create({
      data: {
        userId,
        name,
        description,
        repoUrl,
        guidelineIds: guidelineIds || null,
        customRules: customRules || null,
      } as any,
    });

    res.status(201).json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    console.error("Create project error:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
};

export const getUserProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            files: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error: any) {
    console.error("Get projects error:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const project = await prisma.project.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
      include: {
        files: {
          include: {
            reviews: {
              orderBy: { createdAt: "desc" },
              take: 1, // Ultimul review
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    console.error("Get project error:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, repoUrl, guidelineIds, customRules } = req.body;
    const userId = req.user!.id;

    const existingProject = await prisma.project.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (guidelineIds && Array.isArray(guidelineIds)) {
      const { valid, invalid } = GuidelineService.validateGuidelineIds(guidelineIds);
      if (invalid.length > 0) {
        return res.status(400).json({
          error: "Invalid guideline IDs",
          invalidIds: invalid,
        });
      }
    }

    const project = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        name: name !== undefined ? name : existingProject.name,
        description: description !== undefined ? description : existingProject.description,
        repoUrl: repoUrl !== undefined ? repoUrl : existingProject.repoUrl,
        guidelineIds: guidelineIds !== undefined ? guidelineIds : (existingProject as any).guidelineIds,
        customRules: customRules !== undefined ? customRules : (existingProject as any).customRules,
      } as any,
    });

    res.json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    console.error("Update project error:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Verifică ownership
    const existingProject = await prisma.project.findFirst({
      where: {
        id: parseInt(id),
        userId,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ error: "Project not found" });
    }

    await prisma.project.delete({
      where: { id: parseInt(id) },
    });

    res.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete project error:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
};

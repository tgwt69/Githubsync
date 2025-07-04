import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertRepositorySchema, insertFileOperationSchema } from "@shared/schema";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID_ENV_VAR || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET_ENV_VAR || "";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // GitHub OAuth routes
  app.get("/api/auth/github", (req, res) => {
    const redirectUri = `https://${req.get('host')}/api/auth/github/callback`;
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo user:email`;
    res.redirect(githubAuthUrl);
  });

  app.get("/api/auth/github/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ error: "Authorization code missing" });
      }

      // Exchange code for access token
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return res.status(400).json({ error: "Failed to get access token" });
      }

      // Get user info from GitHub
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      const githubUser = await userResponse.json();

      // Check if user exists or create new one
      let user = await storage.getUserByGithubId(githubUser.id.toString());
      
      if (!user) {
        const newUser = insertUserSchema.parse({
          githubId: githubUser.id.toString(),
          username: githubUser.login,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
          accessToken,
        });
        user = await storage.createUser(newUser);
      } else {
        // Update access token
        user = await storage.updateUserToken(user.id, accessToken);
      }

      // Set session
      if (req.session) {
        (req.session as any).userId = user?.id;
      }

      res.redirect("/?auth=success");
    } catch (error) {
      console.error("GitHub OAuth error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // Personal Access Token authentication
  app.post("/api/auth/token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // Validate token by getting user info from GitHub
      const userResponse = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      if (!userResponse.ok) {
        return res.status(401).json({ error: "Invalid token" });
      }

      const githubUser = await userResponse.json();

      // Check if user exists or create new one
      let user = await storage.getUserByGithubId(githubUser.id.toString());
      
      if (!user) {
        const newUser = insertUserSchema.parse({
          githubId: githubUser.id.toString(),
          username: githubUser.login,
          email: githubUser.email,
          avatarUrl: githubUser.avatar_url,
          accessToken: token,
        });
        user = await storage.createUser(newUser);
      } else {
        // Update access token
        user = await storage.updateUserToken(user.id, token);
      }

      // Set session
      if (req.session) {
        (req.session as any).userId = user?.id;
      }

      res.json({ success: true, user: { ...user, accessToken: undefined } });
    } catch (error) {
      console.error("Token authentication error:", error);
      res.status(500).json({ error: "Authentication failed" });
    }
  });

  // User info route
  app.get("/api/user", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { accessToken, ...userWithoutToken } = user;
      res.json(userWithoutToken);
    } catch (error) {
      res.status(500).json({ error: "Failed to get user info" });
    }
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });
    }
    res.json({ success: true });
  });

  // Get user repositories from GitHub
  app.get("/api/repositories", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const reposResponse = await fetch("https://api.github.com/user/repos?per_page=100", {
        headers: {
          "Authorization": `Bearer ${user.accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      const githubRepos = await reposResponse.json();
      
      // Sync repositories to local storage
      for (const repo of githubRepos) {
        const existingRepo = await storage.getUserRepositories(userId);
        const found = existingRepo.find(r => r.githubId === repo.id.toString());
        
        if (!found) {
          await storage.createRepository({
            userId,
            githubId: repo.id.toString(),
            name: repo.name,
            fullName: repo.full_name,
            private: repo.private,
            defaultBranch: repo.default_branch,
          });
        }
      }

      res.json(githubRepos);
    } catch (error) {
      console.error("Failed to fetch repositories:", error);
      res.status(500).json({ error: "Failed to fetch repositories" });
    }
  });

  // Get repository branches
  app.get("/api/repositories/:owner/:repo/branches", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;

      const branchesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches`, {
        headers: {
          "Authorization": `Bearer ${user.accessToken}`,
          "Accept": "application/vnd.github.v3+json",
        },
      });

      const branches = await branchesResponse.json();
      res.json(branches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  // Get repository files
  app.get("/api/repositories/:owner/:repo/contents", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;
      const { path = "", ref = "main" } = req.query;

      const contentsResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
        {
          headers: {
            "Authorization": `Bearer ${user.accessToken}`,
            "Accept": "application/vnd.github.v3+json",
          },
        }
      );

      const contents = await contentsResponse.json();
      res.json(contents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch repository contents" });
    }
  });

  // Upload file to repository
  app.put("/api/repositories/:owner/:repo/contents/*", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;
      const filePath = (req.params as any)[0];
      const { content, message, branch = "main", sha } = req.body;

      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${user.accessToken}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message || `Upload ${filePath}`,
            content,
            branch,
            ...(sha && { sha }),
          }),
        }
      );

      const result = await uploadResponse.json();

      // Log the operation
      await storage.createFileOperation({
        userId,
        repositoryId: 0, // We'd need to map this properly
        operation: "upload",
        filePath,
        branch,
        status: uploadResponse.ok ? "completed" : "failed",
        metadata: { message, size: content.length },
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Delete file from repository
  app.delete("/api/repositories/:owner/:repo/contents/*", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;
      const filePath = (req.params as any)[0];
      const { message, branch = "main", sha } = req.body;

      const deleteResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${user.accessToken}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: message || `Delete ${filePath}`,
            sha,
            branch,
          }),
        }
      );

      const result = await deleteResponse.json();

      // Log the operation
      await storage.createFileOperation({
        userId,
        repositoryId: 0,
        operation: "delete",
        filePath,
        branch,
        status: deleteResponse.ok ? "completed" : "failed",
        metadata: { message },
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Get recent activity
  app.get("/api/activity", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const operations = await storage.getUserFileOperations(userId, 10);
      res.json(operations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // Create pull request
  // Batch upload multiple files
  app.post("/api/repositories/:owner/:repo/upload-batch", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;
      const { files, branch = "main", message } = req.body;

      if (!Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: "Files array is required" });
      }

      const results = [];
      const errors = [];

      for (const file of files) {
        try {
          const uploadResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
            {
              method: "PUT",
              headers: {
                "Authorization": `Bearer ${user.accessToken}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: message || `Upload ${file.path}`,
                content: file.content,
                branch,
              }),
            }
          );

          const result = await uploadResponse.json();
          
          if (uploadResponse.ok) {
            results.push({ path: file.path, success: true, result });
            
            // Log the operation
            await storage.createFileOperation({
              userId,
              repositoryId: 0,
              operation: "upload",
              filePath: file.path,
              branch,
              status: "completed",
              metadata: { message, size: file.content.length },
            });
          } else {
            errors.push({ path: file.path, error: result.message || "Upload failed" });
          }
        } catch (error) {
          errors.push({ path: file.path, error: error instanceof Error ? error.message : "Unknown error" });
        }
      }

      res.json({ 
        success: errors.length === 0,
        uploaded: results.length,
        failed: errors.length,
        results,
        errors 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to upload files" });
    }
  });

  app.post("/api/repositories/:owner/:repo/pulls", async (req, res) => {
    try {
      const userId = req.session ? (req.session as any).userId : null;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { owner, repo } = req.params;
      const { title, body, head, base } = req.body;

      const prResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${user.accessToken}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            body,
            head,
            base,
          }),
        }
      );

      const result = await prResponse.json();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to create pull request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

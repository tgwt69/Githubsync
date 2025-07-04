import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Github, LogOut } from "lucide-react";
import { useGitHub } from "@/hooks/use-github";
import RepositorySelector from "@/components/repository-selector";
import FileUploadPanel from "@/components/file-upload-panel";
import FileTreeBrowser from "@/components/file-tree-browser";
import RecentActivity from "@/components/recent-activity";
import TokenAuth from "@/components/token-auth";
import { useState } from "react";
import type { GitHubRepository } from "@shared/schema";

export default function Home() {
  const { user, logout, isAuthenticated } = useGitHub();
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-github-bg">
        <div className="bg-white p-8 rounded-lg border border-github-border shadow-sm max-w-md w-full mx-4">
          <div className="text-center">
            <Github className="h-12 w-12 text-github-blue mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">GitHubSync</h1>
            <p className="text-github-gray mb-6">
              Repository File Manager
            </p>
            <div className="space-y-4">
              <Button asChild className="w-full github-button">
                <a href="/api/auth/github">
                  <Github className="mr-2 h-4 w-4" />
                  Sign in with GitHub OAuth
                </a>
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-github-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-github-gray">Or use token</span>
                </div>
              </div>
              <TokenAuth />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-github-bg">
      {/* Header */}
      <header className="bg-white border-b border-github-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Github className="h-6 w-6 text-gray-900" />
                <span className="text-xl font-semibold">GitHubSync</span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <span className="text-gray-700 px-3 py-2 text-sm font-medium">Repositories</span>
                <span className="text-gray-700 px-3 py-2 text-sm font-medium">File Manager</span>
                <span className="text-gray-700 px-3 py-2 text-sm font-medium">Pull Requests</span>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-github-gray">Connected as</span>
                <div className="flex items-center space-x-2">
                  {user?.avatarUrl && (
                    <img 
                      src={user.avatarUrl} 
                      alt="User avatar" 
                      className="w-8 h-8 rounded-full" 
                    />
                  )}
                  <span className="text-sm font-medium">{user?.username}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => logout()}
                  className="text-github-gray hover:text-gray-900"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RepositorySelector 
          selectedRepo={selectedRepo}
          selectedBranch={selectedBranch}
          onRepoChange={setSelectedRepo}
          onBranchChange={setSelectedBranch}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <FileUploadPanel 
            selectedRepo={selectedRepo}
            selectedBranch={selectedBranch}
          />
          
          <div className="lg:col-span-2">
            <FileTreeBrowser 
              selectedRepo={selectedRepo}
              selectedBranch={selectedBranch}
            />
          </div>
        </div>

        <RecentActivity />
      </div>
    </div>
  );
}

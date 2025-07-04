import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { RefreshCw, FolderPlus, Folder, FileText, Download, Trash2, ChevronRight, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { GitHubRepository, GitHubFile } from "@shared/schema";

interface FileTreeBrowserProps {
  selectedRepo: GitHubRepository | null;
  selectedBranch: string;
}

export default function FileTreeBrowser({ selectedRepo, selectedBranch }: FileTreeBrowserProps) {
  const [currentPath, setCurrentPath] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files, isLoading, refetch } = useQuery<GitHubFile[]>({
    queryKey: ["/api/repositories", selectedRepo?.full_name, "contents", currentPath, selectedBranch],
    enabled: !!selectedRepo,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ filePath, sha }: { filePath: string; sha: string }) => {
      if (!selectedRepo) throw new Error("No repository selected");
      
      const response = await apiRequest(
        "DELETE",
        `/api/repositories/${selectedRepo.full_name}/contents/${filePath}`,
        {
          message: `Delete ${filePath}`,
          sha,
          branch: selectedBranch,
        }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "File deleted successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/repositories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activity"] });
    },
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileClick = (file: GitHubFile) => {
    if (file.type === "dir") {
      setCurrentPath(file.path);
    }
  };

  const handleDelete = (file: GitHubFile) => {
    if (file.type === "file") {
      deleteMutation.mutate({ filePath: file.path, sha: file.sha });
    }
  };

  const handleDownload = async (file: GitHubFile) => {
    if (file.download_url) {
      const link = document.createElement('a');
      link.href = file.download_url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const pathSegments = currentPath.split('/').filter(Boolean);

  const getFileIcon = (file: GitHubFile) => {
    if (file.type === "dir") {
      return <Folder className="h-4 w-4 text-github-blue" />;
    }
    
    // File type icons based on extension
    const extension = file.name.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return <FileText className="h-4 w-4 text-yellow-500" />;
      case 'json':
        return <FileText className="h-4 w-4 text-yellow-600" />;
      case 'md':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <FileText className="h-4 w-4 text-github-gray" />;
    }
  };

  if (!selectedRepo) {
    return (
      <Card className="github-border">
        <CardContent className="p-12 text-center">
          <FolderOpen className="h-12 w-12 text-github-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Repository Selected</h3>
          <p className="text-github-gray">Select a repository to browse its files</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="github-border">
      <CardHeader className="border-b border-github-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-900">
            Repository Files
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
              className="github-border"
            >
              <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" className="github-button">
              <FolderPlus className="mr-1 h-4 w-4" />
              New Folder
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Breadcrumb Navigation */}
      <div className="px-6 py-3 bg-gray-50 border-b border-github-border">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => navigateToPath("")}
                className="text-github-blue hover:underline cursor-pointer"
              >
                {selectedRepo.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            {pathSegments.map((segment, index) => {
              const path = pathSegments.slice(0, index + 1).join('/');
              const isLast = index === pathSegments.length - 1;
              
              return (
                <div key={segment} className="flex items-center">
                  <BreadcrumbSeparator>
                    <ChevronRight className="h-4 w-4" />
                  </BreadcrumbSeparator>
                  <BreadcrumbItem>
                    {isLast ? (
                      <span className="text-github-gray">{segment}</span>
                    ) : (
                      <BreadcrumbLink 
                        onClick={() => navigateToPath(path)}
                        className="text-github-blue hover:underline cursor-pointer"
                      >
                        {segment}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <CardContent className="p-6">
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 text-github-gray mx-auto mb-2 animate-spin" />
            <p className="text-github-gray">Loading files...</p>
          </div>
        ) : files && files.length > 0 ? (
          <div className="space-y-1">
            {files.map((file, index) => (
              <div
                key={`${file.path}-${index}`}
                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md cursor-pointer group"
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(file)}
                  <span className={`text-sm ${file.type === 'dir' ? 'font-medium text-gray-900' : 'text-gray-900'}`}>
                    {file.name}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-2">
                    {file.type === "file" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(file);
                        }}
                        className="h-6 w-6 p-0 text-github-gray hover:text-gray-900"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className="h-6 w-6 p-0 text-github-gray hover:text-red-600"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="h-12 w-12 text-github-gray mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No files yet</h4>
            <p className="text-github-gray mb-4">Upload files to get started with your repository</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

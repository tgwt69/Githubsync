import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { GitHubRepository, GitHubBranch } from "@shared/schema";

interface RepositorySelectorProps {
  selectedRepo: GitHubRepository | null;
  selectedBranch: string;
  onRepoChange: (repo: GitHubRepository | null) => void;
  onBranchChange: (branch: string) => void;
}

export default function RepositorySelector({ 
  selectedRepo, 
  selectedBranch, 
  onRepoChange, 
  onBranchChange 
}: RepositorySelectorProps) {
  const { data: repositories, isLoading: reposLoading } = useQuery<GitHubRepository[]>({
    queryKey: ["/api/repositories"],
  });

  const { data: branches, isLoading: branchesLoading } = useQuery<GitHubBranch[]>({
    queryKey: ["/api/repositories", selectedRepo?.full_name, "branches"],
    enabled: !!selectedRepo,
  });

  const handleRepoChange = (repoFullName: string) => {
    const repo = repositories?.find(r => r.full_name === repoFullName) || null;
    onRepoChange(repo);
    if (repo) {
      onBranchChange(repo.default_branch);
    }
  };

  return (
    <Card className="github-border">
      <CardHeader className="border-b border-github-border">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Repository & Branch Selection
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repository" className="block text-sm font-medium text-gray-700 mb-2">
              Repository
            </Label>
            <Select
              value={selectedRepo?.full_name || ""}
              onValueChange={handleRepoChange}
              disabled={reposLoading}
            >
              <SelectTrigger className="w-full github-border">
                <SelectValue placeholder={reposLoading ? "Loading repositories..." : "Select a repository"} />
              </SelectTrigger>
              <SelectContent>
                {repositories?.map((repo) => (
                  <SelectItem key={repo.id} value={repo.full_name}>
                    {repo.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="branch" className="block text-sm font-medium text-gray-700 mb-2">
              Branch
            </Label>
            <Select
              value={selectedBranch}
              onValueChange={onBranchChange}
              disabled={branchesLoading || !selectedRepo}
            >
              <SelectTrigger className="w-full github-border">
                <SelectValue placeholder={branchesLoading ? "Loading branches..." : "Select a branch"} />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.name} value={branch.name}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, GitBranch, Folder } from "lucide-react";
import type { FileOperation } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

export default function RecentActivity() {
  const { data: activities, isLoading } = useQuery<FileOperation[]>({
    queryKey: ["/api/activity"],
  });

  const getActivityIcon = (operation: string) => {
    switch (operation) {
      case "upload":
        return <Upload className="h-4 w-4 text-green-600" />;
      case "delete":
        return <GitBranch className="h-4 w-4 text-red-600" />;
      case "create_folder":
        return <Folder className="h-4 w-4 text-yellow-600" />;
      default:
        return <Upload className="h-4 w-4 text-github-gray" />;
    }
  };

  const getActivityMessage = (activity: FileOperation) => {
    switch (activity.operation) {
      case "upload":
        return `uploaded ${activity.filePath} to ${activity.branch}`;
      case "delete":
        return `deleted ${activity.filePath} from ${activity.branch}`;
      case "create_folder":
        return `created folder ${activity.filePath}`;
      default:
        return `performed ${activity.operation} on ${activity.filePath}`;
    }
  };

  return (
    <Card className="mt-8 github-border">
      <CardHeader className="border-b border-github-border">
        <CardTitle className="text-lg font-semibold text-gray-900">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-github-gray">Loading activity...</p>
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    activity.operation === "upload" ? "bg-green-100" :
                    activity.operation === "delete" ? "bg-red-100" :
                    "bg-yellow-100"
                  }`}>
                    {getActivityIcon(activity.operation)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">You</span> {getActivityMessage(activity)}
                  </p>
                  <p className="text-xs text-github-gray">
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                  </p>
                  {activity.status === "failed" && (
                    <p className="text-xs text-red-600 mt-1">Failed</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-github-gray">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function TokenAuth() {
  const [token, setToken] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tokenAuthMutation = useMutation({
    mutationFn: async (accessToken: string) => {
      const response = await apiRequest("POST", "/api/auth/token", {
        token: accessToken,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Authenticated with personal access token!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      setToken("");
    },
    onError: (error) => {
      toast({
        title: "Authentication failed",
        description: error.message || "Invalid token",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      tokenAuthMutation.mutate(token.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="token" className="text-sm font-medium text-gray-700">
          Personal Access Token
        </Label>
        <Input
          id="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1 github-border"
        />
        <p className="text-xs text-github-gray mt-1">
          Create one at GitHub Settings → Developer settings → Personal access tokens
        </p>
      </div>
      <Button 
        type="submit" 
        className="w-full github-button"
        disabled={!token.trim() || tokenAuthMutation.isPending}
      >
        <Key className="mr-2 h-4 w-4" />
        {tokenAuthMutation.isPending ? "Authenticating..." : "Sign in with Token"}
      </Button>
    </form>
  );
}
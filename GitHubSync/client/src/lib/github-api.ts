export class GitHubAPI {
  private baseUrl = "https://api.github.com";
  
  constructor(private accessToken: string) {}

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async getUser() {
    return this.request("/user");
  }

  async getRepositories() {
    return this.request("/user/repos?per_page=100");
  }

  async getRepositoryBranches(owner: string, repo: string) {
    return this.request(`/repos/${owner}/${repo}/branches`);
  }

  async getRepositoryContents(owner: string, repo: string, path = "", ref = "main") {
    return this.request(`/repos/${owner}/${repo}/contents/${path}?ref=${ref}`);
  }

  async createOrUpdateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    branch = "main",
    sha?: string
  ) {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      body: JSON.stringify({
        message,
        content,
        branch,
        ...(sha && { sha }),
      }),
    });
  }

  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch = "main"
  ) {
    return this.request(`/repos/${owner}/${repo}/contents/${path}`, {
      method: "DELETE",
      body: JSON.stringify({
        message,
        sha,
        branch,
      }),
    });
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ) {
    return this.request(`/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title,
        head,
        base,
        body,
      }),
    });
  }
}

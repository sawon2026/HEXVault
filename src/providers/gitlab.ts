/**
 * GitLab support (basic)
 * Uses GitLab REST API for MR reviews
 */

export interface GitLabMR {
  iid: number;
  title: string;
  description: string;
  web_url: string;
}

export class GitLabClient {
  private token: string;
  private baseUrl: string;
  private projectId: string;

  constructor(opts: { token: string; baseUrl?: string; projectId: string }) {
    this.token = opts.token;
    this.baseUrl = (opts.baseUrl || "https://gitlab.com").replace(/\/$/, "");
    this.projectId = encodeURIComponent(opts.projectId);
  }

  private async request(path: string, method = "GET", body?: any) {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      method,
      headers: {
        "PRIVATE-TOKEN": this.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
      throw new Error(`GitLab API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getMergeRequest(iid: number): Promise<GitLabMR> {
    return this.request(
      `/projects/${this.projectId}/merge_requests/${iid}`,
    ) as Promise<GitLabMR>;
  }

  async postNote(iid: number, body: string) {
    return this.request(
      `/projects/${this.projectId}/merge_requests/${iid}/notes`,
      "POST",
      {
        body,
      },
    );
  }

  async listChangedFiles(iid: number): Promise<string[]> {
    const changes = (await this.request(
      `/projects/${this.projectId}/merge_requests/${iid}/changes`,
    )) as any;
    return (changes.changes || []).map((c: any) => c.new_path || c.old_path);
  }
}

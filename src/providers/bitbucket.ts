/**
 * Bitbucket Cloud support (basic)
 */

export class BitbucketClient {
  private username: string;
  private appPassword: string;
  private workspace: string;
  private repoSlug: string;

  constructor(opts: {
    username: string;
    appPassword: string;
    workspace: string;
    repoSlug: string;
  }) {
    this.username = opts.username;
    this.appPassword = opts.appPassword;
    this.workspace = opts.workspace;
    this.repoSlug = opts.repoSlug;
  }

  private authHeader() {
    return (
      "Basic " +
      Buffer.from(`${this.username}:${this.appPassword}`).toString("base64")
    );
  }

  private async request(path: string, method = "GET", body?: any) {
    const res = await fetch(`https://api.bitbucket.org/2.0${path}`, {
      method,
      headers: {
        Authorization: this.authHeader(),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok)
      throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
    return res.json();
  }

  async getPullRequest(id: number) {
    return this.request(
      `/repositories/${this.workspace}/${this.repoSlug}/pullrequests/${id}`,
    );
  }

  async postComment(id: number, content: string) {
    return this.request(
      `/repositories/${this.workspace}/${this.repoSlug}/pullrequests/${id}/comments`,
      "POST",
      { content: { raw: content } },
    );
  }
}

/**
 * GitHub Action entrypoint for HEXVault Smart PR Reviewer
 */
import * as core from "@actions/core";
import * as github from "@actions/github";
import path from "path";
import { MemoryStore } from "../core/memory/store.js";
import { ReviewEngine } from "../core/review/reviewer.js";
import { loadConfig } from "../config/index.js";

async function run() {
  try {
    const token = core.getInput("github-token") || process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed("GITHUB_TOKEN is required");
      return;
    }

    const octokit = github.getOctokit(token);
    const context = github.context;

    if (context.eventName !== "pull_request") {
      core.info("Not a pull_request event, skipping");
      return;
    }

    const pr = context.payload.pull_request;
    if (!pr) {
      core.setFailed("No pull_request found in payload");
      return;
    }

    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const prNumber = pr.number;

    core.info(`Reviewing PR #${prNumber}: ${pr.title}`);

    // Get PR diff
    const { data: files } = await octokit.rest.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    const changedFiles = files.map((f) => f.filename);
    const diffSummary = files
      .map((f) => `File: ${f.filename}\n${f.patch || "(binary or large file)"}`)
      .join("\n\n");

    // Load memory
    const config = loadConfig(process.cwd());
    const dbPath = path.resolve(config.memory.path);
    const store = new MemoryStore({ dbPath });

    // Find related memories
    let related = store.searchByFiles(changedFiles, 10);
    if (related.length < 3) {
      // fallback to recent + keyword
      const recent = store.list(15);
      related = [...related, ...recent].slice(0, 10);
    }

    // Run review
    const engine = new ReviewEngine(config.review);
    const result = await engine.review(
      pr.title || "Untitled PR",
      pr.body || "",
      diffSummary,
      related
    );

    store.close();

    // Build comment body
    let body = `## 🧠 HEXVault Review\n\n`;
    body += result.summary;
    body += `\n\n**Score:** ${result.score}/100\n`;

    if (result.securityIssues.length > 0) {
      body += `\n### 🔒 Security Issues\n`;
      result.securityIssues.forEach((i) => (body += `- ${i}\n`));
    }

    if (result.comments.length > 0) {
      body += `\n### Comments\n`;
      result.comments.forEach((c) => {
        body += `- **[${c.severity}]** ${c.body}\n`;
      });
    }

    if (result.usedMemories.length > 0) {
      body += `\n---\n*Used project memories: ${result.usedMemories.join(", ")}*\n`;
    }

    body += `\n---\n*Powered by [HEXVault](https://github.com/sawon2026/HEXVault)*`;

    // Post comment
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    core.info("Review comment posted successfully");
    core.setOutput("score", result.score);
    core.setOutput("security-issues", result.securityIssues.length);
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

run();

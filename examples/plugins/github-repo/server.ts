import { definePlugin, z } from "harebear-dashboard/sdk"

interface Repo {
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  pushed_at: string
}

export default definePlugin({
  id: "github-repo",
  name: "GitHub repo",
  description: "Stars, forks and open issues for a public GitHub repository.",
  options: z.object({
    repo: z
      .string()
      .regex(/^[\w.-]+\/[\w.-]+$/)
      .describe("owner/name"),
  }),
  secrets: z.object({ token: z.string().optional().describe("Optional token for a higher rate limit") }),
  hosts: () => ["api.github.com"],
  refresh: "30m",
  async load({ options, secrets, fetch }) {
    const res = await fetch(`https://api.github.com/repos/${options.repo}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(secrets.token ? { authorization: `Bearer ${secrets.token}` } : {}),
      },
    })
    if (!res.ok) throw new Error(`GitHub returned HTTP ${res.status}`)
    const r = await res.json<Repo>()
    return {
      name: r.full_name,
      url: r.html_url,
      description: r.description ?? "",
      stars: r.stargazers_count,
      forks: r.forks_count,
      issues: r.open_issues_count,
      pushedAt: Date.parse(r.pushed_at),
    }
  },
})

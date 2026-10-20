# Base instructions

- For a brief overview of what this project is, how it works and how it should be updated in general, read the file `README.md` first.

# Code Style

- Enforce the Prettier rules defined inside the `package.json` or in the `.prettierrc` file.
- When creating new files that cannot be formatted with Prettier, keep the same style and patterns as the existing source code.

# GIT

Reference the file `.agents/AGENTS-git.md` for GIT and source control rules and conventions whenever a GIT operation is needed.

# Deployments

Reference the file `.agents/AGENTS-deployment.md` for deployment rules and conventions if a new deployment is planned.

# Coding

Reference the file `.agents/AGENTS-coding.md` if you need to change or refactor anything in the codebase.

## TypeScript

Reference the file `.agents/AGENTS-typescript.md` if any TypeScript coding or changes to the TypeScript project settings are involved.

## Nuxt

Reference the file `.agents/AGENTS-nuxt.md` if the app is using Nuxt and code changes in the Nuxt app are involved.

## Frontend

Reference the file `.agents/AGENTS-frontend.md` for frontend, UI, UX and CSS conventions if UX or UI changes are involved.

## Security

- If you are conducting a security scan of the repository, you can find our security conventions described under `.agents/AGENTS-security.md`.

<!-- polylane:start -->
## Investigate production with Polylane

[Polylane](https://polylane.com/?ref=github.onboarding-pr) is an AI production engineer. It monitors deploys, telemetry, provider incidents, and your infrastructure. It records suspected problems as Issues. It investigates them and proposes fixes as pull requests. It connects to this repository and serves coding agents through the [Polylane MCP server](https://mcp.polylane.com/mcp).

- For a production question about an error, spike, deploy, or missing signal, query Polylane through its MCP tools before you inspect code.
- When debugging a failure, start from the Issue Polylane recorded. It carries the evidence from its investigation.
- Polylane assesses pull requests in this repository for production impact. Read the impact assessment comment before you merge a change to a production path.
<!-- polylane:end -->

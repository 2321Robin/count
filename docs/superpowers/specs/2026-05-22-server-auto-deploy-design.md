# Server Auto Deploy Design

## Context

This project is a private Vite + React static site named `s2-capture-counter`. It builds with `npm run build`, which runs TypeScript compilation and Vite, and outputs static files to `dist/`.

The target server is a Huawei Cloud Flexus Linux instance running a BaoTa-style visual server panel. The server has a public IP of `60.204.199.250`, 2 vCPU, 2 GiB RAM, a 40 GiB system disk, and 2 Mbit/s bandwidth. The user already has a domain name filed and resolved to this server.

## Goal

Deploy the static site to the server and make future GitHub pushes automatically update the live website.

## Recommended Approach

Use GitHub Actions to build the site and upload the generated `dist/` files to the server over SSH.

This keeps the server simple: it only serves static files through BaoTa/Nginx and does not need Node.js, npm, or the source repository. GitHub Actions handles dependency installation, tests if configured, build logs, and deployment failure visibility.

## Alternatives Considered

### Server Pulls And Builds

The server could pull the repository and run `npm ci && npm run build` after each GitHub push. This is straightforward but requires Node.js on the server, consumes memory and CPU on a small 2 GiB instance, and needs webhook or polling setup.

### Manual BaoTa Uploads

The built files could be uploaded manually through the panel. This is simple for the first deployment but does not meet the automatic update requirement.

## Architecture

GitHub is the deployment source of truth. A push to the repository's current deployment branch, `master`, triggers a GitHub Actions workflow. The workflow installs dependencies with `npm ci`, builds the static files with `npm run build`, and synchronizes the contents of `dist/` to the configured web root on the server.

BaoTa/Nginx serves the deployed files from a site directory such as `/www/wwwroot/example.com`, replacing `example.com` with the actual bound domain. For this React single-page app, the Nginx site should include a fallback rule equivalent to `try_files $uri $uri/ /index.html;` so browser refreshes on client-side routes do not return 404.

## Configuration

The workflow should use GitHub Secrets rather than hard-coded credentials:

- `SSH_HOST`: `60.204.199.250`
- `SSH_PORT`: usually `22`, unless the server uses a custom SSH port
- `SSH_USER`: a server user with write access to the deploy directory
- `SSH_KEY`: the private key for that user
- `DEPLOY_PATH`: the BaoTa/Nginx web root, for example `/www/wwwroot/example.com`, with `example.com` replaced by the actual bound domain

The private key must not be committed to the repository. The matching public key should be added to the server user's `~/.ssh/authorized_keys`.

## Data Flow

1. Developer pushes to `master` on GitHub.
2. GitHub Actions checks out the repository.
3. GitHub Actions installs dependencies using `npm ci`.
4. GitHub Actions builds the site using `npm run build`.
5. The generated `dist/` contents are uploaded to `DEPLOY_PATH` on the server.
6. Nginx serves the new files for the configured domain.

## Error Handling

Build or upload failures should fail the GitHub Actions run. The existing live site should remain available if a build fails before upload. If an upload fails midway, rerunning the workflow should resynchronize the target directory.

The first setup should verify SSH access, deploy directory permissions, and Nginx site configuration before relying on automatic deployments.

## Security

The deployment key should be limited to this server and user. The server user should have write access only to the intended deployment directory where practical. Password-based SSH can remain disabled if key-based login is working.

GitHub Secrets should store all connection details and private key material. No secret values should be printed in workflow logs or committed to the repository.

## Testing And Verification

Local verification should run `npm run build` before adding the workflow. After deployment setup, verification should include:

- Triggering the workflow from a push or manual dispatch.
- Confirming the workflow succeeds in GitHub Actions.
- Visiting the configured domain and confirming the latest UI is served.
- Refreshing a nested route if client-side routes are added later, confirming Nginx fallback behavior.

## Scope

This design covers static site deployment and automatic updates from GitHub to the existing Huawei Cloud server. It does not add Docker, backend services, databases, CDN configuration, or server monitoring.

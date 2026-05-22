# Server Auto Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions based deployment path that builds this Vite React static site and syncs `dist/` to the Huawei Cloud server on every push to `master`.

**Architecture:** GitHub Actions is responsible for installing dependencies, running tests, building the static site, and uploading build output over SSH. The Huawei Cloud server only serves static files through BaoTa/Nginx from the configured web root.

**Tech Stack:** Vite, React, TypeScript, npm, Vitest, GitHub Actions, SSH, rsync/scp-style deployment, BaoTa/Nginx.

---

## File Structure

- Create: `.github/workflows/deploy.yml` - CI/CD workflow triggered on pushes to `master` and manual dispatches.
- Modify: no application source files are required for deployment.
- External setup: Huawei Cloud/BaoTa server SSH key, BaoTa static site web root, GitHub repository Secrets.

## Task 1: Add GitHub Actions Deployment Workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/deploy.yml` with this exact content:

```yaml
name: Deploy Static Site

on:
  push:
    branches:
      - master
  workflow_dispatch:

concurrency:
  group: deploy-static-site
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build site
        run: npm run build

      - name: Prepare SSH key
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -p "${{ secrets.SSH_PORT }}" -H "${{ secrets.SSH_HOST }}" >> ~/.ssh/known_hosts

      - name: Ensure deploy directory exists
        run: |
          ssh -i ~/.ssh/deploy_key -p "${{ secrets.SSH_PORT }}" "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}" \
            "mkdir -p '${{ secrets.DEPLOY_PATH }}'"

      - name: Sync built files
        run: |
          rsync -az --delete \
            -e "ssh -i ~/.ssh/deploy_key -p ${{ secrets.SSH_PORT }}" \
            dist/ \
            "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.DEPLOY_PATH }}/"
```

- [ ] **Step 2: Verify YAML syntax by running a local build**

Run:

```bash
npm run build
```

Expected: command exits with code 0 and Vite writes production files to `dist/`.

- [ ] **Step 3: Commit the workflow**

Run:

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add static site deployment workflow"
```

Expected: a commit containing only `.github/workflows/deploy.yml`.

## Task 2: Configure Server Deployment Target

**Files:**
- No repository files changed.
- External: Huawei Cloud server and BaoTa/Nginx configuration.

- [ ] **Step 1: Choose the deployment path**

Use the BaoTa website root for the bound domain. The path should look like this:

```text
/www/wwwroot/example.com
```

Replace `example.com` with the actual domain already resolved to `60.204.199.250`. This final value becomes the GitHub Secret named `DEPLOY_PATH`.

- [ ] **Step 2: Confirm the BaoTa site exists**

In BaoTa, create or confirm a static website bound to the actual domain. Set the website root to the selected deployment path.

Expected: visiting the domain reaches the BaoTa/Nginx site instead of a connection error.

- [ ] **Step 3: Add single-page app fallback in Nginx**

In the BaoTa site Nginx config, ensure the main `location /` block contains this rule:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Expected: Nginx reloads successfully in BaoTa after saving the config.

## Task 3: Configure SSH Deployment Credentials

**Files:**
- No repository files changed.
- External: server SSH account and GitHub repository Secrets.

- [ ] **Step 1: Generate or choose a deploy SSH key**

On the local machine, generate a dedicated key if one does not already exist:

```bash
ssh-keygen -t ed25519 -C "github-actions-count-deploy" -f "$HOME/.ssh/count_deploy"
```

Expected: two files are created locally, `count_deploy` and `count_deploy.pub`.

- [ ] **Step 2: Install the public key on the server**

Add the contents of `count_deploy.pub` to this server file for the deploy user:

```text
~/.ssh/authorized_keys
```

Expected: the deploy user can log in with the private key and does not need a password for deployment.

- [ ] **Step 3: Verify SSH login from local machine**

Run with the real user and SSH port:

```bash
ssh -i "$HOME/.ssh/count_deploy" -p 22 user@60.204.199.250 "pwd && whoami"
```

Expected: command prints the deploy user's home path and username.

- [ ] **Step 4: Verify write access to deployment path**

Run with the real user, SSH port, and deploy path:

```bash
ssh -i "$HOME/.ssh/count_deploy" -p 22 user@60.204.199.250 "mkdir -p /www/wwwroot/example.com && test -w /www/wwwroot/example.com"
```

Expected: command exits with code 0. Replace `/www/wwwroot/example.com` with the actual `DEPLOY_PATH`.

- [ ] **Step 5: Add GitHub repository Secrets**

In GitHub repository settings, add these Actions secrets:

```text
SSH_HOST=60.204.199.250
SSH_PORT=22
SSH_USER=user
SSH_KEY=<contents of local private key file count_deploy>
DEPLOY_PATH=/www/wwwroot/example.com
```

Expected: all five secrets exist under repository Actions secrets. Replace `user` and `/www/wwwroot/example.com` with the real values.

## Task 4: Verify End-To-End Deployment

**Files:**
- No repository files changed unless a test commit is needed to trigger deployment.

- [ ] **Step 1: Trigger the workflow manually**

In GitHub Actions, open `Deploy Static Site` and run `workflow_dispatch` on `master`.

Expected: the workflow starts and reaches the deploy job.

- [ ] **Step 2: Confirm the workflow succeeds**

Expected completed steps:

```text
Checkout repository
Setup Node.js
Install dependencies
Run tests
Build site
Prepare SSH key
Ensure deploy directory exists
Sync built files
```

- [ ] **Step 3: Confirm files exist on the server**

Run with real values:

```bash
ssh -i "$HOME/.ssh/count_deploy" -p 22 user@60.204.199.250 "ls -la /www/wwwroot/example.com | head"
```

Expected: output includes `index.html` and an `assets` directory.

- [ ] **Step 4: Confirm the live domain serves the app**

Open the actual domain in a browser.

Expected: the S2 capture counter app loads from the server.

- [ ] **Step 5: Confirm future auto-update behavior**

Make a normal application change in a later task or commit, push it to `master`, and watch GitHub Actions.

Expected: the `Deploy Static Site` workflow runs automatically after the push and updates the server without manual upload.

## Self-Review

- Spec coverage: The plan creates a GitHub Actions workflow, uses GitHub Secrets, builds with `npm ci` and `npm run build`, syncs `dist/` to the Huawei Cloud server, and documents BaoTa/Nginx static hosting plus SPA fallback.
- Placeholder scan: Example values are explicitly marked for replacement with real domain, user, and deploy path values; no unresolved implementation placeholders remain.
- Type and command consistency: The workflow uses the same secret names listed in the server/GitHub setup steps: `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_KEY`, and `DEPLOY_PATH`.

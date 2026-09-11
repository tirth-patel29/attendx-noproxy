# Private GitNexus on EC2

This stack keeps AttendX's code graph on the EC2 host and exposes it only on
the host loopback interface. It is deliberately not routed through the public
reverse proxy: the graph reveals source-code structure and relationships.

## Deploy on EC2

1. Create a dedicated checkout of this repository at the path configured as
   `ATTENDX_REPO_PATH`. Keep it updated with Git; do not mount the running
   application source if you can avoid it.
2. Copy `.env.example` to `.env`, set the checkout path, and generate a random
   `GITNEXUS_MCP_AUTH_TOKEN` on the server.
3. From this directory, start the service:

   ```bash
   docker compose up -d
   docker compose exec gitnexus gitnexus analyze /workspace/attendx
   ```

4. Re-run the final command after pulling project changes. GitNexus will also
   report when an index is stale.

## Private access from a developer machine

Create a local tunnel and leave it running:

```bash
ssh -N -L 4747:127.0.0.1:4747 <ec2-user>@<ec2-host>
```

The remote MCP endpoint is then available locally at:

```text
http://127.0.0.1:4747/api/mcp
```

Supply the bearer token from the EC2 `.env` when configuring an MCP client.
The service is read-only by design, so agents can inspect architecture and
impact but cannot issue graph-driven rename or raw-Cypher mutation actions.

## Local editor setup

For the fastest local setup, run this in a checkout of AttendX:

```bash
npx gitnexus@latest analyze
npx gitnexus@latest setup
```

This registers GitNexus with supported coding clients, including Codex, Cursor,
and Claude Code. Use local indexing when an agent is working against unpushed
changes; the EC2 index only knows the version checked out on EC2.

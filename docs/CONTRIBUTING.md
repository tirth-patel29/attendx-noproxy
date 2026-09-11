# CONTRIBUTING — Zero-Trust Cryptographic Attendance Gateway

> **Read this before opening a PR.** Our repo is small; the rules are simple.

---

## BRANCH STRATEGY

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | **Production-ready** — only via PR, must pass CI | Required reviews: 1, status checks |
| `develop` | Integration branch — optional, for parallel features | Same as main if used |
| `feat/<short-name>` | Feature branches — one per task | Delete after merge |
| `fix/<short-name>` | Bug fixes | Delete after merge |
| `docs/<short-name>` | Documentation only | Delete after merge |

**Naming:** `feat/backend-metronome`, `fix/auth-token-expiry`, `docs/api-spec`

---

## COMMIT MESSAGE FORMAT

```
<type>(<scope>): <imperative subject>

<body — what & why, not how>

Refs: #<issue-number>
```

| Type | When |
|------|------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change, no behavior change |
| `test` | Adding/modifying tests |
| `chore` | Build, deps, config, scripts |
| `perf` | Performance improvement |
| `security` | Security fix |

**Examples:**
```
feat(backend): add 3s metronome token mint via Socket.io

Refs: #2.3

fix(db): set passwords for supabase internal roles

Resolves auth/storage startup failures.
Refs: #1.2
```

---

## PULL REQUEST PROCESS

1. **Create issue first** — Every PR links to an issue (`Refs: #123`)
2. **Branch from `main`** — `git checkout -b feat/your-feature main`
3. **Small, focused PRs** — One logical change per PR
4. **Self-review before requesting** — Run linter, tests, verify locally
5. **PR Description must include:**
   - What changed (bullet list)
   - Why (link to issue/task)
   - How tested (commands, screenshots)
   - Homelab impact (RAM, power-cut, backup) — **required for infra/DB changes**
6. **Reviewers:** At least 1 team member + AI assistant
7. **Merge:** Squash & merge (keeps history clean)

---

## HOMELAB IMPACT STATEMENT (Required for infra/DB/backend PRs)

Every PR touching deployment, database, or backend **must** answer:

```markdown
## Homelab Impact

- **RAM delta:** +X MB / -Y MB (container limits)
- **Power-cut behavior:** [No change / Improves / Degrades — explain]
- **Backup impact:** [No change / New data to back up / Schema migration needed]
- **Rollback plan:** [Revert commit / Restore backup / Manual steps]
```

**Example:**
```markdown
## Homelab Impact

- **RAM delta:** +128MB (new backend container, limit 256MB)
- **Power-cut behavior:** Improves — adds health check for faster restart
- **Backup impact:** No change — stateless container
- **Rollback plan:** `docker compose -p attendance down && git revert <sha>`
```

PRs without this section will be **requested changes** until added.

---

## CODE STANDARDS

### Backend (Node/TypeScript)
- **ESLint + Prettier** (config in repo) — `npm run lint` must pass
- **Strict TypeScript** — `noImplicitAny: true`, no `any` without justification
- **Tests:** Unit tests for all judge logic (`npm test` >80% coverage)
- **Async/await** — no bare promises, proper error handling

### Database (SQL Migrations)
- **One migration file per logical change** — `migrations/NNN_description.sql`
- **Up + Down** — Every migration must be reversible
- **Naming:** `001_initial_schema.sql`, `002_add_professor_index.sql`
- **Test on local Supabase first** — before applying to homelab

### Flutter (Dart)
- **`flutter analyze` clean** — no warnings
- **`flutter test` passes** — widget + unit tests
- **Format:** `dart format .` before commit
- **Null safety** — no `!` without justification

### General
- **No secrets in code** — Use env vars, `.env.example` for template
- **No commented-out code** — Delete it, git has history
- **Line length:** 100 chars (markdown), 120 (code)
- **Document public APIs** — JSDoc / DartDoc for exported functions

---

## TESTING REQUIREMENTS

| Layer | Requirement |
|-------|-------------|
| Backend judge | All 6 SRS attack vectors covered (unit tests) |
| Metronome | Token mint every 3s ±50ms, persists to DB |
| API endpoints | Integration test with test DB |
| Flutter gates | Each gate has widget test + device test |
| Power-cut | Documented drill in CI (manual for now) |

Run locally before PR:
```bash
# Backend
cd backend && npm run lint && npm test

# Flutter
cd app && flutter analyze && flutter test

# DB migration test
docker exec supabase-db psql -U supabase_admin -d postgres -f migrations/NNN_new.sql
```

---

## RELEASE PROCESS

1. **Tag on `main`** — `git tag -a v1.0.0 -m "Demo release"`
2. **Changelog** — Auto-generated from commit messages (conventional commits)
3. **Deploy to homelab** — Via Portainer stack update
4. **Verify health** — All 7 Supabase services + backend + teacher
5. **Rollback tag** — Keep previous tag for quick revert

---

## GETTING HELP

- **Blocked?** Open issue with `help wanted` label
- **Architecture question?** Tag AI assistant in issue
- **Urgent (production down)?** Call/Telegram team lead

---

## CODE OF CONDUCT

- Be respectful, constructive, specific
- Critique code, not people
- Assume good intent
- Pair program when stuck >30 min

---

*This file lives at `docs/CONTRIBUTING.md` in the repo. Update it as we learn.*
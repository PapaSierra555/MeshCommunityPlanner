# Contributing to Mesh Community Planner

Thank you for your interest in contributing! This document explains how to report bugs, request features, and submit code changes.

---

## Reporting Bugs

1. Search [existing issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include:
   - Operating system and version
   - Browser and version
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots if applicable

## Requesting Features

1. Search [existing issues](https://github.com/PapaSierra555/MeshCommunityPlanner/issues) to check if it has been suggested
2. Open a new issue using the **Feature Request** template
3. Describe the use case and why the feature would be valuable

## Security Vulnerabilities

Do **not** report security issues in public GitHub issues. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.

---

## Development Setup

### Prerequisites

- Python 3.12 or 3.13 (3.14+ not supported — `pydantic-core` requires PyO3 which lags latest CPython)
- Node.js 18+ with npm
- Git

### Getting Started

```bash
# Clone the repository
git clone https://github.com/PapaSierra555/MeshCommunityPlanner.git
cd MeshCommunityPlanner

# Create and activate a virtual environment (recommended)
python -m venv venv
source venv/bin/activate   # macOS / Linux
# venv\Scripts\activate    # Windows

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### Running in Development

Run both commands from the **repo root** (not from a subdirectory):

**Terminal 1 (Backend):**
```bash
python -m backend.app.main
```

The backend starts on `http://127.0.0.1:8321` and opens a browser tab automatically in production mode. In dev mode, use Terminal 2.

**Terminal 2 (Frontend):**
```bash
cd frontend && npm run dev
```

Open `http://localhost:5173` in your browser. The Vite dev server proxies all `/api` requests to the backend on port 8321.

### Running Tests

```bash
# Backend tests (from repo root)
cd backend && python -m pytest

# Frontend tests
cd frontend && npx vitest run
```

All 383 frontend and 173 backend tests should pass on a clean install.

---

## Troubleshooting

### All POST/PUT endpoints return 405 Method Not Allowed

**Symptom:** Creating plans, adding nodes, or any write operation fails with HTTP 405. The backend startup log contains:

```
WARNING  W2 routers not available — running without REST API endpoints
ERROR    Import error details: No module named 'msgpack'
```

**Cause:** A missing Python dependency (`msgpack`) causes the entire REST API router registration to fail silently on startup. This has been observed on fresh Arch Linux installs where `msgpack` is not pre-installed system-wide.

**Fix:**
```bash
pip install -r requirements.txt
```

Then restart the backend. Verify `msgpack==1.1.0` is installed: `python -c "import msgpack; print(msgpack.__version__)"`.

### Frontend test failures on Linux (mapStore, ElevationLegend, CoverageSettings)

**Symptom:** 49 frontend tests fail on Linux (Arch or similar) — specifically `tests/stores/mapStore.test.ts` (4 tests), `tests/components/ElevationLegend.test.tsx` (33 tests), and `tests/components/CoverageSettings.test.tsx` (12 tests). All other tests pass.

**Cause:** Known environment-specific behavior with jsdom 28 and Vitest 4 on certain Linux distributions. These tests pass on Windows and macOS. Investigation ongoing — does not block development of new features.

---

## Submitting Changes

1. **Fork** the repository
2. **Create a branch** from `main` with a descriptive name (e.g., `fix-csv-import-error` or `add-frequency-filter`)
3. **Make your changes** — keep commits focused and well-described
4. **Test your changes** — ensure existing tests pass and add tests for new functionality
5. **Open a Pull Request** against `main` with:
   - Clear description of what changed and why
   - Reference to any related issues
   - Screenshots for UI changes

### Code Style

- **Python:** Follow PEP 8. Backend lint/type tooling is not configured yet; run the relevant pytest suite and review changes carefully.
- **TypeScript:** Follow the existing ESLint configuration. Run `npm run lint`.
- **Commits:** Write clear, concise commit messages describing the change.

### What Makes a Good PR

- Solves one problem or adds one feature
- Includes tests for new or changed behavior
- Does not break existing functionality
- Has a clear description

---

## Code of Conduct

All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md). Be respectful, constructive, and welcoming.

---

## License

By contributing, you agree that your contributions will be licensed under the same [CC BY-NC-SA 4.0](LICENSE) license as the project.

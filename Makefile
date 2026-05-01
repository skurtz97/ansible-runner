# Ansible Runner — release Makefile
#
# Requires:
#   - node + npm
#   - git (with push access to origin)
#   - gh CLI, authenticated (`gh auth login`)
#
# Typical flows:
#   make release-current   # release whatever version is in package.json (use for first release)
#   make release-patch     # 0.1.0 -> 0.1.1, tag, push, build, publish
#   make release-minor     # 0.1.0 -> 0.2.0, ...
#   make release-major     # 0.1.0 -> 1.0.0, ...
#
# Each release-* target:
#   1. Verifies working tree is clean and gh is ready
#   2. (release-patch/minor/major) bumps version via `npm version`, which also commits + tags
#   3. Builds the .vsix with `vsce package`
#   4. Pushes the commit and tag to origin
#   5. Creates a GitHub Release with auto-generated notes and the .vsix attached

SHELL := /bin/bash

# Re-evaluated every make invocation, so post-bump sub-makes pick up the new version.
VERSION := $(shell node -p "require('./package.json').version" 2>/dev/null)
NAME    := $(shell node -p "require('./package.json').name" 2>/dev/null)
VSIX    := $(NAME)-$(VERSION).vsix
TAG     := v$(VERSION)
BRANCH  := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null)

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show available targets
	@echo "Ansible Runner — release targets"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Current: $(NAME) $(VERSION)  (would tag $(TAG) on branch $(BRANCH))"

.PHONY: install
install: ## npm install
	npm install

.PHONY: compile
compile: ## tsc compile to out/
	npm run compile

.PHONY: package
package: compile ## Build the .vsix for the current version
	npx vsce package
	@echo "Built $(VSIX)"

.PHONY: clean
clean: ## Remove build artifacts (out/ and *.vsix)
	rm -rf out
	rm -f *.vsix

# ---------- guards ----------

.PHONY: check-clean-tree
check-clean-tree:
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "ERROR: working tree is dirty. Commit or stash first."; \
		git status --short; \
		exit 1; \
	fi

.PHONY: check-gh
check-gh:
	@command -v gh >/dev/null 2>&1 || { \
		echo "ERROR: gh CLI not installed. https://cli.github.com/"; exit 1; }
	@gh auth status >/dev/null 2>&1 || { \
		echo "ERROR: gh CLI not authenticated. Run: gh auth login"; exit 1; }

# ---------- release internals ----------

# Tag (if missing), build, push, publish the release for the CURRENT package.json version.
# Called by both release-current (no bump) and release-{patch,minor,major} (after npm version).
.PHONY: _publish
_publish: check-gh package
	@if ! git rev-parse $(TAG) >/dev/null 2>&1; then \
		echo "Creating tag $(TAG)..."; \
		git tag -a $(TAG) -m "Release $(TAG)"; \
	else \
		echo "Tag $(TAG) already exists locally, reusing."; \
	fi
	@echo "Pushing $(BRANCH) and $(TAG) to origin..."
	git push origin $(BRANCH)
	git push origin $(TAG)
	@echo "Publishing GitHub release $(TAG)..."
	gh release create $(TAG) $(VSIX) \
		--title "$(TAG)" \
		--generate-notes
	@echo ""
	@echo "Done. Released $(TAG) with $(VSIX)."

# ---------- public release targets ----------

.PHONY: release-current
release-current: check-clean-tree _publish ## Release current package.json version (no bump). Use for first release.

# Sub-make for _publish so VERSION/VSIX/TAG re-read after `npm version` rewrites package.json.
.PHONY: release-patch
release-patch: check-clean-tree check-gh ## Bump patch (0.1.0 -> 0.1.1) and release
	npm version patch -m "Release v%s"
	@$(MAKE) --no-print-directory _publish

.PHONY: release-minor
release-minor: check-clean-tree check-gh ## Bump minor (0.1.0 -> 0.2.0) and release
	npm version minor -m "Release v%s"
	@$(MAKE) --no-print-directory _publish

.PHONY: release-major
release-major: check-clean-tree check-gh ## Bump major (0.1.0 -> 1.0.0) and release
	npm version major -m "Release v%s"
	@$(MAKE) --no-print-directory _publish

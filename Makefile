# Morpheus static-site build.
#
# Build pipeline:
#   1. web/build.ts bundles the TypeScript web components into ./min/bundle.js
#      and minifies internal/site/static/*.css into ./min/*.css (both via
#      esbuild). /min/ is the tracked deliverable directory — checked in so
#      downstream users can vendor straight from GitHub.
#   2. templ generate refreshes internal/site/*_templ.go from .templ.
#   3. internal/cmd/gen renders every page as static HTML into ./dst, copies
#      internal/site/static/* alongside (skipping the unminified CSS sources),
#      overlays ./min/ onto dst/static/min/, minifies sim/*.js demo snippets
#      for dst, and emits minified datasim.js for page-local browser
#      simulator scripts.
#
# The `watch` target runs templier (github.com/romshark/templier),
# which proxies internal/cmd/fileserve and drives the same pipeline as custom
# watchers — see templier.yml for the wiring.

DST := dst
TEMPL_VERSION := v0.3.1020

.PHONY: all gen templ bundle bundle-size js-install clean watch check-pnpm

all: gen

# Fail fast with an actionable message when pnpm isn't on PATH. Mirrors
# the templier check on `watch`; phony so it never short-circuits.
check-pnpm:
	@command -v pnpm >/dev/null || { \
		echo "pnpm not found — install it first (https://pnpm.io/)"; \
		exit 1; \
	}

# Prereqs (idempotent — keeps `make` self-bootstrapping for fresh checkouts).
js-install: check-pnpm
	cd web && pnpm install

# Bundle TypeScript and minify CSS via esbuild (build.ts default = both).
bundle: check-pnpm
	cd web && pnpm run build

# Report raw/gzip/brotli sizes of the shippable kit deliverables in ./min/:
# the kit JS bundle, the base CSS, and the default theme. Site-only bundles
# (landing, bundle-builder, docs UI) are excluded.
bundle-size: js-install bundle
	@files="min/bundle.js min/morpheus.css min/theme-default.css"; \
	have_br=0; command -v brotli >/dev/null && have_br=1; \
	printf '%-22s %12s %12s %12s\n' "file" "raw" "gzip" "brotli"; \
	printf '%-22s %12s %12s %12s\n' "----------------------" "------------" "------------" "------------"; \
	raw_total=0; gz_total=0; br_total=0; \
	for f in $$files; do \
	raw=$$(wc -c < "$$f" | tr -d ' '); \
	gz=$$(gzip -9c "$$f" | wc -c | tr -d ' '); \
	if [ $$have_br -eq 1 ]; then br=$$(brotli -q 11 -c "$$f" | wc -c | tr -d ' '); br_total=$$((br_total + br)); else br="n/a"; fi; \
	raw_total=$$((raw_total + raw)); gz_total=$$((gz_total + gz)); \
	printf '%-22s %12s %12s %12s\n' "$$f" "$$raw" "$$gz" "$$br"; \
	done; \
	printf '%-22s %12s %12s %12s\n' "----------------------" "------------" "------------" "------------"; \
	if [ $$have_br -eq 1 ]; then br_show=$$br_total; else br_show="n/a"; fi; \
	printf '%-22s %12s %12s %12s\n' "total" "$$raw_total" "$$gz_total" "$$br_show"

# Regenerate internal/site/*_templ.go from internal/site/*.templ.
templ:
	go run github.com/a-h/templ/cmd/templ@$(TEMPL_VERSION) generate

# Render the static site into ./dst. Set BASE to host under a subpath,
# e.g. `make gen BASE=/morpheus` for https://romshark.github.io/morpheus/;
# empty (the default) serves at the document root.
gen: js-install bundle templ
	go run ./internal/cmd/gen -dst $(DST) $(if $(BASE),-base $(BASE),)

clean:
	rm -rf $(DST) min

# Build once, then hand off to templier for incremental rebuilds and
# browser live-reload. templier serves through internal/cmd/fileserve (which
# serves ./dst on disk) and runs the lint/bundle/minify/render
# watchers configured in templier.yml.
watch: gen
	@command -v templier >/dev/null || { \
		echo "templier not found — install it first"; \
		exit 1; \
	}
	templier

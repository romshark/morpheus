package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

const changelog = `# Changelog

Intro.

## [Unreleased]

## [0.3.0] - 2026-11-02

### Added

- Newer entry.

## [0.2.0] - 2026-10-26

### Fixed

- Older entry.

[Unreleased]: https://github.com/romshark/morpheus/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/romshark/morpheus/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/romshark/morpheus/compare/v0.1.0...v0.2.0
`

func TestSection(t *testing.T) {
	for name, tc := range map[string]struct {
		version string
		want    string
		ok      bool
	}{
		"ends at next heading": {
			version: "0.3.0",
			want:    "### Added\n\n- Newer entry.\n",
			ok:      true,
		},
		"ends at link definition": {
			version: "0.2.0",
			want:    "### Fixed\n\n- Older entry.\n",
			ok:      true,
		},
		"missing":             {version: "0.1.0"},
		"prefix of a version": {version: "0.3"},
		"empty":               {version: "Unreleased"},
	} {
		t.Run(name, func(t *testing.T) {
			got, ok := section(changelog, tc.version)
			if ok != tc.ok || got != tc.want {
				t.Fatalf("section(%q) = %q, %v; want %q, %v",
					tc.version, got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestLink(t *testing.T) {
	for name, tc := range map[string]struct {
		version string
		want    string
		ok      bool
	}{
		"latest": {
			version: "0.3.0",
			want:    "https://github.com/romshark/morpheus/compare/v0.2.0...v0.3.0",
			ok:      true,
		},
		"older": {
			version: "0.2.0",
			want:    "https://github.com/romshark/morpheus/compare/v0.1.0...v0.2.0",
			ok:      true,
		},
		"missing":             {version: "0.1.0"},
		"prefix of a version": {version: "0.3"},
	} {
		t.Run(name, func(t *testing.T) {
			got, ok := link(changelog, tc.version)
			if ok != tc.ok || got != tc.want {
				t.Fatalf("link(%q) = %q, %v; want %q, %v",
					tc.version, got, ok, tc.want, tc.ok)
			}
		})
	}
}

// TestChangelogReleases tests that every released version
// has a valid heading, non-empty notes and a link definition.
func TestChangelogReleases(t *testing.T) {
	b, err := os.ReadFile(filepath.Join("..", "..", "..", "CHANGELOG.md"))
	if err != nil {
		t.Fatal(err)
	}

	semver := regexp.MustCompile(`^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$`)
	for line := range strings.Lines(string(b)) {
		rest, ok := strings.CutPrefix(line, "## [")
		if !ok {
			continue
		}
		version, _, ok := strings.Cut(rest, "]")
		if !ok {
			t.Fatalf("unterminated heading %q", line)
		}
		if version == "Unreleased" {
			continue
		}
		if !semver.MatchString(version) {
			t.Errorf("heading %q: %q is not a semantic version",
				strings.TrimSpace(line), version)
			continue
		}
		if _, ok := section(string(b), version); !ok {
			t.Errorf("the section of %s has no notes", version)
		}
		if _, ok := link(string(b), version); !ok {
			t.Errorf("%s has no link definition", version)
		}
	}
}

package main

import (
	"archive/tar"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strings"
	"testing/fstest"

	"github.com/romshark/morpheus/internal/bundle"
)

// The bundle builder page builds a release tag, or the working tree as
// "main", from the [bundle.Version] files in static/bundle/<version>/.

// bundleVersion is a tree the bundle builder can build, ready for
// [writeBundleVersion].
type bundleVersion struct {
	name string
	bundle.Version
}

// prepareBundleVersions prepares the release tags, then the working tree
// as "main". The newest release without a pre-release suffix comes first,
// as the default, then the other tags newest first.
// A tag the current graph cannot build is skipped with a warning.
// main's banner gets the git describe name because VERSION names the last release.
func prepareBundleVersions(release string) ([]bundleVersion, error) {
	var versions []bundleVersion
	for _, tag := range releaseTags() {
		tree, err := treeAt(tag)
		var v bundle.Version
		if err == nil {
			v, err = bundle.Prepare(tree)
		}
		if err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "bundle builder: skipping %s: %v\n", tag, err)
			continue
		}
		versions = append(versions, bundleVersion{name: tag, Version: v})
	}
	// Only a "-" suffix marks a pre-release, which lets a v0 release be the default.
	// release.yml also marks v0.* as GitHub pre-releases.
	if i := slices.IndexFunc(versions, func(v bundleVersion) bool {
		return !strings.Contains(v.name, "-")
	}); i > 0 {
		v := versions[i]
		versions = slices.Insert(slices.Delete(versions, i, i+1), 0, v)
	}
	main, err := bundle.Prepare(os.DirFS("."))
	if err != nil {
		return nil, err
	}
	if d := gitOutput("describe", "--tags", "--dirty"); d != "" {
		main.Manifest.Banner = strings.Replace(main.Manifest.Banner,
			" "+release+" ", " "+d+" ", 1)
	}
	return append(versions, bundleVersion{name: "main", Version: main}), nil
}

// writeBundleVersion writes v to dir, which is static/bundle/<version>/.
func writeBundleVersion(dir string, v bundleVersion) error {
	for name, b := range v.Files {
		dst := filepath.Join(dir, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(dst, b, 0o644); err != nil {
			return err
		}
	}
	data, err := json.Marshal(v.Manifest)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dir, "bundle-manifest.json"), data, 0o644)
}

// releaseTags lists the v* tags, newest first, or nil without git.
// A release sorts above its pre-releases, as v1.0.0 above v1.0.0-rc1.
func releaseTags() []string {
	return strings.Fields(gitOutput(
		"-c", "versionsort.suffix=-", "tag", "--list", "v*", "--sort=-v:refname",
	))
}

func gitOutput(args ...string) string {
	out, err := exec.Command("git", args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

// treeAt returns [bundle.TreePaths] at tag.
func treeAt(tag string) (fs.FS, error) {
	cmd := exec.Command("git",
		append([]string{"archive", "--format=tar", tag, "--"}, bundle.TreePaths...)...,
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git archive: %v: %s",
			err, strings.TrimSpace(stderr.String()))
	}
	tree := fstest.MapFS{}
	r := tar.NewReader(bytes.NewReader(out))
	for {
		h, err := r.Next()
		if errors.Is(err, io.EOF) {
			return tree, nil
		}
		if err != nil {
			return nil, err
		}
		if h.Typeflag != tar.TypeReg {
			continue
		}
		b, err := io.ReadAll(r)
		if err != nil {
			return nil, err
		}
		tree[h.Name] = &fstest.MapFile{Data: b}
	}
}

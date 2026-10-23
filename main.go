// Command morpheus builds a bundle of only the Morpheus components a page uses.
// It writes the files the bundle builder page at
// https://romshark.github.io/morpheus/bundle-builder/ builds.
// Run "morpheus -h" for usage.
package main

import (
	"bytes"
	"compress/gzip"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"

	"github.com/andybalholm/brotli"

	"github.com/romshark/morpheus/internal/bundle"
)

// tree holds [bundle.TreePaths] at the version the command is built from.
// The all: prefix embeds web/lib's _*.css, which //go:embed skips by default.
//
//go:embed all:web/lib web/package.json min/bundle.js internal/site/static/morpheus.css
var tree embed.FS

//go:embed VERSION
var versionFile string

const usageText = `Morpheus %s builds a bundle of only the components a page uses.

Usage:

	morpheus bundle -components <names> [-o <dir>] [-unminified] [-json]
	morpheus components [-json]

Commands:

	bundle      write morpheus.min.js and morpheus.min.css with the named
	            components and the components they require
	components  list the names bundle takes, with the components each
	            requires and the sub-components each includes

Run "morpheus <command> -h" for the flags of a command.
The bundle builder page builds the same files:
https://romshark.github.io/morpheus/bundle-builder/
`

const bundleUsage = `Usage: morpheus bundle -components <names> [-o <dir>] [-unminified] [-json]

Bundle writes morpheus.min.js and morpheus.min.css to the -o directory with
the named components and the components they require. The files replace
bundle.js and morpheus.css. A name is one "morpheus components" lists,
with or without "neo-".

Example:

	morpheus bundle -components select,dialog -o static/morpheus

Flags:

`

const componentsUsage = `Usage: morpheus components [-json]

Components lists the names bundle takes. Each comes with the components
bundle adds for it and the sub-components it includes, such as option
with select.

Flags:

`

// Exit statuses besides 0.
const (
	exitFail  = 1
	exitUsage = 2
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

// run runs the command line args and returns the exit status.
func run(args []string, stdout, stderr io.Writer) int {
	if len(args) > 0 {
		switch args[0] {
		case "bundle":
			return runBundle(args[1:], stdout, stderr)
		case "components":
			return runComponents(args[1:], stdout, stderr)
		case "help", "-h", "-help", "--help":
			return write(stdout, stderr, fmt.Appendf(nil, usageText, version()))
		}
		_, _ = fmt.Fprintf(stderr, "morpheus: unknown command %q\n\n", args[0])
	}
	_, _ = fmt.Fprintf(stderr, usageText, version())
	return exitUsage
}

// bundleResult is the output of bundle -json.
type bundleResult struct {
	Version string `json:"version"`
	// Components are the named components and the ones they require.
	Components []string `json:"components"`
	// Added are the required components bundle adds to the named ones.
	Added []string     `json:"added"`
	Files []fileResult `json:"files"`
}

// fileResult is a written file with its sizes in bytes,
// compressed as the bundle builder page measures them.
type fileResult struct {
	Path   string `json:"path"`
	Size   int    `json:"size"`
	Gzip   int    `json:"gzip"`
	Brotli int    `json:"brotli"`
}

func runBundle(args []string, stdout, stderr io.Writer) int {
	fl := flag.NewFlagSet("bundle", flag.ContinueOnError)
	fl.SetOutput(stderr)
	fl.Usage = func() {
		_, _ = io.WriteString(stderr, bundleUsage)
		fl.PrintDefaults()
	}
	var names listFlag
	fl.Var(&names, "components",
		"comma-separated component `names`, such as select,dialog; repeatable")
	dir := fl.String("o", ".", "output `directory`")
	unminified := fl.Bool("unminified", false, "also write morpheus.js and morpheus.css")
	asJSON := fl.Bool("json", false, "print the result as JSON")
	if status, ok := parse(fl, args); !ok {
		return status
	}

	v, err := bundle.Prepare(tree)
	if err != nil {
		return fail(stderr, exitFail, "bundle: %v", err)
	}
	sel := bundle.Select(names, v.Absent)
	switch {
	case len(sel.Unknown) > 0:
		var all []string
		for _, c := range components(v) {
			all = append(all, c.Name)
		}
		return fail(stderr, exitUsage, "bundle: unknown component: %s\nComponents: %s",
			strings.Join(sel.Unknown, ", "), strings.Join(all, ", "))
	case len(sel.Missing) > 0:
		return fail(stderr, exitUsage, "bundle: not in %s: %s",
			version(), strings.Join(sel.Missing, ", "))
	case len(sel.Named) == 0:
		return fail(stderr, exitUsage,
			"bundle: no components: name them with -components, such as -components select,dialog")
	}

	type file struct {
		name string
		data []byte
	}
	js, css, err := bundle.Build(v, sel.IDs, true)
	if err != nil {
		return fail(stderr, exitFail, "bundle: %v", err)
	}
	files := []file{{"morpheus.min.js", js}, {"morpheus.min.css", css}}
	if *unminified {
		js, css, err := bundle.Build(v, sel.IDs, false)
		if err != nil {
			return fail(stderr, exitFail, "bundle: %v", err)
		}
		files = append(files, file{"morpheus.js", js}, file{"morpheus.css", css})
	}
	if err := os.MkdirAll(*dir, 0o755); err != nil {
		return fail(stderr, exitFail, "bundle: %v", err)
	}
	res := bundleResult{
		Version:    version(),
		Components: []string{},
		Added:      []string{},
		Files:      make([]fileResult, len(files)),
	}
	for i, f := range files {
		p := filepath.Join(*dir, f.name)
		if err := os.WriteFile(p, f.data, 0o644); err != nil {
			return fail(stderr, exitFail, "bundle: %v", err)
		}
		res.Files[i] = fileResult{Path: p, Size: len(f.data)}
	}
	// 1 goroutine per file because Brotli at quality 11 takes most of the run.
	var wg sync.WaitGroup
	errs := make([]error, len(files))
	for i, f := range files {
		wg.Go(func() {
			res.Files[i].Gzip, res.Files[i].Brotli, errs[i] = compressedSizes(f.data)
		})
	}
	wg.Wait()
	if err := errors.Join(errs...); err != nil {
		return fail(stderr, exitFail, "bundle: %v", err)
	}

	short := shortNames()
	var named []string
	for _, id := range sel.IDs {
		res.Components = append(res.Components, short[id])
		if slices.Contains(sel.Named, id) {
			named = append(named, short[id])
		} else {
			res.Added = append(res.Added, short[id])
		}
	}
	if *asJSON {
		return writeJSON(stdout, stderr, res)
	}
	var b bytes.Buffer
	fmt.Fprintf(&b, "Morpheus %s: %s\n", res.Version, strings.Join(named, ", "))
	if len(res.Added) > 0 {
		fmt.Fprintf(&b, "Added as requirements: %s\n", strings.Join(res.Added, ", "))
	}
	rows := [][]string{{"FILE", "SIZE", "GZIP", "BROTLI"}}
	for _, f := range res.Files {
		rows = append(rows, []string{f.Path, kB(f.Size), kB(f.Gzip), kB(f.Brotli)})
	}
	b.WriteByte('\n')
	b.WriteString(table(rows, 1, 2, 3))
	return write(stdout, stderr, b.Bytes())
}

// componentsResult is the output of components -json.
type componentsResult struct {
	Version    string          `json:"version"`
	Components []componentInfo `json:"components"`
}

// componentInfo is a name bundle takes.
type componentInfo struct {
	Name string `json:"name"`
	// Requires are the components bundle adds for it.
	Requires []string `json:"requires"`
	// Includes are the sub-components it ships, which bundle does not take
	// by name.
	Includes []string `json:"includes"`
}

func runComponents(args []string, stdout, stderr io.Writer) int {
	fl := flag.NewFlagSet("components", flag.ContinueOnError)
	fl.SetOutput(stderr)
	fl.Usage = func() {
		_, _ = io.WriteString(stderr, componentsUsage)
		fl.PrintDefaults()
	}
	asJSON := fl.Bool("json", false, "print the list as JSON")
	if status, ok := parse(fl, args); !ok {
		return status
	}
	v, err := bundle.Prepare(tree)
	if err != nil {
		return fail(stderr, exitFail, "components: %v", err)
	}
	list := components(v)
	if *asJSON {
		return writeJSON(stdout, stderr, componentsResult{Version: version(), Components: list})
	}
	rows := [][]string{{"COMPONENT", "REQUIRES", "INCLUDES"}}
	for _, c := range list {
		rows = append(rows, []string{
			c.Name, strings.Join(c.Requires, ", "), strings.Join(c.Includes, ", "),
		})
	}
	return write(stdout, stderr, []byte(table(rows)))
}

// components lists the names bundle takes in v.
func components(v bundle.Version) []componentInfo {
	short := shortNames()
	present := func(ids []string) []string {
		names := []string{}
		for _, id := range ids {
			if !slices.Contains(v.Absent, id) {
				names = append(names, short[id])
			}
		}
		return names
	}
	nodes := bundle.Nodes()
	var list []componentInfo
	for _, nd := range nodes {
		if !nd.Selectable() || slices.Contains(v.Absent, nd.ID) {
			continue
		}
		c := componentInfo{Name: nd.ShortName(), Requires: present(nd.Requires), Includes: []string{}}
		for _, sub := range nodes {
			if sub.Bound && slices.Contains(sub.RequiredBy, nd.ID) {
				c.Includes = append(c.Includes, sub.ShortName())
			}
		}
		list = append(list, c)
	}
	return list
}

// shortNames maps each [bundle.Node.ID] to its [bundle.Node.ShortName].
func shortNames() map[string]string {
	short := make(map[string]string)
	for _, nd := range bundle.Nodes() {
		short[nd.ID] = nd.ShortName()
	}
	return short
}

// version is the kit version the command builds.
func version() string { return strings.TrimSpace(versionFile) }

// listFlag collects the values of a repeatable flag.
type listFlag []string

func (l *listFlag) String() string { return strings.Join(*l, ",") }

func (l *listFlag) Set(s string) error {
	*l = append(*l, s)
	return nil
}

// parse parses a command's flags. ok is false when the command is done,
// with status 0 after -h and status [exitUsage] after a usage error.
func parse(fl *flag.FlagSet, args []string) (status int, ok bool) {
	err := fl.Parse(args)
	switch {
	case errors.Is(err, flag.ErrHelp):
		return 0, false
	case err != nil:
		return exitUsage, false
	case fl.NArg() > 0:
		_, _ = fmt.Fprintf(fl.Output(), "morpheus %s: unexpected argument %q\n\n", fl.Name(), fl.Arg(0))
		fl.Usage()
		return exitUsage, false
	}
	return 0, true
}

// fail reports a failure of the morpheus command and returns status.
func fail(stderr io.Writer, status int, format string, args ...any) int {
	_, _ = fmt.Fprintf(stderr, "morpheus "+format+"\n", args...)
	return status
}

// write writes a command's output; a failed write fails the command.
func write(stdout, stderr io.Writer, b []byte) int {
	if _, err := stdout.Write(b); err != nil {
		return fail(stderr, exitFail, "%v", err)
	}
	return 0
}

func writeJSON(stdout, stderr io.Writer, v any) int {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fail(stderr, exitFail, "%v", err)
	}
	return write(stdout, stderr, append(b, '\n'))
}

// table aligns rows in columns 2 spaces apart,
// right-aligning the columns in right.
func table(rows [][]string, right ...int) string {
	widths := make([]int, len(rows[0]))
	for _, r := range rows {
		for i, c := range r {
			widths[i] = max(widths[i], len(c))
		}
	}
	var b strings.Builder
	for _, r := range rows {
		var line strings.Builder
		for i, c := range r {
			if i > 0 {
				line.WriteString("  ")
			}
			pad := strings.Repeat(" ", widths[i]-len(c))
			if slices.Contains(right, i) {
				line.WriteString(pad)
				line.WriteString(c)
			} else {
				line.WriteString(c)
				line.WriteString(pad)
			}
		}
		b.WriteString(strings.TrimRight(line.String(), " "))
		b.WriteByte('\n')
	}
	return b.String()
}

// kB formats a size as the bundle builder page does.
func kB(n int) string { return fmt.Sprintf("%.1f kB", float64(n)/1024) }

// compressedSizes returns the gzip and Brotli sizes of b as the bundle builder page
// measures them. Gzip uses level 6, the default, and Brotli quality 11.
func compressedSizes(b []byte) (gz, br int, err error) {
	gz, err = compressedSize(b, func(w io.Writer) io.WriteCloser { return gzip.NewWriter(w) })
	if err != nil {
		return 0, 0, err
	}
	br, err = compressedSize(b, func(w io.Writer) io.WriteCloser {
		return brotli.NewWriterLevel(w, brotli.BestCompression)
	})
	return gz, br, err
}

func compressedSize(b []byte, newWriter func(io.Writer) io.WriteCloser) (int, error) {
	var buf bytes.Buffer
	w := newWriter(&buf)
	if _, err := w.Write(b); err != nil {
		return 0, err
	}
	if err := w.Close(); err != nil {
		return 0, err
	}
	return buf.Len(), nil
}

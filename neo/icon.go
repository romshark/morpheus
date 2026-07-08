package neo

import (
	"io/fs"
	"os"
	"strings"
	"sync"
)

// iconFS is the filesystem [Icon] reads SVG bytes from. Default
// matches the demo site's on-disk layout (internal/cmd/gen runs from the repo
// root); apps with a different layout call SetIconFS once at init,
// typically with an embed.FS.
//
// iconBase is the URL prefix the inlined SVGs correspond to. The client
// upgrade compares it against the base it resolves from --neo-icon-base;
// SSR-adoption only fires when both agree, so a themed user re-fetches
// the right icon set instead of being stuck with the default.
var (
	iconFSMu sync.RWMutex
	iconFS   fs.FS  = os.DirFS("internal/site/static/icons")
	iconBase string = "/static/icons"
)

// SetIconFS overrides the filesystem [Icon] reads SVG bytes from and
// invalidates the cache. Concurrent renders during the swap see either
// the old or the new value, never both.
func SetIconFS(f fs.FS) {
	iconFSMu.Lock()
	iconFS = f
	iconFSMu.Unlock()

	iconCacheMu.Lock()
	iconCache = map[string]string{}
	iconCacheMu.Unlock()
}

// SetIconBase tells the client which URL prefix the SSR-inlined SVGs
// were sourced from. Default is "/static/icons". Apps mounting icons
// at a different URL update this so the JS-side adoption check
// (--neo-icon-base) lines up.
func SetIconBase(base string) {
	iconFSMu.Lock()
	iconBase = base
	iconFSMu.Unlock()
}

// IconBase returns the URL prefix tagged onto the host so the client
// upgrade can verify the inlined SVG matches the runtime base.
func IconBase() string {
	iconFSMu.RLock()
	defer iconFSMu.RUnlock()
	return iconBase
}

// iconCache memoises the post-strip SVG text per name. Lookups are
// process-lifetime; SetIconFS clears it. Misses are NOT cached: a
// new icon file dropped in while the server runs becomes visible on
// the next render without restart, and re-statting a one-off missing
// icon is cheap relative to reading + stripping the SVG.
var (
	iconCacheMu sync.RWMutex
	iconCache   = map[string]string{}
)

// loadIconSVG returns the inlinable <svg>…</svg> markup for name.svg,
// with any leading XML prolog / license comment trimmed. Empty string
// if the file is missing or has no <svg> root.
func loadIconSVG(name string) string {
	iconCacheMu.RLock()
	v, ok := iconCache[name]
	iconCacheMu.RUnlock()
	if ok {
		return v
	}

	iconFSMu.RLock()
	f := iconFS
	iconFSMu.RUnlock()

	var s string
	if b, err := fs.ReadFile(f, name+".svg"); err == nil {
		text := string(b)
		if i := strings.Index(text, "<svg"); i >= 0 {
			s = text[i:]
		}
	}

	// Don't cache misses: that would freeze the "missing" verdict for
	// the process lifetime and block newly-added SVGs without a restart.
	if s == "" {
		return ""
	}
	iconCacheMu.Lock()
	iconCache[name] = s
	iconCacheMu.Unlock()
	return s
}

package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSetCacheControl(t *testing.T) {
	tests := []struct {
		name   string
		path   string
		status int
		before string
		want   string
	}{
		{
			name:   "long cache for min assets",
			path:   "/static/min/bundle.js",
			status: http.StatusOK,
			want:   "public, max-age=31536000, immutable",
		},
		{
			name:   "long cache for simulator module",
			path:   "/static/datasim.js",
			status: http.StatusOK,
			want:   "public, max-age=31536000, immutable",
		},
		{
			name:   "revalidate directory html",
			path:   "/sortable/",
			status: http.StatusOK,
			want:   "no-cache",
		},
		{
			name:   "revalidate explicit html",
			path:   "/sortable/index.html",
			status: http.StatusOK,
			want:   "no-cache",
		},
		{
			name:   "leave other static assets alone",
			path:   "/static/favicon.svg",
			status: http.StatusOK,
		},
		{
			name:   "do not cache errors",
			path:   "/static/min/missing.js",
			status: http.StatusNotFound,
		},
		{
			name:   "preserve existing cache header",
			path:   "/static/min/bundle.js",
			status: http.StatusOK,
			before: "private, max-age=60",
			want:   "private, max-age=60",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := http.Header{}
			if tt.before != "" {
				h.Set("Cache-Control", tt.before)
			}
			setCacheControl(h, tt.status, tt.path)
			if got := h.Get("Cache-Control"); got != tt.want {
				t.Fatalf("Cache-Control = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestCacheControlHandlerImplicitOK(t *testing.T) {
	handler := cacheControlHandler(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ok"))
	}))
	req := httptest.NewRequest(http.MethodGet, "/static/min/bundle.js", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if got, want := rec.Header().Get("Cache-Control"), "public, max-age=31536000, immutable"; got != want {
		t.Fatalf("Cache-Control = %q, want %q", got, want)
	}
}

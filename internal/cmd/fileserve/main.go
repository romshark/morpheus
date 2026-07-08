package main

import (
	"errors"
	"flag"
	"io"
	"log"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/andybalholm/brotli"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "listen address")
	dir := flag.String("dir", "dst", "directory to serve")
	flag.Parse()
	log.Printf("fileserve: %s -> http://%s", *dir, *addr)
	files := http.FileServer(http.Dir(*dir))
	err := http.ListenAndServe(*addr, brotliHandler(cacheControlHandler(files)))
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func cacheControlHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(&cacheControlResponseWriter{
			ResponseWriter: w,
			path:           r.URL.Path,
		}, r)
	})
}

type cacheControlResponseWriter struct {
	http.ResponseWriter
	path        string
	wroteHeader bool
}

func (w *cacheControlResponseWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	setCacheControl(w.Header(), status, w.path)
	w.ResponseWriter.WriteHeader(status)
}

func (w *cacheControlResponseWriter) Write(p []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(p)
}

func setCacheControl(h http.Header, status int, urlPath string) {
	if status < 200 || status >= 400 || h.Get("Cache-Control") != "" {
		return
	}
	if strings.HasPrefix(urlPath, "/static/min/") || urlPath == "/static/datasim.js" {
		h.Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	if urlPath == "/" || strings.HasSuffix(urlPath, "/") || strings.HasSuffix(urlPath, ".html") {
		h.Set("Cache-Control", "no-cache")
	}
}

func brotliHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodHead ||
			!acceptsBrotli(r.Header.Get("Accept-Encoding")) ||
			r.Header.Get("Range") != "" {
			next.ServeHTTP(w, r)
			return
		}
		bw := &brotliResponseWriter{ResponseWriter: w}
		defer func() {
			if err := bw.Close(); err != nil {
				log.Printf("fileserve: closing brotli writer: %v", err)
			}
		}()
		next.ServeHTTP(bw, r)
	})
}

type brotliResponseWriter struct {
	http.ResponseWriter
	writer      io.WriteCloser
	wroteHeader bool
	compressing bool
}

func (w *brotliResponseWriter) WriteHeader(status int) {
	if w.wroteHeader {
		return
	}
	w.wroteHeader = true
	if shouldCompress(status, w.Header()) {
		w.compressing = true
		addVary(w.Header(), "Accept-Encoding")
		w.Header().Set("Content-Encoding", "br")
		w.Header().Del("Content-Length")
		w.Header().Del("Accept-Ranges")
		w.ResponseWriter.WriteHeader(status)
		w.writer = brotli.NewWriterLevel(w.ResponseWriter, 4)
		return
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *brotliResponseWriter) Write(p []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.compressing {
		return w.writer.Write(p)
	}
	return w.ResponseWriter.Write(p)
}

func (w *brotliResponseWriter) Close() error {
	if w.writer == nil {
		return nil
	}
	return w.writer.Close()
}

func acceptsBrotli(header string) bool {
	for part := range strings.SplitSeq(header, ",") {
		token, params, _ := strings.Cut(strings.TrimSpace(part), ";")
		if strings.EqualFold(token, "br") {
			return encodingAllowed(params)
		}
	}
	return false
}

func encodingAllowed(params string) bool {
	for param := range strings.SplitSeq(params, ";") {
		key, value, ok := strings.Cut(strings.TrimSpace(param), "=")
		if !ok || !strings.EqualFold(key, "q") {
			continue
		}
		q, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		return err != nil || q > 0
	}
	return true
}

func shouldCompress(status int, h http.Header) bool {
	if status < 200 || status == http.StatusNoContent ||
		status == http.StatusNotModified {
		return false
	}
	if h.Get("Content-Encoding") != "" {
		return false
	}
	ct := h.Get("Content-Type")
	if ct == "" {
		return false
	}
	mt, _, err := mime.ParseMediaType(ct)
	if err != nil {
		mt = strings.ToLower(strings.TrimSpace(strings.Split(ct, ";")[0]))
	}
	if strings.HasPrefix(mt, "text/") {
		return true
	}
	switch mt {
	case "application/javascript",
		"application/json",
		"application/manifest+json",
		"application/wasm",
		"application/xml",
		"image/svg+xml":
		return true
	default:
		return strings.HasSuffix(mt, "+json") || strings.HasSuffix(mt, "+xml")
	}
}

func addVary(h http.Header, value string) {
	for part := range strings.SplitSeq(h.Get("Vary"), ",") {
		if strings.EqualFold(strings.TrimSpace(part), value) {
			return
		}
	}
	h.Add("Vary", value)
}

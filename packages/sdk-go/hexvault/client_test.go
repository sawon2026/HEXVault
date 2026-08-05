package hexvault

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health" {
			t.Fatalf("path %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true, "version": "2.2.0"})
	}))
	defer srv.Close()

	c := New(srv.URL)
	h, err := c.Health()
	if err != nil {
		t.Fatal(err)
	}
	if h["ok"] != true {
		t.Fatalf("expected ok: %v", h)
	}
}

func TestAuthHeader(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = r.Header.Get("Authorization")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	c.Token = "secret"
	_, _ = c.Health()
	if got != "Bearer secret" {
		t.Fatalf("auth = %q", got)
	}
}

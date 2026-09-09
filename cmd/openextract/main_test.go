package main

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", request.Method)
		}
		if request.URL.Path != "/extract" {
			t.Errorf("path = %s, want /extract", request.URL.Path)
		}
		body, err := io.ReadAll(request.Body)
		if err != nil {
			t.Errorf("read request: %v", err)
		}
		if got, want := string(body), `{"url":"https://example.com/path"}`; got != want {
			t.Errorf("body = %s, want %s", got, want)
		}
		response.Header().Set("Content-Type", "application/json")
		if _, err := io.WriteString(response, `{"outcome":"ok","content":"page text"}`); err != nil {
			t.Errorf("write response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	var output bytes.Buffer
	if err := run(context.Background(), []string{"-api", server.URL, "example.com/path"}, &output, io.Discard); err != nil {
		t.Fatalf("run: %v", err)
	}
	if got, want := output.String(), "page text\n"; got != want {
		t.Fatalf("output = %q, want %q", got, want)
	}
}

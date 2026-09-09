package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	defaultAPIURL   = "http://100.90.117.9:8082"
	maxResponseSize = 10 << 20
)

func main() {
	if err := run(context.Background(), os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("openextract", flag.ContinueOnError)
	flags.SetOutput(stderr)
	apiURL := flags.String("api", envOrDefault("OPENEXTRACT_API_URL", defaultAPIURL), "OpenExtract API URL")
	timeout := flags.Duration("timeout", 2*time.Minute, "request timeout")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 1 {
		return fmt.Errorf("usage: openextract [-api URL] [-timeout DURATION] <url>")
	}

	target, err := parseHTTPURL(flags.Arg(0))
	if err != nil {
		return fmt.Errorf("invalid target URL: %w", err)
	}
	base, err := parseHTTPURL(*apiURL)
	if err != nil {
		return fmt.Errorf("invalid API URL: %w", err)
	}
	endpoint, err := url.JoinPath(base.String(), "extract")
	if err != nil {
		return fmt.Errorf("build API endpoint: %w", err)
	}
	payload, err := json.Marshal(struct {
		URL string `json:"url"`
	}{URL: target.String()})
	if err != nil {
		return fmt.Errorf("encode request: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := (&http.Client{Timeout: *timeout}).Do(request)
	if err != nil {
		return fmt.Errorf("call OpenExtract: %w", err)
	}
	body, readErr := io.ReadAll(io.LimitReader(response.Body, maxResponseSize+1))
	closeErr := response.Body.Close()
	if readErr != nil {
		return fmt.Errorf("read response: %w", readErr)
	}
	if closeErr != nil {
		return fmt.Errorf("close response: %w", closeErr)
	}
	if len(body) > maxResponseSize {
		return fmt.Errorf("response exceeds %d bytes", maxResponseSize)
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		var apiError struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(body, &apiError); err == nil && apiError.Error != "" {
			return fmt.Errorf("OpenExtract: %s", apiError.Error)
		}
		return fmt.Errorf("OpenExtract returned %s", response.Status)
	}
	var result struct {
		Content string `json:"content"`
		Outcome string `json:"outcome"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	if result.Outcome == "dead" || result.Outcome == "failed" {
		return fmt.Errorf("extraction %s", result.Outcome)
	}
	if result.Outcome != "ok" {
		return fmt.Errorf("invalid OpenExtract outcome")
	}
	if _, err := io.WriteString(stdout, result.Content); err != nil {
		return fmt.Errorf("write content: %w", err)
	}
	if !strings.HasSuffix(result.Content, "\n") {
		if _, err := fmt.Fprintln(stdout); err != nil {
			return fmt.Errorf("write newline: %w", err)
		}
	}
	return nil
}

func parseHTTPURL(value string) (*url.URL, error) {
	if !strings.Contains(value, "://") {
		value = "https://" + value
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil {
		return nil, err
	}
	if parsed.Host == "" || parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, fmt.Errorf("must use http or https")
	}
	return parsed, nil
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

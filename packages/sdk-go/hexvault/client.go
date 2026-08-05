package hexvault

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"time"
)

const defaultBase = "http://127.0.0.1:3850"

type Client struct {
	BaseURL    string
	Token      string
	HTTPClient *http.Client
}

func New(baseURL string) *Client {
	if baseURL == "" {
		baseURL = defaultBase
	}
	return &Client{
		BaseURL: stringsTrimRightSlash(baseURL),
		Token:   os.Getenv("HEXVAULT_API_TOKEN"),
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func stringsTrimRightSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

type APIError struct {
	Status int
	Body   string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("hexvault api: status %d: %s", e.Status, e.Body)
}

func (c *Client) request(method, path string, body any, out any) error {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.BaseURL+path, rdr)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	data, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return &APIError{Status: res.StatusCode, Body: string(data)}
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	return json.Unmarshal(data, out)
}

func (c *Client) Health() (map[string]any, error) {
	var out map[string]any
	err := c.request("GET", "/health", nil, &out)
	return out, err
}

func (c *Client) AddMemory(content, title, typ string, tags []string) (map[string]any, error) {
	if title == "" {
		if len(content) > 60 {
			title = content[:60]
		} else {
			title = content
		}
	}
	if typ == "" {
		typ = "note"
	}
	if tags == nil {
		tags = []string{}
	}
	var out map[string]any
	err := c.request("POST", "/v1/memories", map[string]any{
		"content": content, "title": title, "type": typ, "tags": tags,
	}, &out)
	return out, err
}

func (c *Client) Search(q string, limit int) (map[string]any, error) {
	if limit <= 0 {
		limit = 10
	}
	qs := url.Values{}
	qs.Set("q", q)
	qs.Set("limit", strconv.Itoa(limit))
	var out map[string]any
	err := c.request("GET", "/v1/search?"+qs.Encode(), nil, &out)
	return out, err
}

func (c *Client) Chat(question string) (map[string]any, error) {
	var out map[string]any
	err := c.request("POST", "/v1/chat", map[string]string{"question": question}, &out)
	return out, err
}

func (c *Client) Stats() (map[string]any, error) {
	var out map[string]any
	err := c.request("GET", "/v1/stats", nil, &out)
	return out, err
}

func (c *Client) Analyze(top int) (map[string]any, error) {
	if top <= 0 {
		top = 15
	}
	var out map[string]any
	err := c.request("GET", "/v1/analyze?top="+strconv.Itoa(top), nil, &out)
	return out, err
}

func (c *Client) Graph(limit int) (map[string]any, error) {
	if limit <= 0 {
		limit = 60
	}
	var out map[string]any
	err := c.request("GET", "/v1/graph?limit="+strconv.Itoa(limit), nil, &out)
	return out, err
}

func (c *Client) GraphQL(query string, variables map[string]any) (map[string]any, error) {
	if variables == nil {
		variables = map[string]any{}
	}
	var out map[string]any
	err := c.request("POST", "/graphql", map[string]any{"query": query, "variables": variables}, &out)
	return out, err
}

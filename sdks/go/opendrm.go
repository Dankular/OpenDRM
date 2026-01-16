// Package opendrm provides a Go client for the OpenDRM API.
//
// Usage:
//
//	client := opendrm.New("sk_live_xxx", "https://api.example.com")
//
//	// Create a key
//	key, err := client.Keys.Create(nil)
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Printf("Key ID: %s\n", key.KeyID)
//
//	// Generate a playback token
//	token, err := client.Auth.GenerateToken(&opendrm.TokenRequest{
//	    Subject:   "user-123",
//	    ContentID: "video-001",
//	})
package opendrm

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is the OpenDRM API client
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client

	Keys     *KeysService
	Content  *ContentService
	Auth     *AuthService
	Webhooks *WebhooksService
	ApiKeys  *ApiKeysService
}

// New creates a new OpenDRM client
func New(apiKey, baseURL string) *Client {
	c := &Client{
		apiKey:  apiKey,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}

	c.Keys = &KeysService{client: c}
	c.Content = &ContentService{client: c}
	c.Auth = &AuthService{client: c}
	c.Webhooks = &WebhooksService{client: c}
	c.ApiKeys = &ApiKeysService{client: c}

	return c
}

// Error represents an API error
type Error struct {
	Message    string `json:"error"`
	StatusCode int    `json:"-"`
}

func (e *Error) Error() string {
	return fmt.Sprintf("opendrm: %s (status %d)", e.Message, e.StatusCode)
}

func (c *Client) request(method, path string, body, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bodyReader)
	if err != nil {
		return err
	}

	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "OpenDRM-Go/0.1.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		var apiErr Error
		if err := json.Unmarshal(respBody, &apiErr); err != nil {
			return &Error{Message: string(respBody), StatusCode: resp.StatusCode}
		}
		apiErr.StatusCode = resp.StatusCode
		return &apiErr
	}

	if result != nil && len(respBody) > 0 {
		return json.Unmarshal(respBody, result)
	}

	return nil
}

// Key represents an encryption key
type Key struct {
	ID        string     `json:"id"`
	KeyID     string     `json:"keyId"`
	KeyValue  string     `json:"keyValue,omitempty"`
	Status    string     `json:"status"`
	CreatedAt time.Time  `json:"createdAt"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// KeysService handles key operations
type KeysService struct {
	client *Client
}

// CreateKeyRequest is the request for creating a key
type CreateKeyRequest struct {
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// Create creates a new encryption key
func (s *KeysService) Create(req *CreateKeyRequest) (*Key, error) {
	var key Key
	if err := s.client.request("POST", "/api/v1/keys", req, &key); err != nil {
		return nil, err
	}
	return &key, nil
}

// Get retrieves a key by ID
func (s *KeysService) Get(keyID string) (*Key, error) {
	var key Key
	if err := s.client.request("GET", "/api/v1/keys/"+keyID, nil, &key); err != nil {
		return nil, err
	}
	return &key, nil
}

// Revoke revokes a key
func (s *KeysService) Revoke(keyID string) error {
	return s.client.request("DELETE", "/api/v1/keys/"+keyID, nil, nil)
}

// Content represents registered content
type Content struct {
	ID        string    `json:"id"`
	ContentID string    `json:"contentId"`
	Title     string    `json:"title,omitempty"`
	KeyID     string    `json:"keyId,omitempty"`
	PolicyID  string    `json:"policyId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// ContentService handles content operations
type ContentService struct {
	client *Client
}

// RegisterContentRequest is the request for registering content
type RegisterContentRequest struct {
	ContentID string `json:"contentId"`
	Title     string `json:"title,omitempty"`
	KeyID     string `json:"keyId,omitempty"`
	PolicyID  string `json:"policyId,omitempty"`
}

// Register registers new content
func (s *ContentService) Register(req *RegisterContentRequest) (*Content, error) {
	var content Content
	if err := s.client.request("POST", "/api/v1/content", req, &content); err != nil {
		return nil, err
	}
	return &content, nil
}

// Get retrieves content by ID
func (s *ContentService) Get(contentID string) (*Content, error) {
	var content Content
	if err := s.client.request("GET", "/api/v1/content/"+contentID, nil, &content); err != nil {
		return nil, err
	}
	return &content, nil
}

// Token represents a playback token
type Token struct {
	Token     string     `json:"token"`
	ExpiresIn string     `json:"expiresIn"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// AuthService handles authentication
type AuthService struct {
	client *Client
}

// TokenRequest is the request for generating a token
type TokenRequest struct {
	Subject   string   `json:"subject"`
	ContentID string   `json:"contentId,omitempty"`
	KeyIDs    []string `json:"keyIds,omitempty"`
	ExpiresIn string   `json:"expiresIn,omitempty"`
}

// GenerateToken generates a playback token
func (s *AuthService) GenerateToken(req *TokenRequest) (*Token, error) {
	var token Token
	if err := s.client.request("POST", "/api/v1/auth/token", req, &token); err != nil {
		return nil, err
	}
	return &token, nil
}

// Webhook represents a webhook subscription
type Webhook struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Events    []string  `json:"events"`
	Status    string    `json:"status"`
	Secret    string    `json:"secret,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// WebhooksService handles webhook operations
type WebhooksService struct {
	client *Client
}

// CreateWebhookRequest is the request for creating a webhook
type CreateWebhookRequest struct {
	URL    string   `json:"url"`
	Events []string `json:"events"`
	Secret string   `json:"secret,omitempty"`
}

// Create creates a new webhook
func (s *WebhooksService) Create(req *CreateWebhookRequest) (*Webhook, error) {
	var webhook Webhook
	if err := s.client.request("POST", "/api/v1/webhooks", req, &webhook); err != nil {
		return nil, err
	}
	return &webhook, nil
}

// List lists all webhooks
func (s *WebhooksService) List() ([]Webhook, error) {
	var webhooks []Webhook
	if err := s.client.request("GET", "/api/v1/webhooks", nil, &webhooks); err != nil {
		return nil, err
	}
	return webhooks, nil
}

// Delete deletes a webhook
func (s *WebhooksService) Delete(webhookID string) error {
	return s.client.request("DELETE", "/api/v1/webhooks/"+webhookID, nil, nil)
}

// VerifySignature verifies a webhook signature
func VerifySignature(payload, signature, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

// ApiKey represents an API key
type ApiKey struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Key        string     `json:"key,omitempty"`
	KeyPrefix  string     `json:"keyPrefix"`
	Scopes     []string   `json:"scopes"`
	Status     string     `json:"status"`
	CreatedAt  time.Time  `json:"createdAt"`
	ExpiresAt  *time.Time `json:"expiresAt,omitempty"`
	LastUsedAt *time.Time `json:"lastUsedAt,omitempty"`
}

// ApiKeysService handles API key operations
type ApiKeysService struct {
	client *Client
}

// CreateApiKeyRequest is the request for creating an API key
type CreateApiKeyRequest struct {
	Name      string     `json:"name"`
	Scopes    []string   `json:"scopes,omitempty"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

// Create creates a new API key
func (s *ApiKeysService) Create(req *CreateApiKeyRequest) (*ApiKey, error) {
	var key ApiKey
	if err := s.client.request("POST", "/api/v1/apikeys", req, &key); err != nil {
		return nil, err
	}
	return &key, nil
}

// List lists all API keys
func (s *ApiKeysService) List() ([]ApiKey, error) {
	var keys []ApiKey
	if err := s.client.request("GET", "/api/v1/apikeys", nil, &keys); err != nil {
		return nil, err
	}
	return keys, nil
}

// Revoke revokes an API key
func (s *ApiKeysService) Revoke(keyID string) error {
	return s.client.request("DELETE", "/api/v1/apikeys/"+keyID, nil, nil)
}

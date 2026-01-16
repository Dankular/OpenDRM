/**
 * License acquisition client for OpenDRM
 */

export interface LicenseConfig {
  /** Base URL of the license server */
  serverUrl: string;

  /** Authorization token */
  token?: string;

  /** Additional headers */
  headers?: Record<string, string>;
}

export class LicenseClient {
  private config: LicenseConfig;

  constructor(config: LicenseConfig) {
    this.config = config;
  }

  /**
   * Get ClearKey license URL with proper headers
   */
  getClearKeyUrl(): string {
    return `${this.config.serverUrl}/api/v1/license/clearkey`;
  }

  /**
   * Get Widevine license URL
   */
  getWidevineUrl(): string {
    return `${this.config.serverUrl}/api/v1/license/widevine`;
  }

  /**
   * Get FairPlay license URL
   */
  getFairPlayUrl(): string {
    return `${this.config.serverUrl}/api/v1/license/fairplay`;
  }

  /**
   * Get FairPlay certificate URL
   */
  getFairPlayCertificateUrl(): string {
    return `${this.config.serverUrl}/api/v1/license/fairplay/certificate`;
  }

  /**
   * Get headers for license requests
   */
  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.config.headers,
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    }

    return headers;
  }

  /**
   * Update the authorization token
   */
  setToken(token: string): void {
    this.config.token = token;
  }

  /**
   * Get DRM capabilities from the server
   */
  async getCapabilities(): Promise<{
    clearkey: boolean;
    widevine: boolean;
    fairplay: boolean;
  }> {
    const response = await fetch(
      `${this.config.serverUrl}/api/v1/license/capabilities`,
      {
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get capabilities: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Generate a playback token
   */
  async generateToken(options: {
    subject: string;
    contentId?: string;
    keyIds?: string[];
    expiresIn?: string;
  }): Promise<string> {
    const response = await fetch(`${this.config.serverUrl}/api/v1/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getHeaders(),
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate token: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  }
}

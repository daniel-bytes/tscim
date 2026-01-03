import type {
  ResourceId,
  ResourceType,
  ScimErrorJson,
} from '../../scim/model.js';
import {
  ScimBadRequestError,
  ScimConflictError,
  ScimError,
  ScimInternalServerError,
  ScimNotFoundError,
  ScimNotImplementedError,
} from '../../scim/errors.js';

/**
 * Options for configuring the SCIM client
 */
export interface ScimHttpClientOptions {
  /** Base URL of the SCIM API (e.g., 'https://api.example.com/scim/v2') */
  baseUrl: string;
  /** Optional Bearer token for authentication */
  bearerToken?: string;
}

/**
 * SCIM Client for interacting with external SCIM APIs over HTTP
 *
 * Implements RFC 7644 - SCIM Protocol
 * https://datatracker.ietf.org/doc/html/rfc7644
 *
 * Uses Node.js built-in fetch (available in Node 18+)
 */
export class ScimHttpClient {
  protected readonly baseUrl: string;
  protected readonly bearerToken?: string;

  constructor(options: ScimHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    if (options.bearerToken !== undefined) {
      this.bearerToken = options.bearerToken;
    }
  }

  /**
   * Make an HTTP request to the SCIM API
   */
  public async request<T>(args: {
    method: string;
    path: string;
    body?: unknown;
    resourceType?: ResourceType;
    resourceId?: ResourceId;
  }): Promise<T> {
    const { body, method, resourceId, resourceType } = args;
    const url = `${this.baseUrl}${args.path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/scim+json',
      Accept: 'application/scim+json',
    };

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined && method !== 'GET' && method !== 'DELETE') {
      requestOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, requestOptions);

      // Handle empty responses (e.g., DELETE 204)
      if (response.status === 204) {
        return undefined as T;
      }

      if (response.status === 201) {
        // For 201, try to parse the response body
        const text = await response.text();
        if (!text) {
          return undefined as T;
        }
        return JSON.parse(text) as T;
      }

      // Parse response body
      const responseText = await response.text();
      if (!responseText) {
        if (!response.ok) {
          throw this.createErrorFromResponse(
            response,
            undefined,
            resourceType,
            resourceId
          );
        }
        return undefined as unknown as T;
      }

      const responseData = JSON.parse(responseText);

      // Check if response is a SCIM error
      if (
        responseData.schemas?.includes(
          'urn:ietf:params:scim:api:messages:2.0:Error'
        )
      ) {
        throw this.createErrorFromScimError(
          responseData,
          response.status,
          resourceType,
          resourceId
        );
      }

      // Handle non-OK status codes
      if (!response.ok) {
        throw this.createErrorFromResponse(
          response,
          responseData,
          resourceType,
          resourceId
        );
      }

      return responseData as T;
    } catch (error) {
      // Re-throw SCIM errors as-is
      if (error instanceof ScimError) {
        throw error;
      }

      // Handle network errors and other exceptions
      if (error instanceof Error) {
        throw new ScimInternalServerError(
          `Network error: ${error.message}`,
          error,
          resourceType,
          resourceId
        );
      }

      throw new ScimInternalServerError(
        'Unknown error occurred',
        new Error(String(error)),
        resourceType,
        resourceId
      );
    }
  }

  /**
   * Create a SCIM error from an HTTP response
   */
  private createErrorFromResponse(
    response: Response,
    responseData?: unknown,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ): ScimError {
    const status = response.status;
    const message =
      (responseData as { detail?: string })?.detail
      || response.statusText
      || `HTTP ${status}`;

    switch (status) {
      case 400:
        return new ScimBadRequestError(message, resourceType, resourceId);
      case 404:
        return new ScimNotFoundError(message, resourceType, resourceId);
      case 409:
        return new ScimConflictError(message, resourceType, resourceId);
      case 501:
        return new ScimNotImplementedError(message, resourceType, resourceId);
      default:
        return new ScimError(message, status, resourceType, resourceId);
    }
  }

  /**
   * Create a SCIM error from a SCIM error response
   */
  private createErrorFromScimError(
    errorData: ScimErrorJson,
    statusCode: number,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ): ScimError {
    const status = Number.parseInt(errorData.status, 10) || statusCode;
    const message = errorData.detail || `SCIM Error ${status}`;

    switch (status) {
      case 400:
        return new ScimBadRequestError(message, resourceType, resourceId);
      case 404:
        return new ScimNotFoundError(message, resourceType, resourceId);
      case 409:
        return new ScimConflictError(message, resourceType, resourceId);
      case 501:
        return new ScimNotImplementedError(message, resourceType, resourceId);
      default:
        return new ScimError(message, status, resourceType, resourceId);
    }
  }
}

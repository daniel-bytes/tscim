import type { ResourceId, ResourceType, ScimErrorJson } from './model.js';

/**
 * Base class for all SCIM errors.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 * @param statusCode - The HTTP status code of the error
 * @param resourceId - The ID of the resource that the error occurred on
 */
export class ScimError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly resourceType?: ResourceType,
    public readonly resourceId?: ResourceId
  ) {
    super(message);
    this.name = 'ScimError';
  }

  /**
   * Convert this error to SCIM JSON format according to RFC 7644 Section 3.12
   */
  toJSON(): ScimErrorJson {
    const error: ScimErrorJson = {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      status: String(this.statusCode),
      detail: this.message,
    };

    // Map error type to SCIM error type if applicable
    if (this.scimType) {
      return {
        ...error,
        scimType: this.scimType,
      };
    }

    return error;
  }

  /**
   * Get the SCIM error type for this error, if applicable
   */
  protected get scimType(): string | undefined {
    return undefined;
  }
}

/**
 * Error thrown when a SCIM operation fails internally.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 * @param error - The error that occurred
 * @param resourceId - The ID of the resource that the error occurred on
 */
export class ScimInternalServerError extends ScimError {
  constructor(
    message: string,
    public readonly error: Error,
    public readonly resourceType?: ResourceType,
    public readonly resourceId?: ResourceId
  ) {
    super(message, 500, resourceType, resourceId);
    this.name = 'ScimInternalServerError';
  }
}

/**
 * Error thrown when a SCIM operation is not implemented.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 */
export class ScimNotImplementedError extends ScimError {
  constructor(
    message: string,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ) {
    super(message, 501, resourceType, resourceId);
    this.name = 'ScimNotImplementedError';
  }
}

/**
 * Error thrown when a resource is not found.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 * @param resourceId - The ID of the resource that the error occurred on
 */
export class ScimNotFoundError extends ScimError {
  constructor(
    message: string,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ) {
    super(message, 404, resourceType, resourceId);
    this.name = 'ScimNotFoundError';
  }
}

/**
 * Error thrown when a resource conflict is detected.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 * @param resourceId - The ID of the resource that the error occurred on
 */
export class ScimConflictError extends ScimError {
  constructor(
    message: string,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ) {
    super(message, 409, resourceType, resourceId);
    this.name = 'ScimConflictError';
  }

  protected override get scimType(): string {
    return 'uniqueness';
  }
}

/**
 * Error thrown when a bad request is made.
 *
 * @param message - The error message
 * @param resourceType - The type of resource that the error occurred on
 * @param resourceId - The optional ID of the resource that the error occurred on
 */
export class ScimBadRequestError extends ScimError {
  constructor(
    message: string,
    resourceType?: ResourceType,
    resourceId?: ResourceId
  ) {
    super(message, 400, resourceType, resourceId);
    this.name = 'ScimBadRequestError';
  }

  protected override get scimType(): string {
    return 'invalidValue';
  }
}

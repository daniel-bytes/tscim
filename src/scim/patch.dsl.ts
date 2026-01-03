import type { SchemaUris } from './uris.js';

/**
 * SCIM PATCH DSL
 *
 * Implements RFC 7644 Section 3.5.2 - PATCH
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.5.2
 */

import type { AttributePath, Resource } from './model.js';

/**
 * SCIM PATCH operation names
 * RFC 7644 Section 3.5.2.1
 */
export type PatchOperationName = 'add' | 'remove' | 'replace';

/**
 * Base shape for a PATCH operation
 */
interface BasePatchOperation<TResource extends Resource> {
  /** Operation to perform */
  readonly op: PatchOperationName;
  /**
   * Target attribute path. RFC allows additional filter syntax
   * (e.g., members[value eq "123"]). Typing permits strings to allow
   * filter expressions in addition to attribute paths derived from the model.
   */
  readonly path?: AttributePath<TResource> | string;
}

/**
 * Add operation (RFC 7644 Section 3.5.2.1)
 * - Adds a value to the target path or appends to multi-valued attributes.
 */
export interface AddOperation<
  TResource extends Resource = Resource,
> extends BasePatchOperation<TResource> {
  readonly op: 'add';
  /** Value to add; can be a full resource, sub-attribute, or array value */
  readonly value: unknown;
}

/**
 * Replace operation (RFC 7644 Section 3.5.2.1)
 * - Replaces the value at the target path.
 */
export interface ReplaceOperation<
  TResource extends Resource = Resource,
> extends BasePatchOperation<TResource> {
  readonly op: 'replace';
  /** Replacement value; required by the specification */
  readonly value: unknown;
}

/**
 * Remove operation (RFC 7644 Section 3.5.2.1)
 * - Removes the value at the target path. Value MAY be supplied to match within multi-valued attributes.
 * - The "path" attribute is REQUIRED for remove operations per RFC 7644 Section 3.5.2.
 */
export interface RemoveOperation<
  TResource extends Resource = Resource,
> extends Omit<BasePatchOperation<TResource>, 'path'> {
  readonly op: 'remove';
  /** Target attribute path - REQUIRED for remove operations per RFC 7644 Section 3.5.2 */
  readonly path: AttributePath<TResource> | string;
  /** Optional selector value for multi-valued attributes */
  readonly value?: unknown;
}

/**
 * Union of all supported PATCH operations
 */
export type PatchOperation<TResource extends Resource = Resource> =
  | AddOperation<TResource>
  | ReplaceOperation<TResource>
  | RemoveOperation<TResource>;

/**
 * PATCH request payload (RFC 7644 Section 3.5.2)
 */
export interface PatchRequest<TResource extends Resource = Resource> {
  /** Schemas MUST include the PATCH schema URI */
  readonly schemas: readonly (typeof SchemaUris.PatchOp | string)[];
  /** Operations to apply, processed in order */
  readonly Operations: readonly PatchOperation<TResource>[];
}

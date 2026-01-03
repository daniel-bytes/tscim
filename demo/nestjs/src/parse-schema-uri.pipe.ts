import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { SchemaUri } from 'tscim';

/**
 * Validation pipe to ensure a parameter is a valid SchemaUri.
 * SchemaUri must match the pattern: urn:ietf:params:scim:schemas:${string}
 */
@Injectable()
export class ParseSchemaUriPipe implements PipeTransform<string, SchemaUri> {
  private readonly schemaUriPattern = /^urn:ietf:params:scim:schemas:.+$/;

  transform(value: string): SchemaUri {
    if (typeof value !== 'string') {
      throw new BadRequestException(
        `Validation failed: expected a string, got ${typeof value}`,
      );
    }

    if (!this.schemaUriPattern.test(value)) {
      throw new BadRequestException(
        `Validation failed: "${value}" is not a valid SchemaUri. Expected format: urn:ietf:params:scim:schemas:${'{...}'}`,
      );
    }

    return value as SchemaUri;
  }
}

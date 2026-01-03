/**
 * A failure is an object with a message property.
 */
export interface Failure {
  code: string;
  message: string;
}

/**
 * An either is a value that is either a left or a right.
 */
export type Either<L extends Failure, R> = Left<L> | Right<R>;

/**
 * An either error is an error that is thrown when an either is a left.
 */
export class EitherError extends Error {
  constructor(readonly value: Failure) {
    super(value.code + ': ' + value.message);
  }
}

/**
 * A left is a value that is a failure.
 */
export class Left<L extends Failure> {
  constructor(readonly value: L) {}
  isLeft(): this is Left<L> {
    return true;
  }
  isRight(): this is Right<never> {
    return false;
  }
  get(): never {
    throw new EitherError(this.value);
  }
}

/**
 * A right is a value that is a success.
 */
export class Right<R> {
  constructor(readonly value: R) {}
  isLeft(): this is Left<never> {
    return false;
  }
  isRight(): this is Right<R> {
    return true;
  }
  get(): R {
    return this.value;
  }
}

/**
 * A success is a value that is a success.
 */
export const success = <T>(value: T) => new Right(value);

/**
 * A failure is a value that is a failure.
 */
export const failure = <E extends Failure>(error: E) => new Left(error);

// ============================================================================
// Parser Types
// ============================================================================

export type ParserError = {
  readonly code:
    | 'INVALID_TOKEN'
    | 'MISSING_VALUE'
    | 'INVALID_OPERATOR'
    | 'INVALID_ATTRIBUTE'
    | 'UNEXPECTED_END'
    | 'INVALID_SYNTAX';
  readonly message: string;
  readonly position: number;
  readonly input: string;
};

export type ParserResult<T> = Either<ParserError, [T, string]>;
export type Parser<T> = (input: string) => ParserResult<T>;

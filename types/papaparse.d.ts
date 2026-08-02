declare module "papaparse" {
  export interface ParseError {
    message: string;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: unknown;
  }

  export interface ParseConfig<T> {
    header?: boolean;
    delimiter?: string;
    skipEmptyLines?: boolean;
    complete?: (results: ParseResult<T>) => void;
    error?: (error: ParseError) => void;
  }

  export function parse<T>(file: File, config: ParseConfig<T>): void;
}

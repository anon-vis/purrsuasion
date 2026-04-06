export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;

export type PyOutputType =
  | "raw"
  | "html"
  | "altair chart"
  | "no output"
  | "error";

export type TranslatedPyOutput = {
  type: PyOutputType;
  value: any;
};

export type WorkerRequest =
  | {
      id: string;
      type: "run";
      python: string;
    }
  | {
      id: string;
      type: "interrupt";
      interruptBuffer: Uint8Array<SharedArrayBuffer>;
    }
  | {
      id: string;
      type: "init";
      promptCategory: string;
    }
  | {
      id: string;
      type: "completions";
      code: string; // Full cell code
      line: number; // Cursor line (0-indexed)
      column: number; // Cursor column (0-indexed)
    };

export type WorkerResponse =
  | {
      id: string;
      type: "init";
      success: boolean;
    }
  | {
      id: string;
      type: "run";
      output: TranslatedPyOutput;
    }
  | { id: string; type: "interrupt"; success: boolean }
  | {
      id: string;
      type: "completions";
      completions: Completion[];
    };

export interface Completion {
  label: string; // "read_csv"
  type: string; // "function", "class", "module", "variable"
  detail?: string; // "pandas.read_csv"
  documentation?: string; // Docstring
  signature?: string; // "(filepath, ...)"
}

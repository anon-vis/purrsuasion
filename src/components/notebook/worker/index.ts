import { v4 as uuidv4 } from "uuid";
import { getPromiseAndResolve } from "../../../lib/core/utils";
import type { DistributiveOmit, WorkerRequest, WorkerResponse } from "./types";

export const PYODIDE_WORKER = new Worker(
  new URL("./worker.ts", import.meta.url),
  {
    type: "module",
  }
);

function requestResponse(
  worker: Worker,
  request: DistributiveOmit<WorkerRequest, "id">
) {
  const { promise, resolve } = getPromiseAndResolve<WorkerResponse>();
  const requestId = uuidv4();

  function listener(event: MessageEvent<WorkerResponse>) {
    if (event.data.id !== requestId) {
      return;
    }
    worker.removeEventListener("message", listener);
    resolve(event.data);
  }

  worker.addEventListener("message", listener);

  worker.postMessage({
    id: requestId,
    ...request,
  });

  return promise;
}

export function init(prompt: string) {
  return requestResponse(PYODIDE_WORKER, {
    type: "init",
    promptCategory: prompt,
  });
}

export function run(python: string) {
  return requestResponse(PYODIDE_WORKER, { type: "run", python: python });
}

export function interrupt(interruptBuffer: Uint8Array<SharedArrayBuffer>) {
  return requestResponse(PYODIDE_WORKER, {
    type: "interrupt",
    interruptBuffer: interruptBuffer,
  });
}

export function getCompletions(code: string, line: number, column: number) {
  return requestResponse(PYODIDE_WORKER, {
    type: "completions",
    code,
    line,
    column,
  }) as Promise<Extract<WorkerResponse, { type: "completions" }>>;
}

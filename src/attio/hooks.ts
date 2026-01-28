import type { ResolvedRequestOptions } from "../generated/client";
import type { AttioError } from "./errors";

interface AttioRequestHookPayload {
  request: Request;
  options: ResolvedRequestOptions;
}

interface AttioResponseHookPayload {
  response: Response;
  request: Request;
  options: ResolvedRequestOptions;
}

interface AttioErrorHookPayload {
  error: AttioError;
  request?: Request;
  response?: Response;
  options?: ResolvedRequestOptions;
}

interface AttioClientHooks {
  onRequest?: (payload: AttioRequestHookPayload) => void;
  onResponse?: (payload: AttioResponseHookPayload) => void;
  onError?: (payload: AttioErrorHookPayload) => void;
}

interface AttioLogger {
  debug?: (message: string, context?: unknown) => void;
  info?: (message: string, context?: unknown) => void;
  warn?: (message: string, context?: unknown) => void;
  error?: (message: string, context?: unknown) => void;
}

export type {
  AttioClientHooks,
  AttioErrorHookPayload,
  AttioLogger,
  AttioRequestHookPayload,
  AttioResponseHookPayload,
};

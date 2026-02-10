import type { ResolvedRequestOptions } from "../generated/client";
import type { AttioError } from "./errors";

interface AttioRequestHookPayload {
  request: Request;
  options: ResolvedRequestOptions;
  correlationId?: string;
}

interface AttioResponseHookPayload {
  response: Response;
  request: Request;
  options: ResolvedRequestOptions;
  correlationId?: string;
}

interface AttioErrorHookPayload {
  error: AttioError;
  request?: Request;
  response?: Response;
  options?: ResolvedRequestOptions;
  correlationId?: string;
}

interface AttioClientHooks {
  onRequest?: (payload: AttioRequestHookPayload) => void;
  onResponse?: (payload: AttioResponseHookPayload) => void;
  onError?: (payload: AttioErrorHookPayload) => void;
}

type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | { [key: string]: LogValue };

interface LogContext {
  [key: string]: LogValue;
}

interface AttioLogger {
  debug?: (message: string, context?: LogContext) => void;
  info?: (message: string, context?: LogContext) => void;
  warn?: (message: string, context?: LogContext) => void;
  error?: (message: string, context?: LogContext) => void;
}

export type {
  AttioClientHooks,
  AttioErrorHookPayload,
  LogContext,
  LogValue,
  AttioLogger,
  AttioRequestHookPayload,
  AttioResponseHookPayload,
};

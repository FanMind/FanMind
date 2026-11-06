export const META_CATCHUP_WORKER_SECRET_MIN_LENGTH: number;
export const META_CATCHUP_MAX_ATTEMPTS: number;

export function isMetaCatchupQueueEnabled(
  environment?: Record<string, string | undefined>,
): boolean;

export function validateMetaCatchupWorkerRequestBody(value: unknown):
  | { readonly ok: false; readonly value: null }
  | {
      readonly ok: true;
      readonly value: {
        readonly jobId: string;
        readonly workerId: string;
        readonly leaseToken: string;
      };
    };

export type MetaCatchupWorkerDisposition =
  | "success"
  | "retry"
  | "terminal"
  | "cancelled";

export type MetaCatchupWorkerErrorCode =
  | "catchup_request_failed"
  | "connection_unavailable"
  | "entitlement_unavailable"
  | "internal_route_unavailable"
  | "meta_sync_failed"
  | "worker_response_invalid";

export function normalizeMetaCatchupWorkerResponse(value: unknown): {
  disposition: MetaCatchupWorkerDisposition;
  errorCode: MetaCatchupWorkerErrorCode | null;
} | null;

export function retrySecondsForMetaCatchupAttempt(value: number): number;

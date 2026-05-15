import type { AttioCacheStats } from "./cache";
import type { AttioClient } from "./client";

interface AttioDiagnosticsHealth {
  authConfigured: boolean;
  baseUrl?: string;
  metadataCacheEnabled: boolean;
  ok: true;
}

interface AttioDiagnostics {
  health: () => AttioDiagnosticsHealth;
  cacheStats: () => AttioCacheStats;
}

const isAuthConfigured = (auth: unknown): boolean => {
  if (typeof auth === "string") {
    return auth.length > 0;
  }
  return auth !== undefined && auth !== null;
};

const createDiagnostics = (client: AttioClient): AttioDiagnostics => ({
  health: () => {
    const config = client.getConfig();
    const cacheStats = client.cache.stats();

    return {
      authConfigured: isAuthConfigured(config.auth),
      baseUrl: config.baseUrl,
      metadataCacheEnabled: Object.values(cacheStats.metadata).some(
        (scope) => scope.enabled,
      ),
      ok: true,
    };
  },
  cacheStats: () => client.cache.stats(),
});

export type { AttioDiagnostics, AttioDiagnosticsHealth };
export { createDiagnostics };

import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContextStore {
  tenantId: number;
  userId?: number;
  username?: string;
  installationId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContextStore>();

export function getTenantContext(): TenantContextStore | undefined {
  return tenantStorage.getStore();
}

export function getCurrentTenantId(): number {
  const store = tenantStorage.getStore();
  if (store?.tenantId && store.tenantId > 0) {
    return store.tenantId;
  }
  return 1;
}

export function runWithTenant<T>(tenantId: number, fn: () => T, meta?: Omit<TenantContextStore, "tenantId">): T {
  return tenantStorage.run({ tenantId: tenantId > 0 ? tenantId : 1, ...meta }, fn);
}

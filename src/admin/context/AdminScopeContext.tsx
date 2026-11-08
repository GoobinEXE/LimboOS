import React, { createContext, useContext } from 'react';
import type { TenantScope } from '../../lib/tenantScope';

/** Uma pasta em que a conta pode mestrar: a própria ou uma compartilhada. */
export interface WorkspaceOption {
  wsId: string;
  name: string;
  role: 'owner' | 'cogm';
  /** null = todas as campanhas (dono). */
  campaignIds: string[] | null;
}

export interface AdminScopeValue {
  scope: TenantScope;
  options: WorkspaceOption[];
  isPlatformAdmin: boolean;
  isOwner: boolean;
  isCoGm: boolean;
  /** Dono: excluir campanha, convidar e remover mestres e jogadores. */
  canManage: boolean;
  switchWorkspace: (wsId: string) => void;
}

const AdminScopeContext = createContext<AdminScopeValue | null>(null);

export function AdminScopeProvider({
  value,
  children,
}: {
  value: AdminScopeValue;
  children: React.ReactNode;
}) {
  return <AdminScopeContext.Provider value={value}>{children}</AdminScopeContext.Provider>;
}

/** Pasta ativa do painel. Fora do provider (testes, harness) assume dono sem pasta. */
export function useAdminScope(): AdminScopeValue {
  const ctx = useContext(AdminScopeContext);
  if (!ctx) {
    throw new Error('useAdminScope fora do AdminScopeProvider');
  }
  return ctx;
}

/** Variante tolerante para componentes compartilhados com o player. */
export function useOptionalAdminScope(): AdminScopeValue | null {
  return useContext(AdminScopeContext);
}

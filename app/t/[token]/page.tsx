'use client';

import React, { use } from 'react';
import { TenantPortalView } from '@/components/tenant/TenantPortalView';

interface TenantPageProps {
  params: Promise<{ token: string }>;
}

export default function TenantPage({ params }: TenantPageProps) {
  const { token } = use(params);
  return <TenantPortalView token={token} />;
}

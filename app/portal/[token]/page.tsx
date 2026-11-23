'use client';

import React, { use } from 'react';
import { TenantPortalView } from '@/components/tenant/TenantPortalView';

interface PortalPageProps {
  params: Promise<{ token: string }>;
}

export default function PortalPage({ params }: PortalPageProps) {
  const { token } = use(params);
  return <TenantPortalView token={token} />;
}

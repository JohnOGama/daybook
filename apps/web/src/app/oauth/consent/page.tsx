import { Suspense } from 'react';
import { AuthCardSkeletonComponent, OAuthConsentPageComponent } from '@/features/auth';

export default function OAuthConsentPage() {
  return (
    <Suspense fallback={<AuthCardSkeletonComponent />}>
      <OAuthConsentPageComponent />
    </Suspense>
  );
}

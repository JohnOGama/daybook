import { Suspense } from 'react';
import { AuthCardSkeletonComponent, VerifyPageComponent } from '@/features/auth';

export default function VerifyPage() {
  return (
    <Suspense fallback={<AuthCardSkeletonComponent />}>
      <VerifyPageComponent />
    </Suspense>
  );
}

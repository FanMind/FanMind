import { notFound } from 'next/navigation';
import { operatorSessionEnabled } from '@/lib/stagingOperatorSession.mjs';
import OperatorSession from './OperatorSession';

export const dynamic = 'force-dynamic';
export default function StagingOperatorPage() {
  if (!operatorSessionEnabled(process.env)) notFound();
  return <OperatorSession />;
}

import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { MotionProvider } from '@/ui/MotionProvider';
import { DemoApp, PATIENT_URL } from './DemoApp';
import { installMockApi } from './mockApi';

installMockApi(PATIENT_URL);
createRoot(document.getElementById('root')!).render(
  <MotionProvider>
    <DemoApp />
  </MotionProvider>,
);

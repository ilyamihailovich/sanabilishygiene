import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import { MotionProvider } from '@/ui/MotionProvider';
import { DemoApp, MAIN_VISIT, PATIENT_URL, patients } from './DemoApp';
import { installMockApi } from './mockApi';
import { setInitialPath } from './router';

installMockApi(PATIENT_URL, patients);
setInitialPath(`/visits/${MAIN_VISIT}`);
createRoot(document.getElementById('root')!).render(
  <MotionProvider>
    <DemoApp />
  </MotionProvider>,
);

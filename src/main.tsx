import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import App from '@/App';
import { AlertProvider } from '@/provider/AlertProvider';
import { ThemeProvider } from '@/provider/ThemeProvider';
import { HistoryProvider } from '@/provider/HistoryProvider';
import { EasterEggProvider } from '@/provider/EasterEggProvider';
import { AppProvider } from '@/provider/AppProvider';
import { AIProvider } from '@/provider/AIProvider';
import { TemplateProvider } from '@/provider/TemplateProvider';
import { RuleProvider } from '@/provider/RuleProvider';
import { FieldProvider } from '@/provider/FieldProvider';
import ErrorBoundary from '@/components/shared/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <EasterEggProvider>
            <HistoryProvider>
              <AlertProvider>
                <TemplateProvider>
                  <RuleProvider>
                    <FieldProvider>
                      <AIProvider>
                        <App />
                      </AIProvider>
                    </FieldProvider>
                  </RuleProvider>
                </TemplateProvider>
              </AlertProvider>
            </HistoryProvider>
          </EasterEggProvider>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
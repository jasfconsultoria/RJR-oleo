import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AppWrapper from '@/AppWrapper';
import '@/index.css';
import { AuthProvider } from '@/contexts/SupabaseAuthContext';
import { ProfileProvider } from '@/contexts/ProfileContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <AppWrapper />
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
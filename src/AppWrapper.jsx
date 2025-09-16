import React from 'react';
import App from '@/App';

// This wrapper is needed because App.jsx now uses useNavigate,
// which must be inside a <Router> component.
// main.jsx provides the <BrowserRouter>.
const AppWrapper = () => {
  return <App />;
};

export default AppWrapper;
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { walletConfig } from './lib/config';
import App from './App';
import '@fontsource-variable/dm-sans';
import './styles.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true } } });
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><WagmiProvider config={walletConfig}><QueryClientProvider client={queryClient}><App /></QueryClientProvider></WagmiProvider></React.StrictMode>,
);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@rainbow-me/rainbowkit/styles.css';
import './index.css'
import App from './App.tsx'

import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import {
  bsc, bscTestnet
} from 'wagmi/chains';
import {
  QueryClientProvider,
  QueryClient,
} from "@tanstack/react-query";

const config = getDefaultConfig({
  appName: 'Watch to Earn MAX Miner',
  projectId: import.meta.env.VITE_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [bsc, bscTestnet],
  ssr: false,
  // Metadata for better Telegram/Mobile deep-linking
  appDescription: 'Mine $MAX by watching ads in Telegram',
  appIcon: 'https://w2emaxminer.vercel.app/pickaxe.png', // Corrected path
  appUrl: 'https://w2emaxminer.vercel.app',
});

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_SEPOLIA_RPC?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

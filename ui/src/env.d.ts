/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}
/// <reference types="react" />
/// <reference types="react-dom" />

import type { ReactElement, ReactNode } from 'react';

declare global {
  /** Build-time constant injected by Vite; changes every build. */
  const __BUILD_ID__: string;

  namespace JSX {
    interface Element extends ReactElement<any, any> {}
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

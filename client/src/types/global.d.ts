declare module '*.css';

// Type declarations for importing static assets
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.jpeg' {
  const value: string;
  export default value;
}

declare module '*.gif' {
  const value: string;
  export default value;
}

declare module '*.webp' {
  const value: string;
  export default value;
}

declare module '*.ico' {
  const value: string;
  export default value;
}

declare module '*.json' {
  const value: any;
  export default value;
}

declare module '*.md' {
  const value: string;
  export default value;
}

declare module '*.csv' {
  const value: string;
  export default value;
}

declare module 'd3' {
  // 简化类型声明，假设 d3 在运行时可用
  export function forceSimulation(nodes?: any[]): any;
  export function forceLink(links?: any[]): any;
  export function forceManyBody(): any;
  export function forceCenter(x: number, y: number): any;
  export function forceCollide(): any;
  export function select(selector: any): any;
  export function zoom(): any;
  export const zoomIdentity: any;
  export function drag(): any;
}

declare module 'd3-force' {
  export function forceSimulation(nodes?: any[]): any;
  export function forceLink(links?: any[]): any;
  export function forceManyBody(): any;
  export function forceCenter(x: number, y: number): any;
  export function forceCollide(): any;
}

declare namespace React {
  export interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

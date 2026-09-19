/**
 * Minimal helpers for asserting on a React element tree returned by an
 * async Server Component (e.g. `await HomePage()`) without rendering it
 * — this repo has no React rendering test setup (no jsdom/testing-library;
 * see vitest.config.ts), and adding one is out of scope for a small
 * content change. A JSX element is just a plain `{ type, props }`
 * descriptor until rendered, so its text/href/component tree can be
 * walked directly.
 */

interface ElementLike {
  type?: unknown;
  props?: Record<string, unknown>;
}

function isElementLike(node: unknown): node is ElementLike {
  return typeof node === "object" && node !== null && "props" in node;
}

/** All string/number leaves in the tree, in document order (includes image `alt` text). */
export function collectText(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return out;
  }
  if (isElementLike(node)) {
    const alt = node.props?.alt;
    if (typeof alt === "string") out.push(alt);
    collectText(node.props?.children, out);
  }
  return out;
}

/** Every `href` prop found anywhere in the tree, in document order. */
export function collectHrefs(node: unknown, out: string[] = []): string[] {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectHrefs(child, out);
    return out;
  }
  if (isElementLike(node)) {
    const href = node.props?.href;
    if (typeof href === "string") out.push(href);
    collectHrefs(node.props?.children, out);
  }
  return out;
}

/** True if any element in the tree has the given component function as its `type`. */
export function usesComponent(node: unknown, component: unknown): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (Array.isArray(node)) {
    return node.some((child) => usesComponent(child, component));
  }
  if (isElementLike(node)) {
    if (node.type === component) return true;
    return usesComponent(node.props?.children, component);
  }
  return false;
}

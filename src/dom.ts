type Child = Node | string | number | boolean | null | undefined | readonly Child[];
type Attributes = Record<string, unknown>;
const attributes = new WeakMap<Element, Attributes>();

function setValue(element: Element, value: unknown) {
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) {
    const text = String(value ?? '');
    if (element.value !== text) element.value = text;
  }
}

function updateAttributes(element: Element, next: Attributes) {
  const previous = attributes.get(element) ?? {};
  for (const name of Object.keys(previous)) {
    if (!(name in next)) element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(next)) {
    if (name in previous && Object.is(previous[name], value)) continue;
    if (name.startsWith('on')) {
      Reflect.set(element, name.toLowerCase(), value);
    } else if (name === 'value' && !(element instanceof HTMLOptionElement)) {
      continue;
    } else if (name === 'disabled' || name === 'hidden' || name === 'open') {
      element.toggleAttribute(name, Boolean(value));
    } else if (value == null) {
      element.removeAttribute(name);
    } else if (element.getAttribute(name) !== String(value)) {
      element.setAttribute(name, String(value));
    }
  }
  attributes.set(element, next);
}

function append(element: Element, items: readonly Child[]) {
  for (const item of items) {
    if (Array.isArray(item)) append(element, item);
    else if (item instanceof Node) element.append(item);
    else if (typeof item === 'string' || typeof item === 'number') element.append(String(item));
  }
}

function create(element: Element, props: Attributes, children: readonly Child[]) {
  updateAttributes(element, props);
  append(element, children);
  if ('value' in props) setValue(element, props.value);
  return element;
}

export function h(tag: string, props: Attributes, children: readonly Child[] = []) {
  return create(document.createElement(tag), props, children);
}

export function svg(tag: string, props: Attributes, children: readonly Child[] = []) {
  return create(document.createElementNS('http://www.w3.org/2000/svg', tag), props, children);
}

const key = (node: Node) => node instanceof Element
  ? node.getAttribute('data-avs-key') ?? node.getAttribute('data-library-id')
  : null;

function matches(current: Node, next: Node) {
  return current.nodeName === next.nodeName && key(current) === key(next);
}

// Preserve inputs and the palette host across edits. VisuallyJS manages the canvas descendants.
function update(current: Node, next: Node) {
  if (current instanceof Element && next instanceof Element) {
    const props = attributes.get(next) ?? {};
    updateAttributes(current, props);
    const part = current.getAttribute('data-avs-part');
    if (part === null || part === 'palette') syncChildren(current, Array.from(next.childNodes));
    if ('value' in props) setValue(current, props.value);
  } else if (current.nodeValue !== next.nodeValue) {
    current.nodeValue = next.nodeValue;
  }
}

export function syncChildren(parent: Element, children: readonly Node[]) {
  const current = Array.from(parent.childNodes);
  let position = parent.firstChild;
  for (const next of children) {
    const index = key(next) === null
      ? current.findIndex(node => node === position && matches(node, next))
      : current.findIndex(node => matches(node, next));
    if (index === -1) {
      parent.insertBefore(next, position);
      continue;
    }
    const [existing] = current.splice(index, 1);
    if (existing !== position) parent.insertBefore(existing, position);
    update(existing, next);
    position = existing.nextSibling;
  }
  for (const node of current) node.remove();
}

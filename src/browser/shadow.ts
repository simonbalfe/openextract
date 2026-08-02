export function serializeRenderedPage(root: Document = document): string {
  const documentElement = root.documentElement;
  const prefix = "<!doctype html>\n";
  if (![...root.querySelectorAll("*")].some((element) => element.shadowRoot)) {
    return prefix + documentElement.outerHTML;
  }

  function clone(node: Node): Node {
    if (node.nodeType !== 1) return node.cloneNode(false);
    const element = node as Element;
    if (element.localName === "slot") {
      const fragment = root.createDocumentFragment();
      const assigned = (element as HTMLSlotElement).assignedNodes({ flatten: true });
      for (const child of assigned.length ? assigned : element.childNodes) {
        fragment.appendChild(clone(child));
      }
      return fragment;
    }
    const copy = element.cloneNode(false) as Element;
    for (const child of element.shadowRoot?.childNodes ?? element.childNodes) {
      copy.appendChild(clone(child));
    }
    return copy;
  }

  return prefix + (clone(documentElement) as Element).outerHTML;
}

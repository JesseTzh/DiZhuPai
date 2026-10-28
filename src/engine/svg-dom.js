// Keep live SVG nodes (including shared prints) across animation frames.
export function patchSvg(parent, markup) {
  const next = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  next.innerHTML = markup;
  const key = (node) =>
    node.nodeType === 1
      ? node.id || node.getAttribute('data-hand-index') || node.getAttribute('data-card')
      : null;
  const patch = (target, source) => {
    const children = [...target.childNodes],
      keyed = new Map(children.map((n) => [key(n), n]).filter(([k]) => k !== null));
    let cursor = target.firstChild;
    for (const desired of [...source.childNodes]) {
      const k = key(desired);
      let current = k === null ? cursor : keyed.get(k);
      if (
        !current ||
        current.nodeType !== desired.nodeType ||
        current.nodeName !== desired.nodeName
      ) {
        current = desired.cloneNode(true);
        target.insertBefore(current, cursor);
      } else {
        if (current !== cursor) target.insertBefore(current, cursor);
        if (current.nodeType === 1) {
          for (const a of [...current.attributes])
            if (!desired.hasAttribute(a.name)) current.removeAttribute(a.name);
          for (const a of desired.attributes)
            if (current.getAttribute(a.name) !== a.value) current.setAttribute(a.name, a.value);
          if (!current.isEqualNode(desired)) patch(current, desired);
        } else if (current.nodeValue !== desired.nodeValue) current.nodeValue = desired.nodeValue;
      }
      cursor = current.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  };
  patch(parent, next);
}

export const SVG_NS = 'http://www.w3.org/2000/svg';
export function svgElement(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name);
  setAttributes(element, attributes);
  return element;
}
export function setAttributes(element, attributes) {
  for (const [name, value] of Object.entries(attributes)) {
    const text = String(value);
    if (element.getAttribute(name) !== text) element.setAttribute(name, text);
  }
}

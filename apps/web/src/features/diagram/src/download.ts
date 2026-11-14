function save(name: string, href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}

export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  save(name, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const downloadDataUrl = (name: string, url: string): void => save(name, url);

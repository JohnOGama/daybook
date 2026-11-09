const COPY_SUFFIX = ' (copy)';
const MAX_TITLE_LENGTH = 200;

export function copyTitle(title: string): string {
  return `${title.slice(0, MAX_TITLE_LENGTH - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

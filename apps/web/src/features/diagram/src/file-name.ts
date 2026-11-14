// "Shop database" + "sql" gives "shop-database.sql".
export function fileName(title: string, extension: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'diagram'}.${extension}`;
}

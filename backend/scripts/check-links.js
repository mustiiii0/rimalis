const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../..');
const templatesRoot = path.join(repoRoot, 'frontend', 'templates');
const jsRoot = path.join(repoRoot, 'frontend', 'static', 'js');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function isExternal(href) {
  return href.startsWith('http://')
    || href.startsWith('https://')
    || href.startsWith('mailto:')
    || href.startsWith('tel:')
    || href.startsWith('javascript:');
}

function resolveTemplateHref(filePath, href) {
  const clean = href.split('#')[0].split('?')[0].trim();
  if (!clean) return null;
  if (isExternal(clean)) return null;
  if (clean.startsWith('/static/')) return path.join(repoRoot, 'frontend', clean);
  if (clean.startsWith('/templates/')) return path.join(repoRoot, 'frontend', clean);
  if (clean.startsWith('/')) return path.join(repoRoot, clean);
  return path.resolve(path.dirname(filePath), clean);
}

function collectHtmlLinkIssues() {
  const templateFiles = walk(templatesRoot).filter((f) => f.endsWith('.html'));
  const issues = [];

  for (const file of templateFiles) {
    const text = read(file);
    const hrefMatches = [...text.matchAll(/href\s*=\s*"([^"]+)"/gi)];

    for (const match of hrefMatches) {
      const href = String(match[1] || '').trim();
      if (!href) continue;
      if (href === '#') {
        issues.push({
          type: 'invalid-placeholder-link',
          file,
          href,
          message: 'Found href="#" placeholder. Use a real URL or a button.',
        });
        continue;
      }

      const target = resolveTemplateHref(file, href);
      if (!target) continue;

      const looksLikeHtml = href.includes('.html');
      if (looksLikeHtml && !fs.existsSync(target)) {
        issues.push({
          type: 'missing-template-link',
          file,
          href,
          message: `Linked page does not exist: ${target}`,
        });
      }
    }
  }

  return issues;
}

function collectJsTemplatePathIssues() {
  const jsFiles = walk(jsRoot).filter((f) => f.endsWith('.js'));
  const issues = [];

  for (const file of jsFiles) {
    const text = read(file);
    const matches = [...text.matchAll(/['"](\/templates\/[a-zA-Z0-9_\-\/]+\.html(?:\?[^'"\\]*)?)['"]/g)];
    for (const match of matches) {
      const rawPath = String(match[1] || '').trim();
      if (!rawPath) continue;
      const cleanPath = rawPath.split('?')[0];
      const target = path.join(repoRoot, 'frontend', cleanPath);
      if (!fs.existsSync(target)) {
        issues.push({
          type: 'missing-js-template-path',
          file,
          href: rawPath,
          message: `Template path in JS does not exist: ${target}`,
        });
      }
    }
  }

  return issues;
}

function main() {
  const issues = [
    ...collectHtmlLinkIssues(),
    ...collectJsTemplatePathIssues(),
  ];

  if (!issues.length) {
    console.log('Link check passed: no dead internal links or placeholder href="#" found.');
    process.exit(0);
  }

  console.error(`Link check failed with ${issues.length} issue(s):`);
  for (const issue of issues) {
    console.error(`- [${issue.type}] ${issue.file}`);
    console.error(`  href: ${issue.href}`);
    console.error(`  ${issue.message}`);
  }
  process.exit(1);
}

main();

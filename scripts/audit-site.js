#!/usr/bin/env node
'use strict';

// Static SEO/technical smoke audit for the sitemap-backed HTML site.
// Run with: npm run audit:site
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITE_HOSTS = new Set(['apexdigitalforge.in', 'www.apexdigitalforge.in']);
const errors = [];
const warnings = [];
const checked = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function exists(rel) {
  try { return fs.statSync(path.join(ROOT, rel)).isFile(); } catch { return false; }
}
function attrs(tag) {
  const out = {};
  const re = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return out;
}
function allTags(html, name) {
  return [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map(m => attrs(m[0]));
}
function firstMeta(html, key, value) {
  return allTags(html, 'meta').find(a => (a[key] || '').toLowerCase() === value.toLowerCase()) || {};
}
function cleanText(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function sourcePathForUrl(raw) {
  const u = new URL(raw);
  let route = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  if (!route) return 'index.html';
  const fixed = {
    blog: 'blog.html',
    services: 'services.html',
    'web-development': 'web-development.html',
    pricing: 'pricing.html',
    process: 'process.html',
    contact: 'contact.html',
    'learn-seo': 'learn-seo.html',
    'seo-audit': 'seo-audit.html'
  };
  if (fixed[route]) return fixed[route];
  if (route.startsWith('blog/')) return route + '.html';
  return route;
}
function localSourcePath(raw, baseUrl) {
  const u = new URL(raw, baseUrl);
  if (!SITE_HOSTS.has(u.hostname)) return null;
  let route = decodeURIComponent(u.pathname).replace(/^\/+|\/+$/g, '');
  if (!route) return 'index.html';
  if (route === 'robots.txt' || route === 'sitemap.xml' || route.endsWith('.txt')) return route;
  if (route.startsWith('assets/') || route.startsWith('css/') || route.startsWith('js/')) return route;
  if (route.endsWith('.html') || route.endsWith('.css') || route.endsWith('.js') || route.endsWith('.png') || route.endsWith('.jpg') || route.endsWith('.svg') || route.endsWith('.webp') || route.endsWith('.ico') || route.endsWith('.woff2')) return route;
  return sourcePathForUrl(u.href);
}
function report(level, url, message) {
  (level === 'error' ? errors : warnings).push({ url, message });
}
function normalizePath(p) {
  const decoded = decodeURIComponent(p || '/').replace(/\/+$/, '') || '/';
  return decoded;
}

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>\s*(.*?)\s*<\/loc>/gi)].map(m => m[1].trim());
if (!sitemapUrls.length) {
  console.error('ERROR: sitemap.xml contains no <loc> URLs.');
  process.exit(1);
}
const seenUrls = new Set();
for (const url of sitemapUrls) {
  if (seenUrls.has(url)) report('error', url, 'Duplicate URL in sitemap.');
  seenUrls.add(url);
}
const routeToCanonical = new Map();
for (const url of sitemapUrls) {
  try {
    const u = new URL(url);
    if (!SITE_HOSTS.has(u.hostname)) report('error', url, 'Sitemap URL uses an unexpected hostname.');
    const route = normalizePath(u.pathname);
    if (routeToCanonical.has(route)) report('error', url, 'Multiple sitemap URLs resolve to the same route.');
    routeToCanonical.set(route, url);
  } catch {
    report('error', url, 'Invalid URL in sitemap.');
  }
}

for (const url of sitemapUrls) {
  let file;
  try { file = sourcePathForUrl(url); } catch {
    report('error', url, 'Could not map sitemap URL to a source file.');
    continue;
  }
  if (!exists(file)) {
    report('error', url, 'Sitemap URL has no matching source file: ' + file);
    continue;
  }
  const html = read(file);
  const title = cleanText((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = firstMeta(html, 'name', 'description').content || '';
  const canonical = allTags(html, 'link').find(a => (a.rel || '').toLowerCase().split(/\s+/).includes('canonical'))?.href || '';
  const ogTitle = firstMeta(html, 'property', 'og:title').content || '';
  const twitterTitle = firstMeta(html, 'name', 'twitter:title').content || '';
  const h1Count = (html.match(/<h1\b/gi) || []).length;

  if (!title) report('error', url, 'Missing or empty <title>.');
  else if (title.length > 70) report('warning', url, 'Title exceeds 70 characters (' + title.length + ').');
  if (!description.trim()) report('error', url, 'Missing or empty meta description.');
  else if (description.trim().length < 70 || description.trim().length > 170) report('warning', url, 'Meta description length is ' + description.trim().length + ' characters (review 70–170).');
  if (!canonical) report('error', url, 'Missing canonical link.');
  else {
    try {
      const actual = new URL(canonical, url);
      const expected = new URL(url);
      if (!SITE_HOSTS.has(actual.hostname)) report('error', url, 'Canonical uses an unexpected hostname: ' + actual.hostname);
      if (normalizePath(actual.pathname) !== normalizePath(expected.pathname)) report('error', url, 'Canonical path does not match the sitemap URL: ' + canonical);
      if (actual.search || actual.hash) report('warning', url, 'Canonical includes a query string or fragment.');
    } catch { report('error', url, 'Invalid canonical URL: ' + canonical); }
  }
  if (!ogTitle.trim()) report('error', url, 'Missing Open Graph title.');
  if (!twitterTitle.trim()) report('error', url, 'Missing Twitter title.');
  if (h1Count === 0) report('warning', url, 'No H1 heading found.');
  if (h1Count > 1) report('warning', url, 'Multiple H1 headings found (' + h1Count + ').');

  const jsonLdBlocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (let i = 0; i < jsonLdBlocks.length; i++) {
    try { JSON.parse(jsonLdBlocks[i][1]); }
    catch { report('error', url, 'Invalid JSON-LD in schema block #' + (i + 1) + '.'); }
  }

  // Check local links and assets in the original HTML source. Ignore mailto:, tel:, data: and JS links.
  for (const a of allTags(html, 'a')) {
    if (!a.href || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(a.href)) continue;
    let target;
    try { target = localSourcePath(a.href, url); } catch { continue; }
    if (target && !exists(target)) report('error', url, 'Broken local link target "' + a.href + '" maps to missing file "' + target + '".');
  }
  for (const tagName of ['img', 'script', 'link', 'source']) {
    for (const a of allTags(html, tagName)) {
      const raw = tagName === 'link' ? a.href : a.src;
      if (!raw || /^(?:https?:|data:|\/\/|#|mailto:|tel:)/i.test(raw)) continue;
      let target;
      try { target = localSourcePath(raw, url); } catch { continue; }
      if (target && !exists(target)) report('error', url, 'Missing local ' + tagName + ' asset "' + raw + '" maps to "' + target + '".');
    }
  }
  checked.push({ url, file });
}

const byMessage = (a, b) => a.url.localeCompare(b.url) || a.message.localeCompare(b.message);
errors.sort(byMessage);
warnings.sort(byMessage);
console.log('Apex Digital Forge static SEO audit');
console.log('Sitemap URLs: ' + sitemapUrls.length + ' | Pages inspected: ' + checked.length);
console.log('Errors: ' + errors.length + ' | Warnings: ' + warnings.length);
for (const item of errors) console.log('ERROR [' + item.url + '] ' + item.message);
for (const item of warnings) console.log('WARN  [' + item.url + '] ' + item.message);
if (errors.length) process.exitCode = 1;
else console.log('PASS: no blocking structural issues detected.');

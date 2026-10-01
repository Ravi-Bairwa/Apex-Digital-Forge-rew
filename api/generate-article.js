// /api/generate-article.js
// Admin-only endpoint: publishes a supplied article into the GitHub repo.
// Requires Vercel environment variables ADMIN_SECRET and GITHUB_TOKEN.

const GITHUB_OWNER = 'Ravi-Bairwa';
const GITHUB_REPO = 'Apex-Digital-Forge-rew';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`;
const TEMPLATE_PATH = 'blog/ai-seo-2026.html';

const CATEGORY_EMOJI = {
  'Link Building': '🔗',
  'SEO Strategy': '📈',
  'Agency Growth': '🚀',
  'AI & Automation': '🤖',
  'Case Study': '📊'
};
const VALID_CATEGORIES = Object.keys(CATEGORY_EMOJI);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('ADMIN_SECRET is not set in environment variables');
    res.status(500).json({ error: 'Server not configured.' });
    return;
  }
  if (req.headers['x-admin-key'] !== adminSecret) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const body = req.body || {};
    const title = (body.title || '').toString().trim();
    const category = (body.category || '').toString().trim();
    const rawContent = (body.content || '').toString().trim();
    let metaDescription = (body.metaDescription || '').toString().trim();

    if (!title || title.length < 5 || title.length > 150) {
      res.status(400).json({ error: 'Title must be between 5 and 150 characters.' });
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: 'Invalid category.' });
      return;
    }
    if (!rawContent || rawContent.length < 50) {
      res.status(400).json({ error: 'Content is too short - paste the full article.' });
      return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('Missing GITHUB_TOKEN');
      res.status(500).json({ error: 'Server not configured.' });
      return;
    }

    const articleHtml = textToHtml(rawContent);
    if (!metaDescription) metaDescription = deriveExcerpt(rawContent, 155);

    const existingSlugs = await listExistingSlugs(githubToken);
    const slug = uniqueSlug(slugify(title), existingSlugs);

    const now = new Date();
    const dateStr = formatDate(now);
    const dateIso = now.toISOString().substring(0, 10);
    const readTime = estimateReadTime(articleHtml);
    const excerpt = deriveExcerpt(metaDescription || rawContent, 140);
    const emoji = CATEGORY_EMOJI[category];

    const template = await ghGet(TEMPLATE_PATH, githubToken);
    const newPageHtml = buildArticlePage(template.content, {
      slug, title, metaDescription, category, dateStr, dateIso, readTime, articleHtml
    });
    await ghPut(`blog/${slug}.html`, newPageHtml, null,
      `Publish new article: ${title}`, githubToken);

    const blogHtml = await ghGet('blog.html', githubToken);
    const updatedBlogHtml = insertBlogCard(blogHtml.content, {
      slug, title, category, excerpt, emoji, dateStr, readTime
    });
    await ghPut('blog.html', updatedBlogHtml, blogHtml.sha,
      `Add blog card for: ${title}`, githubToken);

    const vercelJson = await ghGet('vercel.json', githubToken);
    const updatedVercelJson = addRewrite(vercelJson.content, slug);
    await ghPut('vercel.json', updatedVercelJson, vercelJson.sha,
      `Add rewrite for /blog/${slug}`, githubToken);

    const sitemap = await ghGet('sitemap.xml', githubToken);
    const updatedSitemap = addSitemapEntry(sitemap.content, slug);
    await ghPut('sitemap.xml', updatedSitemap, sitemap.sha,
      `Add sitemap entry for /blog/${slug}`, githubToken);

    res.status(200).json({
      success: true,
      slug,
      url: `/blog/${slug}`,
      message: 'Published. Vercel is redeploying now - live in about 30-60 seconds.'
    });
  } catch (err) {
    console.error('generate-article error:', err);
    res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
};

function textToHtml(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const htmlParts = [];
  let listBuffer = [];

  function flushList() {
    if (listBuffer.length) {
      htmlParts.push('<ul>' + listBuffer.map(function(li) {
        return '<li>' + inlineFormat(li) + '</li>';
      }).join('') + '</ul>');
      listBuffer = [];
    }
  }

  let paragraphBuffer = [];
  function flushParagraph() {
    if (paragraphBuffer.length) {
      htmlParts.push('<p>' + inlineFormat(paragraphBuffer.join(' ')) + '</p>');
      paragraphBuffer = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushParagraph(); flushList(); continue; }

    if (/^###\s+/.test(line)) {
      flushParagraph(); flushList();
      htmlParts.push('<h3>' + inlineFormat(line.replace(/^###\s+/, '')) + '</h3>');
    } else if (/^##\s+/.test(line)) {
      flushParagraph(); flushList();
      htmlParts.push('<h2>' + inlineFormat(line.replace(/^##\s+/, '')) + '</h2>');
    } else if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listBuffer.push(line.replace(/^[-*]\s+/, ''));
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();
  return htmlParts.join('\n');
}

function inlineFormat(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return out;
}

function deriveExcerpt(text, maxLen) {
  const plain = text.replace(/<[^>]+>/g, ' ').replace(/[#*]/g, '').replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  return plain.substring(0, maxLen - 1).replace(/\s+\S*$/, '') + '…';
}

async function ghGet(path, token) {
  const resp = await fetch(`${GITHUB_API}/contents/${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'apex-digital-forge-admin'
    }
  });
  if (!resp.ok) throw new Error(`GitHub GET ${path} failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function ghPut(path, content, sha, message, token) {
  const payload = {
    message,
    content: Buffer.from(content, 'utf-8').toString('base64'),
    branch: 'main'
  };
  if (sha) payload.sha = sha;
  const resp = await fetch(`${GITHUB_API}/contents/${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'apex-digital-forge-admin'
    },
    body: JSON.stringify(payload)
  });
  if (!resp.ok) throw new Error(`GitHub PUT ${path} failed: ${resp.status} ${await resp.text()}`);
  return await resp.json();
}

async function listExistingSlugs(token) {
  const resp = await fetch(`${GITHUB_API}/contents/blog`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'apex-digital-forge-admin'
    }
  });
  if (!resp.ok) throw new Error(`GitHub list blog/ failed: ${resp.status}`);
  const items = await resp.json();
  return items
    .filter(function(it) { return it.type === 'file' && it.name.endsWith('.html'); })
    .map(function(it) { return it.name.replace(/\.html$/, ''); });
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 70)
    .replace(/-+$/, '');
}

function uniqueSlug(base, existing) {
  if (!existing.includes(base)) return base;
  var i = 2;
  while (existing.includes(base + '-' + i)) i++;
  return base + '-' + i;
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function estimateReadTime(html) {
  const text = html.replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200)) + ' min read';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildArticlePage(templateHtml, data) {
  const url = `https://www.apexdigitalforge.in/blog/${data.slug}`;
  let html = templateHtml;

  // Use generic replacements so generated pages do not depend on stale
  // hard-coded values from the template article.
  html = html.replace(/<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(data.title)} | Apex Digital Forge</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(data.metaDescription)}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${escapeHtml(data.title)} | Apex Digital Forge">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escapeHtml(data.metaDescription)}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${url}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*" id="canonical-tag">/,
    `<link rel="canonical" href="${url}" id="canonical-tag">`);
  html = html.replace(/<div class="article-cat">[\s\S]*?<\/div>/,
    `<div class="article-cat">${escapeHtml(data.category)}</div>`);
  html = html.replace(/<h1 class="article-title">[\s\S]*?<\/h1>/,
    `<h1 class="article-title">${escapeHtml(data.title)}</h1>`);
  html = html.replace(
    /<div class="article-meta"><span>Ravi Bairwa<\/span><span>[^<]*<\/span><span>[^<]*<\/span><\/div>/,
    `<div class="article-meta"><span>Ravi Bairwa</span><span>${data.dateStr}</span><span>${data.readTime}</span></div>`
  );

  // Synchronize BlogPosting structured data with the generated page.
  const schemaMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!schemaMatch) throw new Error('Could not locate JSON-LD schema block in template.');

  let schema;
  try {
    schema = JSON.parse(schemaMatch[1]);
  } catch (err) {
    throw new Error('Template JSON-LD schema is invalid: ' + err.message);
  }

  const schemaItems = Array.isArray(schema) ? schema : [schema];
  const blogPosting = schemaItems.find(function(item) {
    return item && item['@type'] === 'BlogPosting';
  });
  if (!blogPosting) throw new Error('Could not locate BlogPosting schema in template.');

  blogPosting.headline = data.title;
  blogPosting.description = data.metaDescription;
  blogPosting.url = url;
  blogPosting.datePublished = data.dateIso;
  blogPosting.dateModified = data.dateIso;
  blogPosting.author = { '@type': 'Person', name: 'Ravi Bairwa' };
  blogPosting.publisher = {
    '@type': 'Organization',
    name: 'Apex Digital Forge',
    logo: {
      '@type': 'ImageObject',
      url: 'https://www.apexdigitalforge.in/assets/favicon-192.png'
    }
  };
  blogPosting.mainEntityOfPage = { '@type': 'WebPage', '@id': url };

  const updatedSchema = JSON.stringify(schema, null, 2);
  html = html.replace(schemaMatch[0], `<script type="application/ld+json">\n${updatedSchema}\n</script>`);

  const bodyStart = html.indexOf('<div class="article-body">');
  const bodyCloseMarker = '\n    </div>\n  </section>';
  const bodyCloseIdx = html.indexOf(bodyCloseMarker, bodyStart);
  if (bodyStart === -1 || bodyCloseIdx === -1) {
    throw new Error('Could not locate article-body markers in template.');
  }
  const before = html.substring(0, bodyStart + '<div class="article-body">'.length);
  const after = html.substring(bodyCloseIdx);
  html = before + '\n' + data.articleHtml + after;

  return html;
}

function insertBlogCard(blogHtml, data) {
  const marker = '<div class="blog-grid" id="blogGrid">';
  const idx = blogHtml.indexOf(marker);
  if (idx === -1) throw new Error('Could not locate blogGrid marker in blog.html');
  const insertAt = idx + marker.length;
  const card = `
        <div class="blog-card" onclick="window.location.href='/blog/${data.slug}'" style="cursor:pointer;">
          <div class="blog-card-img">${data.emoji}</div>
          <div class="blog-card-body">
            <div class="blog-card-cat">${escapeHtml(data.category)}</div>
            <a class="blog-card-title" href="/blog/${data.slug}" style="text-decoration:none;color:inherit;display:block;">${escapeHtml(data.title)}</a>
            <div class="blog-card-excerpt">${escapeHtml(data.excerpt)}</div>
            <div class="blog-card-meta"><span>Apex Digital Forge</span><span>${data.dateStr}</span><span>${data.readTime}</span></div>
          </div>
        </div>
`;
  return blogHtml.slice(0, insertAt) + card + blogHtml.slice(insertAt);
}

function addRewrite(vercelJsonText, slug) {
  const parsed = JSON.parse(vercelJsonText);
  const rewrites = parsed.rewrites || [];
  const entry = { source: `/blog/${slug}`, destination: `/blog/${slug}.html` };
  const exists = rewrites.some(function(r) { return r.source === entry.source; });
  if (!exists) {
    const blogIdx = rewrites.findIndex(function(r) { return r.source === '/blog'; });
    if (blogIdx !== -1) rewrites.splice(blogIdx + 1, 0, entry);
    else rewrites.push(entry);
  }
  parsed.rewrites = rewrites;
  return JSON.stringify(parsed, null, 2) + '\n';
}

function addSitemapEntry(sitemapText, slug) {
  const today = new Date().toISOString().substring(0, 10);
  const loc = `https://www.apexdigitalforge.in/blog/${slug}`;
  if (sitemapText.includes(`<loc>${loc}</loc>`)) return sitemapText;
  const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
  return sitemapText.replace('</urlset>', entry + '</urlset>');
}

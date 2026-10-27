#!/usr/bin/env python3
"""Import a partner's spreadsheet into the guest post catalog.

Usage:  python3 scripts/import_partner_sheet.py <file.xlsx> <partner_number>

Columns expected: Websites URL, DA, PA, DR, Traffic, Link Type, Categories, Our Prices, Discounted Price.
- Public catalog   : data/guest-sites.json  (what customers see; NO partner info)
- Private mapping  : api/_partners.json     (server only: which partner supplies each site + partner price)
Rows for sites already in the catalog (same domain) are skipped, so re-running or adding a second partner file is safe.
"""
import sys, re, json, os, openpyxl

FIX = {'eletronics': 'Electronics', 'homw': 'Home', 'tech': 'Technology', 'technology': 'Technology'}
LINK = {'do follow': 'dofollow', 'dofollow': 'dofollow', 'no follow': 'nofollow', 'nofollow': 'nofollow', 'mix': 'mixed', 'mixed': 'mixed'}

def dom(u):
    u = re.sub(r'^https?://', '', str(u).strip().lower()); u = re.sub(r'^www\.', '', u)
    return u.split('/')[0].strip()
def num(x):
    m = re.search(r'[\d.]+', str(x)); return float(m.group(0)) if m else None
def traffic(x):
    s = str(x).strip().lower().replace(',', '')
    m = re.match(r'^(\d+(?:\.\d+)?)\s*([km]?)$', s)
    if not m: return None  # unreadable in the sheet: shown as "-" and reported, never guessed
    return int(round(float(m.group(1)) * {'': 1, 'k': 1e3, 'm': 1e6}[m.group(2)]))
def cats(x):
    out = []
    for c in str(x or '').split(','):
        c = c.strip()
        if not c: continue
        c = FIX.get(c.lower(), c.title() if c.islower() else c)
        if c not in out: out.append(c)
    return out or ['General']

def main(path, partner):
    here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
    pub_path = os.path.join(root, 'data', 'guest-sites.json'); prv_path = os.path.join(root, 'api', '_partners.json')
    pub = json.load(open(pub_path, encoding='utf-8'))
    prv = json.load(open(prv_path, encoding='utf-8')) if os.path.exists(prv_path) else {'sites': {}}
    have = {s['name'] for s in pub['sites']}
    ws = openpyxl.load_workbook(path, data_only=True).active
    added, skipped = 0, []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not any(r): continue
        name = dom(r[0]); price = num(r[7])
        if not name or not price: skipped.append((name, 'missing price')); continue
        if name in have: skipped.append((name, 'duplicate domain (kept first)')); continue
        sid = re.sub(r'[^a-z0-9]+', '-', name).strip('-')
        link = LINK.get(str(r[5]).strip().lower())
        if not link: skipped.append((name, 'unknown link type %r' % r[5])); continue
        tr = traffic(r[4])
        if tr is None: skipped.append((name, 'traffic %r unreadable, left blank' % r[4]))
        pub['sites'].append({'id': sid, 'name': name, 'da': int(r[1] or 0), 'pa': int(r[2] or 0), 'dr': int(r[3] or 0),
                             'traffic': tr, 'niches': cats(r[6]), 'link': link, 'priceUSD': price})
        prv['sites'][sid] = {'partner': int(partner), 'partnerPrice': num(r[8])}
        have.add(name); added += 1
    pub['sites'].sort(key=lambda s: (-s['da'], s['name']))
    json.dump(pub, open(pub_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(prv, open(prv_path, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('added', added, '| skipped', len(skipped)); [print('  skipped:', s) for s in skipped]

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

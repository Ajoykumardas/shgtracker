"""
Rebuild public/members.json and public/hierarchy_summary.json from a new
member master export (xlsx) for the eKYC & Phone Verification tab.

Rules:
  - Every row in the new export is included (it is the new source of truth).
  - Reasons are saved against the member code. Rows without a member code
    ("-" / 0) get a reason key "rk" built from their details instead:
      NC|VILLAGE|SHG NAME|MEMBER NAME|DOB|RELATION|DATE OF JOINING
  - A member from the previous members.json that is NOT in the new export is
    kept only if a reason has been saved for them, so their tagging stays visible.
  - If a member who had no code (reason saved under an NC| key) now has a member
    code, the reason is written to data/reason_migration.json so it can be moved:
      DATABASE_URL=... node scripts/import-backup.js data/reason_migration.json
  - eBK mobile isn't in the export; it is filled from the previous data by eBK ID.

Usage (from the repo root, in WSL):
  python3 scripts/build_members.py data/aadhar_01.xlsx
  python3 scripts/build_members.py data/aadhar_01.xlsx --reasons backup.json --dry-run

--reasons accepts the live /api/reasons URL (default), a saved /api/reasons
response, or an /api/backup file.
"""
import argparse, datetime, json, re, sys, urllib.request
from collections import Counter
import openpyxl

LIVE_REASONS = 'https://shgtracker.onrender.com/api/reasons'
MEMBERS = 'public/members.json'
HIERARCHY = 'public/hierarchy_summary.json'
MIGRATION = 'data/reason_migration.json'
NC_PREFIX = 'NC|'

COLUMNS = {  # members.json key -> export column header
    'gp': 'Gram Panchayat', 'vil': 'Village', 'sc': 'SHG Code', 'sn': 'SHG Name',
    'mc': 'Member Code', 'mn': 'Member Name', 'ekyc': 'eKYC', 'akyc': 'Aadhaar KYC',
    'pvf': 'Phone Verified', 'ebkid': 'eBK ID', 'ebkn': 'eBK Name',
    'appst': 'Approval Status', 'st': 'Status (Active/Inactive)',
}
KEY_COLUMNS = {'dob': 'Date of Birth', 'rel': 'Relation', 'doj': 'Date of Joining in SHG'}
KEEP_FIELDS = list(COLUMNS) + ['ebkm', 'rk', 'dob', 'rel']

def is_member_code(code):
    return bool(re.fullmatch(r'\d{12}', code or ''))

def is_reason_key(key):
    return is_member_code(key) or (key or '').startswith(NC_PREFIX)

def text(v):
    return '-' if v is None else str(v).strip()

def norm(v):
    return ' '.join(text(v).split()).upper()

def as_date(v):
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.strftime('%Y-%m-%d')
    return norm(v)

def as_bool(v):
    return v is True or str(v).strip().upper() == 'TRUE'

def reason_key(m):
    return m.get('mc') or m.get('rk') or ''

def load_reasons(src):
    if re.match(r'https?://', src):
        data = json.load(urllib.request.urlopen(src, timeout=120))
    else:
        data = json.load(open(src, encoding='utf-8'))
    data = data.get('reasons', data)  # accept an /api/backup file too
    return {k: v for k, v in data.items() if is_reason_key(k) and v.get('reason')}

def read_export(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [text(h) for h in next(rows)]
    missing = [c for c in list(COLUMNS.values()) + list(KEY_COLUMNS.values()) if c not in header]
    if missing:
        sys.exit(f'Export is missing columns: {missing}')
    idx = {k: header.index(c) for k, c in COLUMNS.items()}
    kidx = {k: header.index(c) for k, c in KEY_COLUMNS.items()}
    out = []
    for r in rows:
        if all(v is None for v in r):
            continue
        m = {k: text(r[i]) for k, i in idx.items()}
        m['pvf'] = as_bool(r[idx['pvf']])
        m['sc'] = m['sc'].zfill(11) if m['sc'].isdigit() else m['sc']
        dob, rel, doj = as_date(r[kidx['dob']]), r[kidx['rel']], as_date(r[kidx['doj']])
        # Identity from the member's details; used as the reason key when there is no member code
        m['_nc'] = NC_PREFIX + '|'.join([norm(m['vil']), norm(m['sn']), norm(m['mn']), dob, norm(rel), doj])
        if not is_member_code(m['mc']):
            m['mc'] = ''
            m['rk'] = m['_nc']
            m['dob'] = dob
            m['rel'] = text(rel)
        out.append(m)
    return out

def status_bucket(m):
    ekyc = m['ekyc'].lower() == 'yes'
    if ekyc and m['pvf']: return 'fully_verified'
    if ekyc: return 'phone_pending'
    if m['pvf']: return 'ekyc_pending'
    return 'both_pending'

def build_hierarchy(members):
    def counts():
        return {'total': 0, 'active': 0, 'both_pending': 0, 'ekyc_pending': 0, 'phone_pending': 0, 'fully_verified': 0}
    h = {}
    for m in members:
        gp = h.setdefault(m['gp'], {'name': m['gp'], **counts(), 'villages': {}})
        vil = gp['villages'].setdefault(m['vil'], {'name': m['vil'], **counts(), 'shgs': {}})
        shg = vil['shgs'].setdefault(m['sc'], {'code': m['sc'], 'name': m['sn'],
                                               'ebk_name': m['ebkn'], 'ebk_mobile': m['ebkm'], **counts()})
        for node in (gp, vil, shg):
            node['total'] += 1
            if m['st'] == 'ACTIVE':
                node['active'] += 1
                node[status_bucket(m)] += 1
    return h

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('xlsx')
    ap.add_argument('--reasons', default=LIVE_REASONS)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    old = json.load(open(MEMBERS, encoding='utf-8'))
    reasons = load_reasons(args.reasons)
    new = read_export(args.xlsx)

    ebk_mobile = {}
    for m in old:
        if m.get('ebkid') not in (None, '', '-') and m.get('ebkm') not in (None, '', '-'):
            ebk_mobile.setdefault(m['ebkid'], m['ebkm'])
    for m in new:
        m['ebkm'] = ebk_mobile.get(m['ebkid'], '-')

    dup = [k for k, n in Counter(reason_key(m) for m in new).items() if n > 1]
    if dup:
        sys.exit(f'Duplicate member codes / member details in export: {dup[:10]}')
    new_keys = {reason_key(m) for m in new}

    # Members who had no code before but have one now: move their reason to the code
    # (a reason already saved under the new code wins and is left alone)
    migrate, migrated_nc = {}, set()
    for m in new:
        nc = m.pop('_nc')
        if m['mc'] and nc in reasons and nc not in new_keys:
            migrated_nc.add(nc)
            if m['mc'] not in reasons:
                migrate[m['mc']] = reasons[nc]

    kept = []
    for m in old:
        key = reason_key(m)
        if key in reasons and key not in new_keys and key not in migrated_nc:
            kept.append({k: m[k] for k in KEEP_FIELDS if k in m} | {'pvf': bool(m.get('pvf')), 'prev': True})
    kept_keys = {reason_key(m) for m in kept}

    members = new + kept
    covered = {k for k in reasons if k in new_keys or k in kept_keys or k in migrated_nc}

    print(f'Export rows:                 {len(new)}  (no member code: {sum(not m["mc"] for m in new)}, given a details-based reason key)')
    print(f'Kept from previous (reason): {len(kept)}  (ACTIVE: {sum(m["st"] == "ACTIVE" for m in kept)})')
    print(f'Total members:               {len(members)}  (was {len(old)})')
    print(f'Saved reasons:               {len(reasons)}  -> attached to a member: {len(covered)}'
          f'  (by member code: {sum(not k.startswith(NC_PREFIX) for k in covered)}, by details: {sum(k.startswith(NC_PREFIX) for k in covered)})')
    print(f'eBK mobile filled:           {sum(m["ebkm"] != "-" for m in new)} of {sum(m["ebkid"] != "-" for m in new)} rows with an eBK ID')
    if migrate:
        print(f'Members who now have a code: {len(migrate)} reason(s) to move -> {MIGRATION}')
    lost = set(reasons) - covered
    if lost:
        sys.exit(f'{len(lost)} saved reason(s) would lose their member — aborting: {sorted(lost)[:5]}')

    if args.dry_run:
        print('Dry run — nothing written.')
        return
    with open(MEMBERS, 'w', encoding='utf-8') as f:
        json.dump(members, f, ensure_ascii=False, separators=(',', ':'))
    with open(HIERARCHY, 'w', encoding='utf-8') as f:
        json.dump(build_hierarchy(members), f, ensure_ascii=False, separators=(',', ':'))
    print(f'Wrote {MEMBERS} and {HIERARCHY}')
    if migrate:
        with open(MIGRATION, 'w', encoding='utf-8') as f:
            json.dump({'reasons': migrate}, f, ensure_ascii=False, indent=2)
        print(f'Wrote {MIGRATION} — import it with: DATABASE_URL=... node scripts/import-backup.js {MIGRATION}')

if __name__ == '__main__':
    main()

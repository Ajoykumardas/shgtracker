"""
Rebuild public/members.json and public/hierarchy_summary.json from a new
member master export (xlsx) for the eKYC & Phone Verification tab.

Rules:
  - Every row in the new export is included (it is the new source of truth).
    Rows without a member code ("-" / 0) are kept with mc="" — the app shows
    them but does not allow a reason to be recorded.
  - A member from the previous members.json that is NOT in the new export is
    kept only if a reason has been saved for them, so their tagging stays visible.
  - eBK mobile isn't in the export; it is filled from the previous data by eBK ID.

Usage (from the repo root, in WSL):
  python3 scripts/build_members.py data/aadhar_01.xlsx
  python3 scripts/build_members.py data/aadhar_01.xlsx --reasons backup.json --dry-run

--reasons accepts the live /api/reasons URL (default), a saved /api/reasons
response, or an /api/backup file.
"""
import argparse, json, re, sys, urllib.request
from collections import Counter
import openpyxl

LIVE_REASONS = 'https://shgtracker.onrender.com/api/reasons'
MEMBERS = 'public/members.json'
HIERARCHY = 'public/hierarchy_summary.json'

COLUMNS = {  # members.json key -> export column header
    'gp': 'Gram Panchayat', 'vil': 'Village', 'sc': 'SHG Code', 'sn': 'SHG Name',
    'mc': 'Member Code', 'mn': 'Member Name', 'ekyc': 'eKYC', 'akyc': 'Aadhaar KYC',
    'pvf': 'Phone Verified', 'ebkid': 'eBK ID', 'ebkn': 'eBK Name',
    'appst': 'Approval Status', 'st': 'Status (Active/Inactive)',
}

def is_member_code(code):
    return bool(re.fullmatch(r'\d{12}', code or ''))

def text(v):
    return '-' if v is None else str(v).strip()

def as_bool(v):
    return v is True or str(v).strip().upper() == 'TRUE'

def load_reasons(src):
    if re.match(r'https?://', src):
        data = json.load(urllib.request.urlopen(src, timeout=120))
    else:
        data = json.load(open(src, encoding='utf-8'))
    data = data.get('reasons', data)  # accept an /api/backup file too
    return {k for k, v in data.items() if is_member_code(k) and v.get('reason')}

def read_export(path):
    ws = openpyxl.load_workbook(path, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    header = [text(h) for h in next(rows)]
    missing = [c for c in COLUMNS.values() if c not in header]
    if missing:
        sys.exit(f'Export is missing columns: {missing}')
    idx = {k: header.index(c) for k, c in COLUMNS.items()}
    out = []
    for r in rows:
        if all(v is None for v in r):
            continue
        m = {k: text(r[i]) for k, i in idx.items()}
        m['pvf'] = as_bool(r[idx['pvf']])
        m['sc'] = m['sc'].zfill(11) if m['sc'].isdigit() else m['sc']
        if not is_member_code(m['mc']):
            m['mc'] = ''
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

    new_codes = {m['mc'] for m in new if m['mc']}
    dup = [c for c, n in Counter(m['mc'] for m in new if m['mc']).items() if n > 1]
    if dup:
        sys.exit(f'Duplicate member codes in export: {dup[:10]}')

    kept = []
    for m in old:
        if is_member_code(m['mc']) and m['mc'] not in new_codes and m['mc'] in reasons:
            kept.append({k: m.get(k, '-') for k in list(COLUMNS) + ['ebkm']} | {'pvf': bool(m.get('pvf')), 'prev': True})

    members = new + kept
    covered = sum(c in new_codes for c in reasons) + len(kept)

    print(f'Export rows:                 {len(new)}  (no member code: {sum(not m["mc"] for m in new)})')
    print(f'Kept from previous (reason): {len(kept)}  (ACTIVE: {sum(m["st"] == "ACTIVE" for m in kept)})')
    print(f'Total members:               {len(members)}  (was {len(old)})')
    print(f'Saved reasons:               {len(reasons)}  -> attached to a member: {covered}')
    print(f'eBK mobile filled:           {sum(m["ebkm"] != "-" for m in new)} of {sum(m["ebkid"] != "-" for m in new)} rows with an eBK ID')
    if covered != len(reasons):
        sys.exit('Some saved reasons would lose their member — aborting.')

    if args.dry_run:
        print('Dry run — nothing written.')
        return
    with open(MEMBERS, 'w', encoding='utf-8') as f:
        json.dump(members, f, ensure_ascii=False, separators=(',', ':'))
    with open(HIERARCHY, 'w', encoding='utf-8') as f:
        json.dump(build_hierarchy(members), f, ensure_ascii=False, separators=(',', ':'))
    print(f'Wrote {MEMBERS} and {HIERARCHY}')

if __name__ == '__main__':
    main()

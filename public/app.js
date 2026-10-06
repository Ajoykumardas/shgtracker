/**
 * Clean & Direct SHG Member Verification & Cutoff Tracker
 */

// The reason dropdown is built from this list
const REASON_OPTIONS = [
  { value: '', label: '-- Select Reason --' },
  { value: 'Outstation', label: 'Outstation (Currently not present in the Village or District)' },
  { value: 'Wrong Aadhaar Entry in lokOS', label: 'Wrong Entry in lokOS Aadhaar (wrong Aadhaar number entered)' },
  { value: 'Left SHG / Reluctant', label: 'Member Left SHG / Unwilling / Reluctant' }
];

// Saved values that were renamed; mapped to the current value when reasons load
const REASON_ALIASES = {
  'Aadhaar Demographic Mismatch': 'Wrong Aadhaar Entry in lokOS'
};

// Retired options ("Migrated", "Other") stay saved and visible, but can't be newly selected
function isCurrentReason(value) {
  return REASON_OPTIONS.some(o => o.value && o.value === value);
}

function normalizeSavedReasons(reasons) {
  Object.values(reasons).forEach(r => {
    if (r && REASON_ALIASES[r.reason]) r.reason = REASON_ALIASES[r.reason];
  });
  return reasons;
}

function describeReason(saved) {
  return saved.reason === 'Other' && saved.remarks ? `Other: ${saved.remarks}` : saved.reason;
}

const CUTOFF_DATES = [
  '12.08.2026',
  '13.08.2026',
  '14.08.2026',
  '15.08.2026',
  '16.08.2026',
  '17.08.2026',
  '18.08.2026'
];

const state = {
  activeTab: 'members', // 'members' default | 'lakhpati' | 'cutoff'
  hierarchy: null,
  members: [],
  savedReasons: {},     // { [memberCode]: { reason: string, remarks: string, updatedAt: string } }
  selectedGp: '',
  selectedVillage: '',
  selectedShg: '',
  searchQuery: '',
  currentList: [],
  activeMemberIndex: -1,

  // eKYC dashboard eBK table controls
  dashEbkQuery: '',
  dashEbkSort: 'pending',
  dashEbkShowAll: false,

  // Cutoff state
  cutoffList: [],
  cutoffHierarchy: null,
  savedCutoff: {},      // { [shgCode]: { [date]: "Yes" | "No" } }
  selectedCutoffGp: '',
  selectedCutoffVillage: '',
  cutoffSearchQuery: '',
  cutoffCurrentList: [],
  activeCutoffIndex: -1,

  // Lakhpati Didi state
  lakhpatiMembers: [],
  lakhpatiHierarchy: null,
  savedLakhpatiInactive: {},  // { [pldCode]: { needInactive: true/false, updatedAt: string } }
  selectedLakhpatiGp: '',
  selectedLakhpatiVillage: '',
  selectedLakhpatiShg: '',
  lakhpatiCurrentList: [],
  lakhpatiShgCodeSearch: ''  // SHG code search term
};

// DOM Elements Cache
const el = {
  // Nav Tabs
  navTabMembers: document.getElementById('navTabMembers'),
  navTabCutoff: document.getElementById('navTabCutoff'),

  // Views
  memberListView: document.getElementById('memberListView'),
  memberReasonView: document.getElementById('memberReasonView'),
  shgCutoffListView: document.getElementById('shgCutoffListView'),
  shgCutoffDetailView: document.getElementById('shgCutoffDetailView'),

  // Export buttons
  exportAllCsvBtn: document.getElementById('exportAllCsvBtn'),
  exportCutoffCsvBtn: document.getElementById('exportCutoffCsvBtn'),

  // Dropdowns & Header
  selectGp: document.getElementById('selectGp'),
  selectVillage: document.getElementById('selectVillage'),
  selectShg: document.getElementById('selectShg'),
  selectorFooter: document.getElementById('selectorFooter'),
  resetAllNavBtn: document.getElementById('resetAllNavBtn'),

  listHeaderBar: document.getElementById('listHeaderBar'),
  membersTableSection: document.getElementById('membersTableSection'),

  // eKYC Dashboard
  ekycDashboard: document.getElementById('ekycDashboard'),
  dashScopeLabel: document.getElementById('dashScopeLabel'),
  dashKpis: document.getElementById('dashKpis'),
  dashAadhaar: document.getElementById('dashAadhaar'),
  dashAadhaarSub: document.getElementById('dashAadhaarSub'),
  dashEbkSearch: document.getElementById('dashEbkSearch'),
  dashEbkSort: document.getElementById('dashEbkSort'),
  dashEbkBody: document.getElementById('dashEbkBody'),
  dashEbkFooter: document.getElementById('dashEbkFooter'),
  currentShgHeading: document.getElementById('currentShgHeading'),
  memberStatsBadge: document.getElementById('memberStatsBadge'),
  memberSearchInput: document.getElementById('memberSearchInput'),
  membersTableBody: document.getElementById('membersTableBody'),

  // Page 2 Member Navigation & Details
  backToListBtn: document.getElementById('backToListBtn'),
  prevMemberBtn: document.getElementById('prevMemberBtn'),
  nextMemberBtn: document.getElementById('nextMemberBtn'),
  memberIndexDisplay: document.getElementById('memberIndexDisplay'),

  detGpTag: document.getElementById('detGpTag'),
  detVillageTag: document.getElementById('detVillageTag'),
  detShgTag: document.getElementById('detShgTag'),
  detMemberName: document.getElementById('detMemberName'),
  detMemberCode: document.getElementById('detMemberCode'),
  detEkycVal: document.getElementById('detEkycVal'),
  detAadhaarVal: document.getElementById('detAadhaarVal'),
  detPhoneVal: document.getElementById('detPhoneVal'),
  detEbkVal: document.getElementById('detEbkVal'),

  // Member Reason Form & Verified Notice
  verifiedMemberNotice: document.getElementById('verifiedMemberNotice'),
  noCodeMemberNotice: document.getElementById('noCodeMemberNotice'),
  noCodeApprovalText: document.getElementById('noCodeApprovalText'),
  reasonFormCard: document.getElementById('reasonFormCard'),
  formSuccessAlert: document.getElementById('formSuccessAlert'),
  formSuccessAlertText: document.getElementById('formSuccessAlertText'),
  formErrorAlert: document.getElementById('formErrorAlert'),
  formErrorAlertText: document.getElementById('formErrorAlertText'),
  detailReasonSelect: document.getElementById('detailReasonSelect'),
  legacyReasonNotice: document.getElementById('legacyReasonNotice'),
  legacyReasonText: document.getElementById('legacyReasonText'),
  saveReasonBtn: document.getElementById('saveReasonBtn'),
  saveOnlyBtn: document.getElementById('saveOnlyBtn'),
  clearReasonBtn: document.getElementById('clearReasonBtn'),
  savedTimestampNotice: document.getElementById('savedTimestampNotice'),
  savedTimestampText: document.getElementById('savedTimestampText'),
  toastNotification: document.getElementById('toastNotification'),

  // Cutoff View Elements
  selectCutoffGp: document.getElementById('selectCutoffGp'),
  selectCutoffVillage: document.getElementById('selectCutoffVillage'),
  cutoffSearchInput: document.getElementById('cutoffSearchInput'),
  statCutoffTotal: document.getElementById('statCutoffTotal'),
  statCutoff12: document.getElementById('statCutoff12'),
  statCutoff13: document.getElementById('statCutoff13'),
  statCutoff14: document.getElementById('statCutoff14'),
  statCutoff15: document.getElementById('statCutoff15'),
  statCutoff16: document.getElementById('statCutoff16'),
  statCutoff17: document.getElementById('statCutoff17'),
  statCutoff18: document.getElementById('statCutoff18'),
  cutoffTableBody: document.getElementById('cutoffTableBody'),
  cutoffStatsSection: document.getElementById('cutoffStatsSection'),

  // Cutoff Detail Elements
  cutoffBackToListBtn: document.getElementById('cutoffBackToListBtn'),
  cutoffPrevShgBtn: document.getElementById('cutoffPrevShgBtn'),
  cutoffNextShgBtn: document.getElementById('cutoffNextShgBtn'),
  cutoffShgIndexDisplay: document.getElementById('cutoffShgIndexDisplay'),
  detCutoffProgressBadge: document.getElementById('detCutoffProgressBadge'),
  detCutoffGpTag: document.getElementById('detCutoffGpTag'),
  detCutoffVillageTag: document.getElementById('detCutoffVillageTag'),
  detCutoffShgName: document.getElementById('detCutoffShgName'),
  detCutoffShgCode: document.getElementById('detCutoffShgCode'),
  cutoffFormSuccessAlert: document.getElementById('cutoffFormSuccessAlert'),
  saveCutoffDetailBtn: document.getElementById('saveCutoffDetailBtn'),
  saveCutoffDetailOnlyBtn: document.getElementById('saveCutoffDetailOnlyBtn'),
  clearCutoffDetailBtn: document.getElementById('clearCutoffDetailBtn'),
  cutoffSavedTimestampNotice: document.getElementById('cutoffSavedTimestampNotice'),
  cutoffSavedTimestampText: document.getElementById('cutoffSavedTimestampText'),

  // Lakhpati Didi Elements
  navTabLakhpati: document.getElementById('navTabLakhpati'),
  lakhpatiListView: document.getElementById('lakhpatiListView'),
  exportLakhpatiCsvBtn: document.getElementById('exportLakhpatiCsvBtn'),
  selectLakhpatiGp: document.getElementById('selectLakhpatiGp'),
  selectLakhpatiVillage: document.getElementById('selectLakhpatiVillage'),
  selectLakhpatiShg: document.getElementById('selectLakhpatiShg'),
  lakhpatiStatsSection: document.getElementById('lakhpatiStatsSection'),
  statLakhpatiTotal: document.getElementById('statLakhpatiTotal'),
  statLakhpatiMarked: document.getElementById('statLakhpatiMarked'),
  statLakhpatiRemaining: document.getElementById('statLakhpatiRemaining'),
  lakhpatiTableBody: document.getElementById('lakhpatiTableBody'),
  lakhpatiShgCodeInput: document.getElementById('lakhpatiShgCodeInput'),
  lakhpatiShgCodeSearchBtn: document.getElementById('lakhpatiShgCodeSearchBtn'),
  lakhpatiResetBtn: document.getElementById('lakhpatiResetBtn')
};

document.addEventListener('DOMContentLoaded', () => {
  el.detailReasonSelect.innerHTML = REASON_OPTIONS
    .map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
  loadSavedDataFromLocal();
  bindEvents();
  loadData();
});

function loadSavedDataFromLocal() {
  // Member reasons always loaded fresh from server — no local cache

  // Cutoff responses are always loaded fresh from server — no local cache
}

async function loadData() {
  try {
    const [hierRes, memRes, reasonsRes, cutoffListRes, cutoffHierRes, cutoffApiRes, lakhpatiMemRes, lakhpatiHierRes, lakhpatiApiRes] = await Promise.all([
      fetch('hierarchy_summary.json'),
      fetch('members.json'),
      fetch('/api/reasons').catch(() => null),
      fetch('shg_cutoff_list.json').catch(() => null),
      fetch('shg_cutoff_hierarchy.json').catch(() => null),
      fetch('/api/cutoff').catch(() => null),
      fetch('lakhpati_members.json').catch(() => null),
      fetch('lakhpati_hierarchy.json').catch(() => null),
      fetch('/api/lakhpati').catch(() => null)
    ]);

    if (hierRes.ok) {
      state.hierarchy = await hierRes.json();
      populateGpDropdown();
    }

    if (memRes.ok) {
      state.members = await memRes.json();
    }

    if (reasonsRes && reasonsRes.ok) {
      state.savedReasons = normalizeSavedReasons(await reasonsRes.json() || {});
      // No localStorage — server is single source of truth
    }

    if (cutoffListRes && cutoffListRes.ok) {
      state.cutoffList = await cutoffListRes.json();
    }

    if (cutoffHierRes && cutoffHierRes.ok) {
      state.cutoffHierarchy = await cutoffHierRes.json();
      populateCutoffGpDropdown();
    }

    if (cutoffApiRes && cutoffApiRes.ok) {
      state.savedCutoff = await cutoffApiRes.json();
      // No localStorage — server is single source of truth
    }

    if (state.activeTab === 'cutoff') {
      renderCutoffTable();
    }

    if (lakhpatiMemRes && lakhpatiMemRes.ok) {
      state.lakhpatiMembers = await lakhpatiMemRes.json();
    }

    if (lakhpatiHierRes && lakhpatiHierRes.ok) {
      state.lakhpatiHierarchy = await lakhpatiHierRes.json();
      populateLakhpatiGpDropdown();
    }

    if (lakhpatiApiRes && lakhpatiApiRes.ok) {
      state.savedLakhpatiInactive = await lakhpatiApiRes.json();
    }

    // Render the opening tab once all data (incl. saved reasons) has arrived
    if (state.activeTab === 'members' || state.activeTab === 'lakhpati') {
      switchTab(state.activeTab);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function switchTab(tabName) {
  state.activeTab = tabName;
  if (tabName === 'members') {
    if (el.navTabMembers) el.navTabMembers.classList.add('active');
    if (el.navTabLakhpati) el.navTabLakhpati.classList.remove('active');
    if (el.memberListView) el.memberListView.style.display = 'block';
    if (el.memberReasonView) el.memberReasonView.style.display = 'none';
    if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
    if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
    if (el.lakhpatiListView) el.lakhpatiListView.style.display = 'none';
    if (el.exportAllCsvBtn) el.exportAllCsvBtn.style.display = 'inline-flex';
    if (el.exportLakhpatiCsvBtn) el.exportLakhpatiCsvBtn.style.display = 'none';
    renderMembersTable();
  } else if (tabName === 'lakhpati') {
    if (el.navTabMembers) el.navTabMembers.classList.remove('active');
    if (el.navTabLakhpati) el.navTabLakhpati.classList.add('active');
    if (el.memberListView) el.memberListView.style.display = 'none';
    if (el.memberReasonView) el.memberReasonView.style.display = 'none';
    if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
    if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
    if (el.lakhpatiListView) el.lakhpatiListView.style.display = 'block';
    if (el.exportAllCsvBtn) el.exportAllCsvBtn.style.display = 'none';
    updateLakhpatiExportVisibility();
    renderLakhpatiTable();
  } else {
    updateLakhpatiExportVisibility();
  }
}

function bindEvents() {
  // Navigation Tabs
  if (el.navTabMembers) el.navTabMembers.addEventListener('click', () => switchTab('members'));
  if (el.navTabLakhpati) el.navTabLakhpati.addEventListener('click', () => switchTab('lakhpati'));

  // Lakhpati Didi Dropdown Events
  if (el.selectLakhpatiGp) el.selectLakhpatiGp.addEventListener('change', (e) => {
    state.selectedLakhpatiGp = e.target.value;
    state.selectedLakhpatiVillage = '';
    state.selectedLakhpatiShg = '';
    state.lakhpatiShgCodeSearch = '';
    if (el.lakhpatiShgCodeInput) el.lakhpatiShgCodeInput.value = '';
    populateLakhpatiVillageDropdown();
    resetLakhpatiShgDropdown();
    renderLakhpatiTable();
  });

  if (el.selectLakhpatiVillage) el.selectLakhpatiVillage.addEventListener('change', (e) => {
    state.selectedLakhpatiVillage = e.target.value;
    state.selectedLakhpatiShg = '';
    state.lakhpatiShgCodeSearch = '';
    if (el.lakhpatiShgCodeInput) el.lakhpatiShgCodeInput.value = '';
    populateLakhpatiShgDropdown();
    renderLakhpatiTable();
  });

  if (el.selectLakhpatiShg) el.selectLakhpatiShg.addEventListener('change', (e) => {
    state.selectedLakhpatiShg = e.target.value;
    state.lakhpatiShgCodeSearch = '';
    if (el.lakhpatiShgCodeInput) el.lakhpatiShgCodeInput.value = '';
    renderLakhpatiTable();
  });

  // Lakhpati CSV Export
  if (el.exportLakhpatiCsvBtn) el.exportLakhpatiCsvBtn.addEventListener('click', exportLakhpatiCsv);

  // Lakhpati Reset / Home Button
  if (el.lakhpatiResetBtn) el.lakhpatiResetBtn.addEventListener('click', resetLakhpatiSelection);

  // Lakhpati SHG Code Search
  if (el.lakhpatiShgCodeSearchBtn) {
    el.lakhpatiShgCodeSearchBtn.addEventListener('click', handleLakhpatiShgCodeSearch);
  }
  if (el.lakhpatiShgCodeInput) {
    el.lakhpatiShgCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLakhpatiShgCodeSearch();
    });
  }

  // Member GP Selection
  el.selectGp.addEventListener('change', (e) => {
    state.selectedGp = e.target.value;
    state.selectedVillage = '';
    state.selectedShg = '';
    
    populateVillageDropdown();
    resetShgDropdown();
    updateSelectorFooter();
    renderMembersTable();
  });

  // Village Selection
  el.selectVillage.addEventListener('change', (e) => {
    state.selectedVillage = e.target.value;
    state.selectedShg = '';
    
    populateShgDropdown();
    updateSelectorFooter();
    renderMembersTable();
  });

  // SHG Selection
  el.selectShg.addEventListener('change', (e) => {
    state.selectedShg = e.target.value;
    updateSelectorFooter();
    renderMembersTable();
  });

  // Dashboard eBK table controls
  el.dashEbkSearch.addEventListener('input', (e) => {
    state.dashEbkQuery = e.target.value.trim().toLowerCase();
    renderDashEbkTable();
  });
  el.dashEbkSort.addEventListener('change', (e) => {
    state.dashEbkSort = e.target.value;
    renderDashEbkTable();
  });
  el.dashEbkFooter.addEventListener('click', (e) => {
    if (!e.target.closest('[data-action="toggle-ebk-all"]')) return;
    state.dashEbkShowAll = !state.dashEbkShowAll;
    renderDashEbkTable();
  });

  // Member Search input
  el.memberSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderMembersTable();
  });

  // Reset All Button
  el.resetAllNavBtn.addEventListener('click', () => {
    state.selectedGp = '';
    state.selectedVillage = '';
    state.selectedShg = '';
    state.searchQuery = '';
    el.memberSearchInput.value = '';
    
    el.selectGp.value = '';
    resetVillageDropdown();
    resetShgDropdown();
    updateSelectorFooter();
    renderMembersTable();
  });

  // Export Buttons
  el.exportAllCsvBtn.addEventListener('click', exportAllBlockCsv);
  if (el.exportCutoffCsvBtn) el.exportCutoffCsvBtn.addEventListener('click', exportCutoffCsv);

  // Page 2 Navigation
  el.backToListBtn.addEventListener('click', showMemberListView);
  el.prevMemberBtn.addEventListener('click', showPrevMember);
  el.nextMemberBtn.addEventListener('click', showNextMember);

  // Reason select change
  el.detailReasonSelect.addEventListener('change', () => {
    hideFormAlerts();
    el.detailReasonSelect.classList.remove('input-error');
  });

  // Form buttons
  el.saveReasonBtn.addEventListener('click', () => saveCurrentReason(true));
  el.saveOnlyBtn.addEventListener('click', () => saveCurrentReason(false));
  el.clearReasonBtn.addEventListener('click', clearCurrentReason);

  // Cutoff View Events
  if (el.selectCutoffGp) {
    el.selectCutoffGp.addEventListener('change', (e) => {
      state.selectedCutoffGp = e.target.value;
      state.selectedCutoffVillage = '';
      populateCutoffVillageDropdown();
      renderCutoffTable();
    });
  }

  if (el.selectCutoffVillage) {
    el.selectCutoffVillage.addEventListener('change', (e) => {
      state.selectedCutoffVillage = e.target.value;
      renderCutoffTable();
    });
  }

  if (el.cutoffSearchInput) {
    el.cutoffSearchInput.addEventListener('input', (e) => {
      state.cutoffSearchQuery = e.target.value.trim().toLowerCase();
      renderCutoffTable();
    });
  }

  // Cutoff Detail Navigation
  if (el.cutoffBackToListBtn) el.cutoffBackToListBtn.addEventListener('click', showCutoffListView);
  if (el.cutoffPrevShgBtn) el.cutoffPrevShgBtn.addEventListener('click', showPrevCutoffShg);
  if (el.cutoffNextShgBtn) el.cutoffNextShgBtn.addEventListener('click', showNextCutoffShg);

  // Cutoff Detail Save & Clear
  if (el.saveCutoffDetailBtn) el.saveCutoffDetailBtn.addEventListener('click', () => saveCutoffDetail(true));
  if (el.saveCutoffDetailOnlyBtn) el.saveCutoffDetailOnlyBtn.addEventListener('click', () => saveCutoffDetail(false));
  if (el.clearCutoffDetailBtn) el.clearCutoffDetailBtn.addEventListener('click', clearCutoffDetail);
}

function hideFormAlerts() {
  if (el.formSuccessAlert) el.formSuccessAlert.style.display = 'none';
  if (el.formErrorAlert) el.formErrorAlert.style.display = 'none';
}

function showFormError(msg) {
  if (el.formSuccessAlert) el.formSuccessAlert.style.display = 'none';
  if (el.formErrorAlertText) el.formErrorAlertText.textContent = msg;
  if (el.formErrorAlert) el.formErrorAlert.style.display = 'flex';
}

function showFormSuccess(msg) {
  if (el.formErrorAlert) el.formErrorAlert.style.display = 'none';
  if (el.formSuccessAlertText) el.formSuccessAlertText.textContent = msg;
  if (el.formSuccessAlert) el.formSuccessAlert.style.display = 'flex';
}

function populateGpDropdown() {
  if (!state.hierarchy) return;
  const gps = Object.keys(state.hierarchy).sort();
  el.selectGp.innerHTML = '<option value="">-- Select GP --</option>' +
    gps.map(gp => `<option value="${escapeHtml(gp)}">${escapeHtml(gp)}</option>`).join('');
}

function populateVillageDropdown() {
  if (!state.selectedGp || !state.hierarchy[state.selectedGp]) {
    resetVillageDropdown();
    return;
  }

  const gpObj = state.hierarchy[state.selectedGp];
  const villagesObj = gpObj.villages || gpObj;
  const villages = Object.keys(villagesObj).sort();

  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>' +
    villages.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.selectVillage.disabled = false;
}

function resetVillageDropdown() {
  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>';
  el.selectVillage.disabled = true;
}

function populateShgDropdown() {
  if (!state.selectedGp || !state.selectedVillage || !state.hierarchy[state.selectedGp]) {
    resetShgDropdown();
    return;
  }

  const gpObj = state.hierarchy[state.selectedGp];
  const villagesObj = gpObj.villages || gpObj;
  const villageObj = villagesObj[state.selectedVillage];
  if (!villageObj) {
    resetShgDropdown();
    return;
  }

  const shgsObj = villageObj.shgs || villageObj;
  let shgsList = [];
  if (Array.isArray(shgsObj)) {
    shgsList = shgsObj;
  } else if (typeof shgsObj === 'object') {
    shgsList = Object.values(shgsObj).map(s => ({
      sc: s.code || s.sc,
      sn: s.name || s.sn
    }));
  }

  shgsList.sort((a, b) => (a.sn || '').localeCompare(b.sn || ''));

  el.selectShg.innerHTML = '<option value="">-- Select SHG --</option>' +
    shgsList.map(s => `<option value="${escapeHtml(s.sc)}">${escapeHtml(s.sn)} (${escapeHtml(s.sc)})</option>`).join('');
  el.selectShg.disabled = false;
}

function resetShgDropdown() {
  el.selectShg.innerHTML = '<option value="">-- Select SHG --</option>';
  el.selectShg.disabled = true;
}

function updateSelectorFooter() {
  if (state.selectedGp || state.selectedVillage || state.selectedShg) {
    el.selectorFooter.style.display = 'flex';
  } else {
    el.selectorFooter.style.display = 'none';
  }
}

// Reasons are keyed by member code; members without a generated code can't have one
function hasMemberCode(m) {
  return /^\d{12}$/.test(m.mc || '');
}

function getSavedReason(m) {
  return hasMemberCode(m) ? state.savedReasons[m.mc] : undefined;
}

function renderMembersTable() {
  let list = state.members.filter(m => m.st === 'ACTIVE');

  if (state.selectedGp) {
    list = list.filter(m => m.gp === state.selectedGp);
  }

  if (state.selectedVillage) {
    list = list.filter(m => m.vil === state.selectedVillage);
  }

  if (state.selectedShg) {
    list = list.filter(m => m.sc === state.selectedShg);
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(m =>
      m.mn.toLowerCase().includes(q) ||
      m.mc.includes(q) ||
      m.sn.toLowerCase().includes(q)
    );
  }

  state.currentList = list;

  if (state.selectedShg) {
    const selectedShgObj = state.members.find(m => m.sc === state.selectedShg);
    el.currentShgHeading.textContent = selectedShgObj ? selectedShgObj.sn : 'Selected SHG';
  } else if (state.selectedVillage) {
    el.currentShgHeading.textContent = `Village: ${state.selectedVillage}`;
  } else if (state.selectedGp) {
    el.currentShgHeading.textContent = `GP: ${state.selectedGp}`;
  } else {
    el.currentShgHeading.textContent = 'All Active Block Members';
  }

  el.memberStatsBadge.textContent = `${list.length.toLocaleString()} Members`;

  // Until an SHG is picked, the dashboard (scoped to the GP / Village selection) replaces the list
  const showDashboard = !state.selectedShg && !state.searchQuery;
  el.ekycDashboard.style.display = showDashboard ? 'block' : 'none';
  el.membersTableSection.style.display = showDashboard ? 'none' : 'block';
  if (showDashboard) {
    el.listHeaderBar.style.display = 'none';
    renderEkycDashboard();
    return;
  }
  el.listHeaderBar.style.display = 'flex';

  if (list.length === 0) {
    el.membersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="placeholder-row">
          No members found matching the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  list.forEach((m, idx) => {
    const isEkycDone = m.ekyc.toLowerCase() === 'yes';
    const isPhoneDone = m.pvf;

    const ekycBadge = isEkycDone
      ? '<span class="status-badge badge-success">✓ Yes</span>'
      : '<span class="status-badge badge-danger">✕ No</span>';

    const phoneBadge = isPhoneDone
      ? '<span class="status-badge badge-success">✓ Yes</span>'
      : '<span class="status-badge badge-danger">✕ No</span>';

    const isFullyVerified = (isEkycDone && isPhoneDone);
    const hasCode = hasMemberCode(m);
    const saved = getSavedReason(m);
    const canRecord = hasCode && !isFullyVerified;
    let reasonBadgeHtml = '';

    if (isFullyVerified) {
      reasonBadgeHtml = '<span class="status-badge badge-success">Fully Verified</span>';
    } else if (!hasCode) {
      reasonBadgeHtml = '<span class="status-badge badge-neutral">No Member Code</span>';
    } else if (saved && saved.reason) {
      const displayReason = escapeHtml(describeReason(saved));
      reasonBadgeHtml = `<span class="status-badge badge-warning" title="${displayReason}">${displayReason}</span>`;
    } else {
      reasonBadgeHtml = '<span class="status-badge badge-neutral">Reason Pending</span>';
    }

    html += `
      <tr onclick="openMemberDetail(${idx})" class="clickable-row">
        <td data-label="Sl" class="text-muted" style="font-size:0.8rem;">${idx + 1}</td>
        <td data-label="Member">
          <div class="member-name-cell">
            <span class="m-name">${escapeHtml(m.mn)}</span>
            <span class="m-code">(${hasCode ? escapeHtml(m.mc) : 'No Code'})</span>
          </div>
        </td>
        <td data-label="SHG">
          <div class="member-shg-cell">
            <span class="m-shg">${escapeHtml(m.sn)}</span>
            <span class="m-village">${escapeHtml(m.vil)}</span>
          </div>
        </td>
        <td data-label="eKYC" class="text-center">${ekycBadge}</td>
        <td data-label="Phone" class="text-center">${phoneBadge}</td>
        <td data-label="Reason" class="text-center">${reasonBadgeHtml}</td>
        <td data-label="Action" class="text-center">
          <button class="btn btn-sm ${canRecord ? 'btn-primary' : 'btn-outline'}">
            ${canRecord ? 'Record Reason' : 'View'}
          </button>
        </td>
      </tr>
    `;
  });

  el.membersTableBody.innerHTML = html;
}

function openMemberDetail(index) {
  if (index < 0 || index >= state.currentList.length) return;
  state.activeMemberIndex = index;
  renderMemberDetail();
  
  el.memberListView.style.display = 'none';
  if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
  if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
  el.memberReasonView.style.display = 'block';
  window.scrollTo(0, 0);
}

function showMemberListView() {
  el.memberReasonView.style.display = 'none';
  if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
  if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
  el.memberListView.style.display = 'block';
  renderMembersTable();
}

function renderMemberDetail() {
  const m = state.currentList[state.activeMemberIndex];
  if (!m) return;

  hideFormAlerts();

  el.memberIndexDisplay.textContent = `${state.activeMemberIndex + 1} of ${state.currentList.length}`;
  el.prevMemberBtn.disabled = (state.activeMemberIndex <= 0);
  el.nextMemberBtn.disabled = (state.activeMemberIndex >= state.currentList.length - 1);

  el.detMemberName.textContent = m.mn;
  const hasCode = hasMemberCode(m);
  el.detMemberCode.textContent = hasCode ? `Member Code: ${m.mc}` : 'Member Code: Not generated';
  el.detGpTag.textContent = `GP: ${m.gp}`;
  el.detVillageTag.textContent = `Village: ${m.vil}`;
  el.detShgTag.textContent = `SHG: ${m.sn}`;

  const isEkycDone = m.ekyc.toLowerCase() === 'yes';
  const isPhoneDone = m.pvf;

  el.detEkycVal.textContent = m.ekyc;
  el.detEkycVal.style.color = isEkycDone ? 'var(--success)' : 'var(--danger)';

  el.detPhoneVal.textContent = isPhoneDone ? 'Yes (TRUE)' : 'No (FALSE)';
  el.detPhoneVal.style.color = isPhoneDone ? 'var(--success)' : 'var(--danger)';

  const isAadhaarVerified = (m.akyc || '').toUpperCase() === 'VERIFIED';
  el.detAadhaarVal.textContent = m.akyc || '-';
  el.detAadhaarVal.style.color = isAadhaarVerified ? 'var(--success)' : 'var(--danger)';

  const hasValue = v => v && v !== '-';
  el.detEbkVal.textContent = !hasValue(m.ebkn) ? 'Not Assigned'
    : hasValue(m.ebkm) ? `${m.ebkn} (${m.ebkm})` : m.ebkn;

  const isFullyVerified = (isEkycDone && isPhoneDone);

  el.verifiedMemberNotice.style.display = isFullyVerified ? 'block' : 'none';
  el.noCodeMemberNotice.style.display = (!isFullyVerified && !hasCode) ? 'block' : 'none';
  el.noCodeApprovalText.textContent = m.appst || '-';

  if (isFullyVerified || !hasCode) {
    el.reasonFormCard.style.display = 'none';
  } else {
    el.reasonFormCard.style.display = 'block';

    const saved = getSavedReason(m);
    if (saved && saved.reason) {
      const isCurrent = isCurrentReason(saved.reason);
      el.detailReasonSelect.value = isCurrent ? saved.reason : '';
      el.legacyReasonText.textContent = describeReason(saved);
      el.legacyReasonNotice.style.display = isCurrent ? 'none' : 'block';

      if (saved.updatedAt) {
        const timeStr = new Date(saved.updatedAt).toLocaleString();
        el.savedTimestampText.textContent = timeStr;
        el.savedTimestampNotice.style.display = 'block';
      } else {
        el.savedTimestampNotice.style.display = 'none';
      }
    } else {
      el.detailReasonSelect.value = '';
      el.legacyReasonNotice.style.display = 'none';
      el.savedTimestampNotice.style.display = 'none';
    }

    el.detailReasonSelect.classList.remove('input-error');
  }
}

function showPrevMember() {
  if (state.activeMemberIndex > 0) {
    state.activeMemberIndex--;
    renderMemberDetail();
    window.scrollTo(0, 0);
  }
}

function showNextMember() {
  if (state.activeMemberIndex < state.currentList.length - 1) {
    state.activeMemberIndex++;
    renderMemberDetail();
    window.scrollTo(0, 0);
  }
}

async function saveCurrentReason(autoAdvance = true) {
  const m = state.currentList[state.activeMemberIndex];
  if (!m || !hasMemberCode(m)) return;

  hideFormAlerts();
  el.detailReasonSelect.classList.remove('input-error');

  const reason = el.detailReasonSelect.value;

  if (!isCurrentReason(reason)) {
    el.detailReasonSelect.classList.add('input-error');
    showFormError('Please select a Non-Completion Reason before saving.');
    return;
  }

  const payload = {
    [m.mc]: {
      reason,
      remarks: '',
      updatedAt: new Date().toISOString()
    }
  };

  const formButtons = [el.saveReasonBtn, el.saveOnlyBtn, el.clearReasonBtn];
  setButtonsBusy(formButtons, true);
  try {
    await postJson('/api/reasons', payload);
  } catch (err) {
    console.error('Reason save failed:', err);
    showFormError(SAVE_FAILED_MSG);
    showToast(SAVE_FAILED_MSG, true);
    return;
  } finally {
    setButtonsBusy(formButtons, false);
  }

  // Only record locally once the server has confirmed
  state.savedReasons[m.mc] = payload[m.mc];

  showFormSuccess('Reason recorded successfully!');
  showToast('✓ Response saved');

  setTimeout(() => {
    hideFormAlerts();
    if (state.currentList[state.activeMemberIndex] !== m) return; // user moved on while saving
    if (autoAdvance && state.activeMemberIndex < state.currentList.length - 1) {
      showNextMember();
    } else {
      renderMemberDetail();
    }
  }, 700);
}

async function clearCurrentReason() {
  const m = state.currentList[state.activeMemberIndex];
  if (!m || !hasMemberCode(m)) return;

  hideFormAlerts();
  el.detailReasonSelect.classList.remove('input-error');

  const payload = { [m.mc]: { reason: '', remarks: '', updatedAt: new Date().toISOString() } };
  const formButtons = [el.saveReasonBtn, el.saveOnlyBtn, el.clearReasonBtn];
  setButtonsBusy(formButtons, true);
  try {
    await postJson('/api/reasons', payload);
  } catch (err) {
    console.error('Reason clear failed:', err);
    showFormError('✕ Not cleared — check your connection and try again');
    showToast(SAVE_FAILED_MSG, true);
    return;
  } finally {
    setButtonsBusy(formButtons, false);
  }

  delete state.savedReasons[m.mc];
  showToast('Cleared reason');
  if (state.currentList[state.activeMemberIndex] !== m) return; // user moved on while saving

  el.detailReasonSelect.value = '';
  el.legacyReasonNotice.style.display = 'none';
  el.savedTimestampNotice.style.display = 'none';
}

/* ==========================================================================
   eKYC DASHBOARD
   ========================================================================== */

// Status colours validated for colour-blind separation; every segment also carries a text label
const AADHAAR_STATUSES = [
  { key: 'VERIFIED', label: 'Verified', color: '#15803d' },
  { key: 'NOT AVAILABLE', label: 'Not Available', color: '#f59e0b' },
  { key: 'NOT VERIFIED', label: 'Not Verified', color: '#dc2626' },
  { key: 'OTHER', label: 'Not Recorded', color: '#94a3b8' }
];

const DASH_EBK_PAGE_SIZE = 20;
let dashEbkGroups = [];

function isFullyVerifiedMember(m) {
  return m.ekyc.toLowerCase() === 'yes' && m.pvf;
}

// A reason is expected for every member with a code who isn't fully verified
function needsReason(m) {
  return hasMemberCode(m) && !isFullyVerifiedMember(m);
}

function isReasonTagged(m) {
  const saved = getSavedReason(m);
  return !!(saved && saved.reason);
}

function percentOf(n, total) {
  return total ? Math.round((n / total) * 100) : 0;
}

function fmt(n) {
  return n.toLocaleString();
}

function renderEkycDashboard() {
  let list = state.members.filter(m => m.st === 'ACTIVE');
  if (state.selectedGp) list = list.filter(m => m.gp === state.selectedGp);
  if (state.selectedVillage) list = list.filter(m => m.vil === state.selectedVillage);

  el.dashScopeLabel.textContent = state.selectedVillage
    ? `GP: ${state.selectedGp} › Village: ${state.selectedVillage}`
    : state.selectedGp ? `GP: ${state.selectedGp}` : 'Block — All Gram Panchayats';

  const need = list.filter(needsReason);
  const tagged = need.filter(isReasonTagged);

  renderDashKpis(list, need, tagged);
  renderDashAadhaar(list);

  // eBK groups for the progress table
  const groups = new Map();
  list.forEach(m => {
    const assigned = m.ebkn && m.ebkn !== '-';
    const key = assigned ? (m.ebkid && m.ebkid !== '-' ? m.ebkid : m.ebkn) : '__none__';
    if (!groups.has(key)) {
      groups.set(key, { name: assigned ? m.ebkn : 'Not Assigned', id: assigned ? m.ebkid : '', members: 0, need: 0, tagged: 0 });
    }
    const g = groups.get(key);
    g.members++;
    if (needsReason(m)) {
      g.need++;
      if (isReasonTagged(m)) g.tagged++;
    }
  });
  dashEbkGroups = [...groups.values()];
  renderDashEbkTable();
}

function renderDashKpis(list, need, tagged) {
  const pending = need.length - tagged.length;
  const noCode = list.filter(m => !hasMemberCode(m)).length;
  const tiles = [
    { title: 'TOTAL MEMBERS', value: fmt(list.length), tag: 'ACTIVE', tagClass: 'tag-neutral' },
    { title: 'NEED REASON', value: fmt(need.length), tag: 'eKYC / PHONE PENDING', tagClass: 'tag-neutral' },
    { title: 'REASON TAGGED', value: fmt(tagged.length), tag: 'DONE', tagClass: 'tag-done', numClass: 'stat-green' },
    { title: 'PENDING', value: fmt(pending), tag: 'TO BE TAGGED', tagClass: 'tag-warning', numClass: 'stat-orange' },
    { title: 'PROGRESS', value: `${percentOf(tagged.length, need.length)}%`, tag: 'TAGGED / NEED', tagClass: 'tag-neutral' },
    { title: 'NO MEMBER CODE', value: fmt(noCode), tag: 'CANNOT BE TAGGED', tagClass: 'tag-neutral' }
  ];
  el.dashKpis.innerHTML = tiles.map(t => `
    <div class="stat-box">
      <span class="stat-date-title">${t.title}</span>
      <span class="stat-num ${t.numClass || ''}">${t.value}</span>
      <span class="stat-sub-tag ${t.tagClass}">${t.tag}</span>
    </div>
  `).join('');
}

function renderDashAadhaar(list) {
  const total = list.length;
  const counts = {};
  AADHAAR_STATUSES.forEach(s => counts[s.key] = 0);
  list.forEach(m => {
    const v = (m.akyc || '').trim().toUpperCase();
    counts[counts.hasOwnProperty(v) && v !== 'OTHER' ? v : 'OTHER']++;
  });

  el.dashAadhaarSub.textContent = `${fmt(total)} members`;
  if (!total) {
    el.dashAadhaar.innerHTML = '<p class="dash-empty">No members in this selection.</p>';
    return;
  }

  // "Not Recorded" only appears when there is something to show
  const statuses = AADHAAR_STATUSES.filter(s => s.key !== 'OTHER' || counts.OTHER > 0);
  const describe = s => `${s.label}: ${fmt(counts[s.key])} (${percentOf(counts[s.key], total)}%)`;

  const segments = statuses.filter(s => counts[s.key] > 0).map(s => `
    <span class="dash-stack-seg" style="flex-grow:${counts[s.key]}; background:${s.color};" title="${describe(s)}"></span>
  `).join('');

  const legend = statuses.map(s => `
    <div class="dash-legend-item">
      <span class="dash-swatch" style="background:${s.color};"></span>
      <span class="dash-legend-label">${s.label}</span>
      <span class="dash-legend-val">${fmt(counts[s.key])}</span>
      <span class="dash-legend-pct">${percentOf(counts[s.key], total)}%</span>
    </div>
  `).join('');

  el.dashAadhaar.innerHTML = `
    <div class="dash-stack" role="img" aria-label="Aadhaar KYC status — ${statuses.map(describe).join(', ')}">${segments}</div>
    <div class="dash-legend">${legend}</div>
  `;
}

function renderDashEbkTable() {
  const q = state.dashEbkQuery;
  let rows = dashEbkGroups.filter(g => !q || g.name.toLowerCase().includes(q) || (g.id || '').toLowerCase().includes(q));

  const pendingOf = g => g.need - g.tagged;
  // Groups with nothing to tag sink to the bottom for the "pending" and "progress" sorts
  const sorters = {
    pending: (a, b) => pendingOf(b) - pendingOf(a) || b.need - a.need || a.name.localeCompare(b.name),
    progress: (a, b) => (!a.need - !b.need) || percentOf(a.tagged, a.need) - percentOf(b.tagged, b.need) || pendingOf(b) - pendingOf(a),
    name: (a, b) => a.name.localeCompare(b.name)
  };
  rows.sort(sorters[state.dashEbkSort] || sorters.pending);

  const total = rows.length;
  const visible = state.dashEbkShowAll ? rows : rows.slice(0, DASH_EBK_PAGE_SIZE);

  if (!total) {
    el.dashEbkBody.innerHTML = `<tr><td colspan="6" class="placeholder-row">No bookkeepers match "${escapeHtml(q)}".</td></tr>`;
    el.dashEbkFooter.innerHTML = '';
    return;
  }

  el.dashEbkBody.innerHTML = visible.map(g => {
    const pct = percentOf(g.tagged, g.need);
    const progressCell = g.need
      ? `<div class="dash-meter" title="${fmt(g.tagged)} of ${fmt(g.need)} tagged">
           <span class="dash-meter-track"><span class="dash-meter-fill" style="width:${pct}%;"></span></span>
           <span class="dash-meter-val">${pct}%</span>
         </div>
         <div class="dash-meter-sub">${fmt(g.tagged)} / ${fmt(g.need)} tagged</div>`
      : '<span class="text-muted dash-none">Nothing to tag</span>';
    return `
      <tr>
        <td>
          <div class="dash-ebk-name">${escapeHtml(g.name)}</div>
          ${g.id ? `<div class="dash-ebk-id">${escapeHtml(g.id)}</div>` : ''}
        </td>
        <td class="text-center dash-col-opt dash-num">${fmt(g.members)}</td>
        <td class="text-center dash-col-opt-sm dash-num">${fmt(g.need)}</td>
        <td class="text-center dash-col-opt-sm dash-num">${fmt(g.tagged)}</td>
        <td class="text-center dash-col-opt dash-num">${fmt(g.need - g.tagged)}</td>
        <td class="dash-col-progress">${progressCell}</td>
      </tr>
    `;
  }).join('');

  el.dashEbkFooter.innerHTML = total > DASH_EBK_PAGE_SIZE
    ? `<span>Showing ${fmt(visible.length)} of ${fmt(total)} bookkeepers</span>
       <button class="btn-link" data-action="toggle-ebk-all">${state.dashEbkShowAll ? 'Show fewer' : `Show all ${fmt(total)}`}</button>`
    : `<span>${fmt(total)} bookkeeper${total === 1 ? '' : 's'}</span>`;
}

/* ==========================================================================
   SHG CUTOFF TRACKER FUNCTIONS
   ========================================================================== */

function populateCutoffGpDropdown() {
  if (!state.cutoffHierarchy || !el.selectCutoffGp) return;
  const gps = Object.keys(state.cutoffHierarchy).sort();
  el.selectCutoffGp.innerHTML = '<option value="">-- All Gram Panchayats --</option>' +
    gps.map(gp => `<option value="${escapeHtml(gp)}">${escapeHtml(gp)}</option>`).join('');
}

function populateCutoffVillageDropdown() {
  if (!el.selectCutoffVillage) return;
  if (!state.selectedCutoffGp || !state.cutoffHierarchy || !state.cutoffHierarchy[state.selectedCutoffGp]) {
    el.selectCutoffVillage.innerHTML = '<option value="">-- All Villages --</option>';
    el.selectCutoffVillage.disabled = true;
    return;
  }

  const villages = Object.keys(state.cutoffHierarchy[state.selectedCutoffGp]).sort();
  el.selectCutoffVillage.innerHTML = '<option value="">-- All Villages --</option>' +
    villages.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.selectCutoffVillage.disabled = false;
}

function getFilteredCutoffList() {
  let filtered = state.cutoffList;

  if (state.selectedCutoffGp) {
    filtered = filtered.filter(item => item.gp === state.selectedCutoffGp);
  }

  if (state.selectedCutoffVillage) {
    filtered = filtered.filter(item => item.village === state.selectedCutoffVillage);
  }

  if (state.cutoffSearchQuery) {
    const q = state.cutoffSearchQuery;
    filtered = filtered.filter(item =>
      item.shgName.toLowerCase().includes(q) || item.shgCode.includes(q)
    );
  }

  state.cutoffCurrentList = filtered;
  return filtered;
}

function renderCutoffTable() {
  if (!el.cutoffTableBody) return;

  if (!state.cutoffList || state.cutoffList.length === 0) {
    el.cutoffTableBody.innerHTML = '<tr><td colspan="5" class="placeholder-row">Loading SHG Cutoff data...</td></tr>';
    return;
  }

  // 1. Home / Initial State (No GP & No Village selected)
  if (!state.selectedCutoffGp && !state.selectedCutoffVillage) {
    // Show stats summary section on Home page showing Block-wide overall totals
    if (el.cutoffStatsSection) el.cutoffStatsSection.style.display = 'block';

    const totalShgsCount = state.cutoffList.length;
    if (el.statCutoffTotal) el.statCutoffTotal.textContent = totalShgsCount.toLocaleString();

    const blockDateCounts = {};
    CUTOFF_DATES.forEach(d => blockDateCounts[d] = 0);
    state.cutoffList.forEach(item => {
      const resp = state.savedCutoff[item.shgCode] || {};
      CUTOFF_DATES.forEach(d => {
        if (resp[d] === 'Yes') blockDateCounts[d]++;
      });
    });

    if (el.statCutoff12) el.statCutoff12.textContent = blockDateCounts['12.08.2026'];
    if (el.statCutoff13) el.statCutoff13.textContent = blockDateCounts['13.08.2026'];
    if (el.statCutoff14) el.statCutoff14.textContent = blockDateCounts['14.08.2026'];
    if (el.statCutoff15) el.statCutoff15.textContent = blockDateCounts['15.08.2026'];
    if (el.statCutoff16) el.statCutoff16.textContent = blockDateCounts['16.08.2026'];
    if (el.statCutoff17) el.statCutoff17.textContent = blockDateCounts['17.08.2026'];
    if (el.statCutoff18) el.statCutoff18.textContent = blockDateCounts['18.08.2026'];

    el.cutoffTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="placeholder-row">
          Please select a <strong>Gram Panchayat</strong> and <strong>Village</strong> above to view SHGs.
        </td>
      </tr>
    `;
    return;
  }

  // 2. GP is selected but NO Village is selected -> Hide stats summary section
  if (state.selectedCutoffGp && !state.selectedCutoffVillage) {
    if (el.cutoffStatsSection) el.cutoffStatsSection.style.display = 'none';

    el.cutoffTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="placeholder-row">
          Please select a <strong>Village</strong> for <strong>${escapeHtml(state.selectedCutoffGp)}</strong> above to view SHGs.
        </td>
      </tr>
    `;
    return;
  }

  // 3. Both GP & Village selected -> Hide stats section and display clean SHG list table
  if (el.cutoffStatsSection) el.cutoffStatsSection.style.display = 'none';

  const filtered = getFilteredCutoffList();

  if (filtered.length === 0) {
    el.cutoffTableBody.innerHTML = '<tr><td colspan="5" class="placeholder-row">No SHGs match the selected filters.</td></tr>';
    return;
  }

  let html = '';
  filtered.forEach((item, index) => {
    const resp = state.savedCutoff[item.shgCode] || {};
    
    // Calculate how many dates are marked (Yes or No)
    let markedCount = 0;
    CUTOFF_DATES.forEach(d => {
      if (resp[d]) markedCount++;
    });

    let statusBadgeHtml = '';
    if (markedCount === 7) {
      statusBadgeHtml = '<span class="status-badge badge-success">✓ 7/7 Dates Complete</span>';
    } else if (markedCount > 0) {
      statusBadgeHtml = `<span class="status-badge badge-warning">${markedCount}/7 Dates Marked</span>`;
    } else {
      statusBadgeHtml = '<span class="status-badge badge-neutral">0/7 Dates Pending</span>';
    }

    html += `
      <tr>
        <td data-label="Sl" class="text-muted" style="font-size:0.8rem;">${item.sl || (index + 1)}</td>
        <td data-label="SHG">
          <div class="member-name-cell">
            <span class="m-name">${escapeHtml(item.shgName)}</span>
            <span class="m-code">(${escapeHtml(item.shgCode)})</span>
          </div>
        </td>
        <td data-label="Village">
          <span class="m-shg">${escapeHtml(item.village)}</span>
        </td>
        <td data-label="Cutoff Status" class="text-center">${statusBadgeHtml}</td>
        <td data-label="Action" class="text-center">
          <button class="btn btn-sm btn-primary" onclick="openCutoffDetail(${index})">
            Record Cutoff ➔
          </button>
        </td>
      </tr>
    `;
  });

  el.cutoffTableBody.innerHTML = html;
}

function openCutoffDetail(index) {
  if (index < 0 || index >= state.cutoffCurrentList.length) return;
  state.activeCutoffIndex = index;
  renderCutoffDetail();

  if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
  if (el.memberListView) el.memberListView.style.display = 'none';
  if (el.memberReasonView) el.memberReasonView.style.display = 'none';
  if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'block';
  window.scrollTo(0, 0);
}

function showCutoffListView() {
  if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
  if (el.memberReasonView) el.memberReasonView.style.display = 'none';
  if (el.memberListView) el.memberListView.style.display = 'none';
  if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'block';
  renderCutoffTable();
}

function renderCutoffDetail() {
  const shg = state.cutoffCurrentList[state.activeCutoffIndex];
  if (!shg) return;

  if (el.cutoffFormSuccessAlert) el.cutoffFormSuccessAlert.style.display = 'none';

  if (el.cutoffShgIndexDisplay) {
    el.cutoffShgIndexDisplay.textContent = `${state.activeCutoffIndex + 1} of ${state.cutoffCurrentList.length}`;
  }
  if (el.cutoffPrevShgBtn) el.cutoffPrevShgBtn.disabled = (state.activeCutoffIndex <= 0);
  if (el.cutoffNextShgBtn) el.cutoffNextShgBtn.disabled = (state.activeCutoffIndex >= state.cutoffCurrentList.length - 1);

  if (el.detCutoffShgName) el.detCutoffShgName.textContent = shg.shgName;
  if (el.detCutoffShgCode) el.detCutoffShgCode.textContent = `(${shg.shgCode})`;
  if (el.detCutoffGpTag) el.detCutoffGpTag.textContent = `GP: ${shg.gp}`;
  if (el.detCutoffVillageTag) el.detCutoffVillageTag.textContent = `Village: ${shg.village}`;

  const resp = state.savedCutoff[shg.shgCode] || {};

  let markedCount = 0;
  CUTOFF_DATES.forEach(date => {
    if (resp[date]) markedCount++;
  });

  if (el.detCutoffProgressBadge) {
    if (markedCount === 7) {
      el.detCutoffProgressBadge.textContent = '✓ 7 of 7 Dates Completed';
      el.detCutoffProgressBadge.className = 'status-badge badge-success';
    } else if (markedCount > 0) {
      el.detCutoffProgressBadge.textContent = `${markedCount} of 7 Dates Marked`;
      el.detCutoffProgressBadge.className = 'status-badge badge-warning';
    } else {
      el.detCutoffProgressBadge.textContent = '0 of 7 Dates Marked';
      el.detCutoffProgressBadge.className = 'status-badge badge-neutral';
    }
  }

  // Update detail header progress bar fill
  const progressFill = document.getElementById('detCutoffProgressFill');
  if (progressFill) {
    progressFill.style.width = `${Math.round((markedCount / 7) * 100)}%`;
  }

  // Populate visual toggle pills for each date
  CUTOFF_DATES.forEach(date => {
    const card = document.getElementById(`cardDate_${date}`);
    if (card) {
      const val = resp[date];
      const yesBtn = card.querySelector('.btn-yes');
      const noBtn = card.querySelector('.btn-no');
      if (yesBtn) yesBtn.classList.toggle('selected', val === 'Yes');
      if (noBtn) noBtn.classList.toggle('selected', val === 'No');

      card.classList.remove('card-selected-yes', 'card-selected-no');
      const pill = document.getElementById(`cardStatusPill_${date}`);

      if (val === 'Yes') {
        card.classList.add('card-selected-yes');
        if (pill) { pill.textContent = '✓ Done'; pill.className = 'date-card-status-pill pill-yes'; }
      } else if (val === 'No') {
        card.classList.add('card-selected-no');
        if (pill) { pill.textContent = '✕ Pending'; pill.className = 'date-card-status-pill pill-no'; }
      } else {
        if (pill) { pill.textContent = 'Not Set'; pill.className = 'date-card-status-pill pill-neutral'; }
      }
    }
  });

  if (resp.updatedAt) {
    if (el.cutoffSavedTimestampText) el.cutoffSavedTimestampText.textContent = new Date(resp.updatedAt).toLocaleString();
    if (el.cutoffSavedTimestampNotice) el.cutoffSavedTimestampNotice.style.display = 'block';
  } else {
    if (el.cutoffSavedTimestampNotice) el.cutoffSavedTimestampNotice.style.display = 'none';
  }
}

window.handleDetailCutoffToggle = function(btn) {
  const shg = state.cutoffCurrentList[state.activeCutoffIndex];
  if (!shg) return;

  const date = btn.getAttribute('data-dt');
  const targetVal = btn.getAttribute('data-val');

  if (!state.savedCutoff[shg.shgCode]) {
    state.savedCutoff[shg.shgCode] = {};
  }

  const currentVal = state.savedCutoff[shg.shgCode][date];
  if (currentVal === targetVal) {
    delete state.savedCutoff[shg.shgCode][date];
  } else {
    state.savedCutoff[shg.shgCode][date] = targetVal;
  }
  state.savedCutoff[shg.shgCode].updatedAt = new Date().toISOString();

  // State is kept in memory; server is synced on Save

  // Update visual button state & card theme immediately
  const card = document.getElementById(`cardDate_${date}`);
  if (card) {
    const yesBtn = card.querySelector('.btn-yes');
    const noBtn = card.querySelector('.btn-no');
    const newVal = state.savedCutoff[shg.shgCode][date];
    if (yesBtn) yesBtn.classList.toggle('selected', newVal === 'Yes');
    if (noBtn) noBtn.classList.toggle('selected', newVal === 'No');

    card.classList.remove('card-selected-yes', 'card-selected-no');
    const pill = document.getElementById(`cardStatusPill_${date}`);

    if (newVal === 'Yes') {
      card.classList.add('card-selected-yes');
      if (pill) { pill.textContent = '✓ Done'; pill.className = 'date-card-status-pill pill-yes'; }
    } else if (newVal === 'No') {
      card.classList.add('card-selected-no');
      if (pill) { pill.textContent = '✕ Pending'; pill.className = 'date-card-status-pill pill-no'; }
    } else {
      if (pill) { pill.textContent = 'Not Set'; pill.className = 'date-card-status-pill pill-neutral'; }
    }
  }

  // Update progress badge and progress bar
  const resp = state.savedCutoff[shg.shgCode] || {};
  let markedCount = 0;
  CUTOFF_DATES.forEach(d => { if (resp[d]) markedCount++; });

  if (el.detCutoffProgressBadge) {
    if (markedCount === 7) {
      el.detCutoffProgressBadge.textContent = '✓ 7 of 7 Dates Completed';
      el.detCutoffProgressBadge.className = 'status-badge badge-success';
    } else if (markedCount > 0) {
      el.detCutoffProgressBadge.textContent = `${markedCount} of 7 Dates Marked`;
      el.detCutoffProgressBadge.className = 'status-badge badge-warning';
    } else {
      el.detCutoffProgressBadge.textContent = '0 of 7 Dates Marked';
      el.detCutoffProgressBadge.className = 'status-badge badge-neutral';
    }
  }

  const progressFill = document.getElementById('detCutoffProgressFill');
  if (progressFill) {
    progressFill.style.width = `${Math.round((markedCount / 7) * 100)}%`;
  }
};

function showPrevCutoffShg() {
  if (state.activeCutoffIndex > 0) {
    state.activeCutoffIndex--;
    renderCutoffDetail();
    window.scrollTo(0, 0);
  }
}

function showNextCutoffShg() {
  if (state.activeCutoffIndex < state.cutoffCurrentList.length - 1) {
    state.activeCutoffIndex++;
    renderCutoffDetail();
    window.scrollTo(0, 0);
  }
}

async function saveCutoffDetail(autoAdvance = false) {
  const shg = state.cutoffCurrentList[state.activeCutoffIndex];
  if (!shg) return;

  const resp = state.savedCutoff[shg.shgCode] || {};
  
  // Validation: Check if at least one date has been selected (Yes or No)
  let selectedCount = 0;
  CUTOFF_DATES.forEach(d => {
    if (resp[d] === 'Yes' || resp[d] === 'No') {
      selectedCount++;
    }
  });

  if (selectedCount === 0) {
    showToast('⚠️ Please select Yes or No for at least one cutoff date before saving.');
    return;
  }

  const payload = {
    [shg.shgCode]: resp
  };

  const formButtons = [el.saveCutoffDetailOnlyBtn, el.clearCutoffDetailBtn];
  setButtonsBusy(formButtons, true);
  try {
    await postJson('/api/cutoff', payload);
  } catch (err) {
    // Selections stay on screen so the user can simply press Save again
    console.error('Cutoff save failed:', err);
    showToast(SAVE_FAILED_MSG, true);
    return;
  } finally {
    setButtonsBusy(formButtons, false);
  }

  if (el.cutoffFormSuccessAlert) el.cutoffFormSuccessAlert.style.display = 'flex';
  showToast(`✓ Saved Cutoff for ${shg.shgName}`);

  setTimeout(() => {
    if (el.cutoffFormSuccessAlert) el.cutoffFormSuccessAlert.style.display = 'none';
    if (autoAdvance && state.activeCutoffIndex < state.cutoffCurrentList.length - 1) {
      showNextCutoffShg();
    } else {
      renderCutoffDetail();
    }
  }, 700);
}

async function clearCutoffDetail() {
  const shg = state.cutoffCurrentList[state.activeCutoffIndex];
  if (!shg) return;

  const formButtons = [el.saveCutoffDetailOnlyBtn, el.clearCutoffDetailBtn];
  setButtonsBusy(formButtons, true);
  try {
    await postJson('/api/cutoff', { [shg.shgCode]: {} });
  } catch (err) {
    console.error('Cutoff clear failed:', err);
    showToast('✕ Not cleared — check your connection and try again', true);
    return;
  } finally {
    setButtonsBusy(formButtons, false);
  }

  delete state.savedCutoff[shg.shgCode];
  renderCutoffDetail();
  showToast('Cleared cutoff dates for SHG');
}

function exportCutoffCsv() {
  if (!state.cutoffList || state.cutoffList.length === 0) {
    alert('No SHG Cutoff data available to export.');
    return;
  }

  const headers = [
    'Slno',
    'Gram Panchayat',
    'Village',
    'SHG Code',
    'SHG Name',
    'Cut Off Completed - 12.08.2026 (Yes / No)',
    'Cut Off Completed - 13.08.2026 (Yes / No)',
    'Cut Off Completed - 14.08.2026 (Yes / No)',
    'Cut Off Completed - 15.08.2026 (Yes / No)',
    'Cut Off Completed - 16.08.2026 (Yes / No)',
    'Cut Off Completed - 17.08.2026 (Yes / No)',
    'Cut Off Completed - 18.08.2026 (Yes / No)'
  ];

  const rows = state.cutoffList.map((item, index) => {
    const resp = state.savedCutoff[item.shgCode] || {};
    return [
      item.sl || (index + 1),
      csvEscape(item.gp),
      csvEscape(item.village),
      csvEscape(item.shgCode),
      csvEscape(item.shgName),
      csvEscape(resp['12.08.2026'] || ''),
      csvEscape(resp['13.08.2026'] || ''),
      csvEscape(resp['14.08.2026'] || ''),
      csvEscape(resp['15.08.2026'] || ''),
      csvEscape(resp['16.08.2026'] || ''),
      csvEscape(resp['17.08.2026'] || ''),
      csvEscape(resp['18.08.2026'] || '')
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `SHG_Block_Cutoff_Responses_${timestamp}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`✓ Exported ${state.cutoffList.length.toLocaleString()} SHG Cutoff records`);
}

function exportAllBlockCsv() {
  if (!state.members || state.members.length === 0) {
    alert('No member data available to export.');
    return;
  }

  const activeMembers = state.members.filter(m => m.st === 'ACTIVE');

  const headers = [
    'Gram Panchayat',
    'Village',
    'SHG Code',
    'SHG Name',
    'Member Code',
    'Member Name',
    'eKYC Status',
    'Phone Verified',
    'Verification Action Needed',
    'Non-Verification Reason',
    'Remarks',
    'Reason Logged Time',
    'eBK ID',
    'eBK Name',
    'eBK Mobile No.',
    'Status',
    'Aadhaar KYC',
    'Approval Status',
    'In Latest Master Data'
  ];

  const rows = activeMembers.map(m => {
    const isEkycYes = m.ekyc.toLowerCase() === 'yes';
    const isPhoneYes = m.pvf;
    const isFullyVerified = (isEkycYes && isPhoneYes);
    const actionNeeded = isFullyVerified ? 'NO' : 'YES';
    const saved = getSavedReason(m) || {};

    const reasonValue = isFullyVerified ? '' : (saved.reason || '');
    const remarksValue = isFullyVerified ? '' : (saved.remarks || '');
    const reasonTime = isFullyVerified ? '' : (saved.updatedAt || '');

    return [
      csvEscape(m.gp),
      csvEscape(m.vil),
      csvEscape(m.sc),
      csvEscape(m.sn),
      csvEscape(m.mc),
      csvEscape(m.mn),
      csvEscape(m.ekyc),
      m.pvf ? 'TRUE' : 'FALSE',
      csvEscape(actionNeeded),
      csvEscape(reasonValue),
      csvEscape(remarksValue),
      csvEscape(reasonTime),
      csvEscape(m.ebkid),
      csvEscape(m.ebkn),
      csvEscape(m.ebkm),
      csvEscape(m.st),
      csvEscape(m.akyc),
      csvEscape(m.appst),
      m.prev ? '"No (kept: reason recorded)"' : '"Yes"'
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `SHG_Block_All_Members_Responses_${timestamp}.csv`;
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`✓ Exported ${activeMembers.length.toLocaleString()} members`);
}

let toastTimer = null;

function showToast(msg, isError = false) {
  el.toastNotification.textContent = msg;
  el.toastNotification.classList.toggle('toast-error', isError);
  el.toastNotification.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toastNotification.classList.remove('show');
  }, isError ? 5000 : 2500);
}

const SAVE_FAILED_MSG = '✕ Not saved — check your connection and try again';

// POST JSON; throws unless the server confirms the save
async function postJson(url, payload) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  return res.json();
}

// Disable buttons while a save is in flight so it can't be submitted twice
function setButtonsBusy(buttons, busy) {
  buttons.forEach(btn => { if (btn) btn.disabled = busy; });
}

function csvEscape(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =============================================
// LAKHPATI DIDI — INACTIVE MARKING FUNCTIONS
// =============================================

function populateLakhpatiGpDropdown() {
  if (!state.lakhpatiHierarchy || !el.selectLakhpatiGp) return;
  const gps = Object.keys(state.lakhpatiHierarchy).sort();
  el.selectLakhpatiGp.innerHTML = '<option value="">-- Select GP --</option>' +
    gps.map(gp => `<option value="${escapeHtml(gp)}">${escapeHtml(gp)}</option>`).join('');
}

function populateLakhpatiVillageDropdown() {
  if (!state.selectedLakhpatiGp || !state.lakhpatiHierarchy || !state.lakhpatiHierarchy[state.selectedLakhpatiGp]) {
    resetLakhpatiVillageDropdown();
    return;
  }
  const gpObj = state.lakhpatiHierarchy[state.selectedLakhpatiGp];
  const villagesObj = gpObj.villages || {};
  const villages = Object.keys(villagesObj).sort();
  el.selectLakhpatiVillage.innerHTML = '<option value="">-- Select Village --</option>' +
    villages.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.selectLakhpatiVillage.disabled = false;
}

function resetLakhpatiVillageDropdown() {
  if (el.selectLakhpatiVillage) {
    el.selectLakhpatiVillage.innerHTML = '<option value="">-- Select Village --</option>';
    el.selectLakhpatiVillage.disabled = true;
  }
}

function populateLakhpatiShgDropdown() {
  if (!state.selectedLakhpatiGp || !state.selectedLakhpatiVillage || !state.lakhpatiHierarchy) {
    resetLakhpatiShgDropdown();
    return;
  }
  const gpObj = state.lakhpatiHierarchy[state.selectedLakhpatiGp];
  const villagesObj = gpObj ? (gpObj.villages || {}) : {};
  const vilObj = villagesObj[state.selectedLakhpatiVillage];
  if (!vilObj) { resetLakhpatiShgDropdown(); return; }

  const shgsObj = vilObj.shgs || {};
  const shgsList = Object.values(shgsObj).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  el.selectLakhpatiShg.innerHTML = '<option value="">-- Select SHG --</option>' +
    shgsList.map(s => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>`).join('');
  el.selectLakhpatiShg.disabled = false;
}

function resetLakhpatiShgDropdown() {
  if (el.selectLakhpatiShg) {
    el.selectLakhpatiShg.innerHTML = '<option value="">-- Select SHG --</option>';
    el.selectLakhpatiShg.disabled = true;
  }
}

function resetLakhpatiSelection() {
  state.selectedLakhpatiGp = '';
  state.selectedLakhpatiVillage = '';
  state.selectedLakhpatiShg = '';
  state.lakhpatiShgCodeSearch = '';
  if (el.selectLakhpatiGp) el.selectLakhpatiGp.value = '';
  if (el.lakhpatiShgCodeInput) el.lakhpatiShgCodeInput.value = '';
  resetLakhpatiVillageDropdown();
  resetLakhpatiShgDropdown();
  renderLakhpatiTable();
}

function updateLakhpatiExportVisibility() {
  const isLakhpati = state.activeTab === 'lakhpati';
  // User request: "Export Lakhpati csv should only show when in Home page i.e not while marking the status or drop downs"
  // Home page = in Lakhpati tab, no GP selected, no Village selected, no SHG selected, and no search active.
  const isHomePage = isLakhpati &&
                     !state.selectedLakhpatiGp &&
                     !state.selectedLakhpatiVillage &&
                     !state.selectedLakhpatiShg &&
                     (!state.lakhpatiShgCodeSearch || !state.lakhpatiShgCodeSearch.trim());

  if (el.exportLakhpatiCsvBtn) {
    el.exportLakhpatiCsvBtn.style.display = isHomePage ? 'inline-flex' : 'none';
  }
}

function handleLakhpatiShgCodeSearch() {
  const code = el.lakhpatiShgCodeInput ? el.lakhpatiShgCodeInput.value.trim() : '';
  if (!code) {
    showToast('⚠ Please enter an SHG Code');
    return;
  }

  // Clear dropdown selections
  state.selectedLakhpatiGp = '';
  state.selectedLakhpatiVillage = '';
  state.selectedLakhpatiShg = '';
  if (el.selectLakhpatiGp) el.selectLakhpatiGp.value = '';
  resetLakhpatiVillageDropdown();
  resetLakhpatiShgDropdown();

  // Set search mode
  state.lakhpatiShgCodeSearch = code;
  renderLakhpatiTable();
}

const AVATAR_PALETTES = [
  { bg: '#e0e7ff', text: '#4338ca' }, // Indigo
  { bg: '#dcfce7', text: '#15803d' }, // Emerald
  { bg: '#fef3c7', text: '#b45309' }, // Amber
  { bg: '#ffe4e6', text: '#be123c' }, // Rose
  { bg: '#ede9fe', text: '#6d28d9' }, // Violet
  { bg: '#cffafe', text: '#0e7490' }, // Cyan
  { bg: '#fae8ff', text: '#a21caf' }, // Fuchsia
  { bg: '#f1f5f9', text: '#334155' }  // Slate
];

function getAvatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const idx = Math.abs(hash) % AVATAR_PALETTES.length;
  return AVATAR_PALETTES[idx];
}

function renderLakhpatiTable() {
  if (!el.lakhpatiTableBody) return;

  // Sync Export button visibility based on whether we are in Home page or marking/dropdowns
  updateLakhpatiExportVisibility();

  let list = state.lakhpatiMembers;
  const hasShgSearch = state.lakhpatiShgCodeSearch && state.lakhpatiShgCodeSearch.trim();

  if (hasShgSearch) {
    // SHG code search mode — filter by partial/exact shgCode match
    const q = state.lakhpatiShgCodeSearch.trim();
    list = list.filter(m => m.shgCode.includes(q));
  } else {
    // Dropdown mode
    if (state.selectedLakhpatiGp) {
      list = list.filter(m => m.gp === state.selectedLakhpatiGp);
    }
    if (state.selectedLakhpatiVillage) {
      list = list.filter(m => m.village === state.selectedLakhpatiVillage);
    }
    if (state.selectedLakhpatiShg) {
      list = list.filter(m => m.shgCode === state.selectedLakhpatiShg);
    }
  }

  state.lakhpatiCurrentList = list;

  // Update stats with all members (block-level)
  updateLakhpatiStats(state.lakhpatiMembers);

  // Show stats only when no SHG is selected and no search active (Home page state)
  const showStats = !state.selectedLakhpatiShg && !hasShgSearch && !state.selectedLakhpatiGp;
  if (el.lakhpatiStatsSection) {
    el.lakhpatiStatsSection.style.display = showStats ? 'block' : 'none';
  }

  // Require SHG selection or search before showing members
  if (!state.selectedLakhpatiShg && !hasShgSearch) {
    el.lakhpatiTableBody.innerHTML = `
      <div class="lk-placeholder-card">
        <div class="lk-placeholder-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h4>Select an SHG to view members</h4>
        <p>Choose Gram Panchayat ➔ Village ➔ SHG above or search directly by SHG Code.</p>
      </div>
    `;
    return;
  }

  if (list.length === 0) {
    el.lakhpatiTableBody.innerHTML = `
      <div class="lk-placeholder-card">
        <div class="lk-placeholder-icon">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4>No members found</h4>
        <p>No Lakhpati Didi members found for the selected criteria.</p>
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach((m, idx) => {
    const saved = state.savedLakhpatiInactive[m.pldCode];
    const isMarked = saved && saved.needInactive === true;
    const cardClass = isMarked ? 'lk-member-card lk-card-marked' : 'lk-member-card';
    const initial = (m.pldName || 'M').trim().charAt(0).toUpperCase();
    const avatar = getAvatarStyle(m.pldName);

    html += `
      <div class="${cardClass}" id="card-${escapeHtml(m.pldCode)}">
        <!-- Card Header: Avatar, Name, ID & Status Badge -->
        <div class="lk-card-header">
          <div class="lk-avatar" style="background: ${avatar.bg}; color: ${avatar.text};">
            ${initial}
          </div>
          <div class="lk-header-info">
            <div class="lk-member-name">${escapeHtml(m.pldName)}</div>
            <div class="lk-member-id">
              <span class="lk-id-num">ID: ${escapeHtml(m.pldCode)}</span>
            </div>
          </div>
          <div class="lk-status-badge ${isMarked ? 'marked' : 'active'}">
            <span class="lk-badge-dot"></span>
            <span class="lk-badge-text">${isMarked ? 'Need to Inactive' : 'Active'}</span>
          </div>
        </div>

        <!-- Card Body: SHG & Relation details -->
        <div class="lk-card-body">
          <div class="lk-detail-row">
            <svg class="lk-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span class="lk-detail-label">SHG:</span>
            <span class="lk-detail-val"><strong>${escapeHtml(m.shgName)}</strong> <span class="lk-shg-code">(${escapeHtml(m.shgCode)})</span></span>
          </div>
          <div class="lk-detail-row">
            <svg class="lk-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span class="lk-detail-label">Father/Spouse:</span>
            <span class="lk-detail-val">${escapeHtml(m.fatherSpouse || '—')}</span>
          </div>
        </div>

        <!-- Card Tags -->
        <div class="lk-card-tags">
          <span class="lk-tag lk-tag-cat">Category: ${escapeHtml(m.socialCategory || 'GEN')}</span>
          <span class="lk-tag">${escapeHtml(m.village)}</span>
          <span class="lk-tag">${escapeHtml(m.gp)}</span>
          ${m.lakhpatiDidi === 'Yes' ? '<span class="lk-tag lk-tag-gold">🏆 Lakhpati</span>' : ''}
        </div>

        <!-- Dedicated "Need to Inactive" Action Switch Bar -->
        <div class="lk-toggle-bar ${isMarked ? 'checked' : ''}" onclick="handleLakhpatiToggle('${escapeHtml(m.pldCode)}', this)" role="button" tabindex="0" title="${isMarked ? 'Marked as Need to Inactive. Tap to restore Active' : 'Tap to mark as Need to Inactive'}">
          <div class="lk-toggle-text-wrap">
            <div class="lk-toggle-title">Need to Inactive</div>
            <div class="lk-toggle-subtitle">${isMarked ? 'Marked for inactivation' : 'Tap switch to mark inactive'}</div>
          </div>
          <div class="lk-switch-wrapper">
            <span class="lk-switch-state-text">${isMarked ? 'YES' : 'NO'}</span>
            <div class="lk-real-switch">
              <div class="lk-switch-thumb"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  el.lakhpatiTableBody.innerHTML = html;
}

function updateLakhpatiStats(list) {
  const total = list.length;
  const marked = list.filter(m => {
    const saved = state.savedLakhpatiInactive[m.pldCode];
    return saved && saved.needInactive === true;
  }).length;
  const remaining = total - marked;

  if (el.statLakhpatiTotal) el.statLakhpatiTotal.textContent = total.toLocaleString();
  if (el.statLakhpatiMarked) el.statLakhpatiMarked.textContent = marked.toLocaleString();
  if (el.statLakhpatiRemaining) el.statLakhpatiRemaining.textContent = remaining.toLocaleString();
}

function applyLakhpatiCardState(card, isMarked) {
  if (!card) return;
  const statusBadge = card.querySelector('.lk-status-badge');
  const badgeText = card.querySelector('.lk-badge-text');
  const toggleBar = card.querySelector('.lk-toggle-bar');
  const toggleSubtitle = card.querySelector('.lk-toggle-subtitle');
  const switchStateText = card.querySelector('.lk-switch-state-text');

  card.classList.toggle('lk-card-marked', isMarked);
  if (statusBadge) statusBadge.className = `lk-status-badge ${isMarked ? 'marked' : 'active'}`;
  if (badgeText) badgeText.textContent = isMarked ? 'Need to Inactive' : 'Active';
  if (toggleBar) toggleBar.classList.toggle('checked', isMarked);
  if (toggleSubtitle) toggleSubtitle.textContent = isMarked ? 'Marked for inactivation' : 'Tap switch to mark inactive';
  if (switchStateText) switchStateText.textContent = isMarked ? 'YES' : 'NO';
}

const lakhpatiSaving = new Set(); // pldCodes with a save in flight

async function handleLakhpatiToggle(pldCode, triggerEl) {
  if (lakhpatiSaving.has(pldCode)) return; // ignore double taps until the server answers

  const previous = state.savedLakhpatiInactive[pldCode];
  const newVal = !(previous && previous.needInactive);
  const entry = { needInactive: newVal, updatedAt: new Date().toISOString() };

  // Optimistic UI: flip immediately, roll back if the server doesn't confirm
  const card = triggerEl ? triggerEl.closest('.lk-member-card') : null;
  state.savedLakhpatiInactive[pldCode] = entry;
  applyLakhpatiCardState(card, newVal);
  updateLakhpatiStats(state.lakhpatiMembers);

  lakhpatiSaving.add(pldCode);
  if (card) card.classList.add('lk-saving');
  try {
    await postJson('/api/lakhpati', { [pldCode]: entry });
    showToast(newVal ? '⚠ Marked as Need to Inactive' : '✓ Restored to Active');
  } catch (err) {
    console.error('Error saving lakhpati toggle:', err);
    if (previous) state.savedLakhpatiInactive[pldCode] = previous;
    else delete state.savedLakhpatiInactive[pldCode];
    applyLakhpatiCardState(card, !newVal);
    updateLakhpatiStats(state.lakhpatiMembers);
    showToast(SAVE_FAILED_MSG, true);
  } finally {
    lakhpatiSaving.delete(pldCode);
    if (card) card.classList.remove('lk-saving');
  }
}

function exportLakhpatiCsv() {
  const members = state.lakhpatiMembers;
  if (!members.length) return;

  const header = ['Sl No', 'Gram Panchayat', 'Village', 'SHG Name', 'SHG Code', 'PLD Name', 'PLD Code', 'Mobile', 'Father/Spouse', 'Social Category', 'Active Status', 'Need to Inactive', 'Marked At'];
  const rows = members.map((m, idx) => {
    const saved = state.savedLakhpatiInactive[m.pldCode];
    const isMarked = saved && saved.needInactive === true;
    return [
      idx + 1,
      csvEscape(m.gp),
      csvEscape(m.village),
      csvEscape(m.shgName),
      csvEscape(m.shgCode),
      csvEscape(m.pldName),
      csvEscape(m.pldCode),
      csvEscape(m.mobile),
      csvEscape(m.fatherSpouse),
      csvEscape(m.socialCategory),
      csvEscape(m.activeStatus),
      isMarked ? '"Yes"' : '"No"',
      isMarked ? csvEscape(saved.updatedAt) : '""'
    ].join(',');
  });

  const csvContent = '\uFEFF' + header.map(h => csvEscape(h)).join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const filename = `Lakhpati_Didi_Inactive_Marking_${dateStr}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  const markedCount = members.filter(m => {
    const s = state.savedLakhpatiInactive[m.pldCode];
    return s && s.needInactive;
  }).length;
  showToast(`✓ Exported ${members.length} members (${markedCount} marked inactive)`);
}

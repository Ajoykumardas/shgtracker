/**
 * Clean & Direct SHG Member Verification & Cutoff Tracker
 */

const REASON_OPTIONS = [
  { value: '', label: '-- Select Reason --' },
  { value: 'Outstation', label: 'Outstation (Currently not present in the Village or District)' },
  { value: 'Migrated', label: 'Migrated to somewhere else / other Place' },
  { value: 'Aadhaar Demographic Mismatch', label: 'Aadhaar / Name / DOB Mismatch in Records' },
  { value: 'Left SHG / Reluctant', label: 'Member Left SHG / Unwilling / Reluctant' },
  { value: 'Other', label: 'Other Reason (Specify in Remarks)' }
];

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
  activeTab: 'members', // 'members' | 'cutoff'
  hierarchy: null,
  members: [],
  savedReasons: {},     // { [memberCode]: { reason: string, remarks: string, updatedAt: string } }
  selectedGp: '',
  selectedVillage: '',
  selectedShg: '',
  searchQuery: '',
  currentList: [],
  activeMemberIndex: -1,

  // Cutoff state
  cutoffList: [],
  cutoffHierarchy: null,
  savedCutoff: {},      // { [shgCode]: { [date]: "Yes" | "No" } }
  selectedCutoffGp: '',
  selectedCutoffVillage: '',
  cutoffSearchQuery: '',
  cutoffCurrentList: [],
  activeCutoffIndex: -1
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
  detPhoneVal: document.getElementById('detPhoneVal'),
  detEbkVal: document.getElementById('detEbkVal'),

  // Member Reason Form & Verified Notice
  verifiedMemberNotice: document.getElementById('verifiedMemberNotice'),
  reasonFormCard: document.getElementById('reasonFormCard'),
  formSuccessAlert: document.getElementById('formSuccessAlert'),
  formSuccessAlertText: document.getElementById('formSuccessAlertText'),
  formErrorAlert: document.getElementById('formErrorAlert'),
  formErrorAlertText: document.getElementById('formErrorAlertText'),
  detailReasonSelect: document.getElementById('detailReasonSelect'),
  remarksGroup: document.getElementById('remarksGroup'),
  detailRemarksInput: document.getElementById('detailRemarksInput'),
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
  cutoffSavedTimestampText: document.getElementById('cutoffSavedTimestampText')
};

document.addEventListener('DOMContentLoaded', () => {
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
    const [hierRes, memRes, reasonsRes, cutoffListRes, cutoffHierRes, cutoffApiRes] = await Promise.all([
      fetch('hierarchy_summary.json'),
      fetch('members.json'),
      fetch('/api/reasons').catch(() => null),
      fetch('shg_cutoff_list.json').catch(() => null),
      fetch('shg_cutoff_hierarchy.json').catch(() => null),
      fetch('/api/cutoff').catch(() => null)
    ]);

    if (hierRes.ok) {
      state.hierarchy = await hierRes.json();
      populateGpDropdown();
    }

    if (memRes.ok) {
      state.members = await memRes.json();
    }

    if (reasonsRes && reasonsRes.ok) {
      state.savedReasons = await reasonsRes.json() || {};
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
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function switchTab(tabName) {
  state.activeTab = tabName;
  if (tabName === 'members') {
    if (el.navTabMembers) el.navTabMembers.classList.add('active');
    if (el.navTabCutoff) el.navTabCutoff.classList.remove('active');
    if (el.memberListView) el.memberListView.style.display = 'block';
    if (el.memberReasonView) el.memberReasonView.style.display = 'none';
    if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'none';
    if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
    if (el.exportAllCsvBtn) el.exportAllCsvBtn.style.display = 'inline-flex';
    if (el.exportCutoffCsvBtn) el.exportCutoffCsvBtn.style.display = 'none';
  } else if (tabName === 'cutoff') {
    if (el.navTabMembers) el.navTabMembers.classList.remove('active');
    if (el.navTabCutoff) el.navTabCutoff.classList.add('active');
    if (el.memberListView) el.memberListView.style.display = 'none';
    if (el.memberReasonView) el.memberReasonView.style.display = 'none';
    if (el.shgCutoffListView) el.shgCutoffListView.style.display = 'block';
    if (el.shgCutoffDetailView) el.shgCutoffDetailView.style.display = 'none';
    if (el.exportAllCsvBtn) el.exportAllCsvBtn.style.display = 'none';
    if (el.exportCutoffCsvBtn) el.exportCutoffCsvBtn.style.display = 'inline-flex';
    renderCutoffTable();
  }
}

function bindEvents() {
  // Navigation Tabs
  if (el.navTabMembers) el.navTabMembers.addEventListener('click', () => switchTab('members'));
  if (el.navTabCutoff) el.navTabCutoff.addEventListener('click', () => switchTab('cutoff'));

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
  el.detailReasonSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'Other') {
      el.remarksGroup.style.display = 'block';
    } else {
      el.remarksGroup.style.display = 'none';
    }
    hideFormAlerts();
    el.detailReasonSelect.classList.remove('input-error');
    el.detailRemarksInput.classList.remove('input-error');
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

  if (!state.selectedShg && !state.searchQuery) {
    el.membersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="placeholder-row">
          Please select a <strong>Gram Panchayat</strong>, then <strong>Village</strong>, then <strong>SHG</strong> above to view members.
        </td>
      </tr>
    `;
    el.listHeaderBar.style.display = 'none';
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
    const saved = state.savedReasons[m.mc];
    let reasonBadgeHtml = '';

    if (isFullyVerified) {
      reasonBadgeHtml = '<span class="status-badge badge-success">Fully Verified</span>';
    } else if (saved && saved.reason) {
      const displayReason = saved.reason === 'Other' && saved.remarks
        ? `Other: ${escapeHtml(saved.remarks)}`
        : escapeHtml(saved.reason);
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
            <span class="m-code">(${escapeHtml(m.mc)})</span>
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
          <button class="btn btn-sm ${isFullyVerified ? 'btn-outline' : 'btn-primary'}">
            ${isFullyVerified ? 'View' : 'Record Reason'}
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
  el.detMemberCode.textContent = `Member Code: ${m.mc}`;
  el.detGpTag.textContent = `GP: ${m.gp}`;
  el.detVillageTag.textContent = `Village: ${m.vil}`;
  el.detShgTag.textContent = `SHG: ${m.sn}`;

  const isEkycDone = m.ekyc.toLowerCase() === 'yes';
  const isPhoneDone = m.pvf;

  el.detEkycVal.textContent = m.ekyc;
  el.detEkycVal.style.color = isEkycDone ? 'var(--success)' : 'var(--danger)';

  el.detPhoneVal.textContent = isPhoneDone ? 'Yes (TRUE)' : 'No (FALSE)';
  el.detPhoneVal.style.color = isPhoneDone ? 'var(--success)' : 'var(--danger)';

  el.detEbkVal.textContent = m.ebkn ? `${m.ebkn} (${m.ebkm})` : 'Not Assigned';

  const isFullyVerified = (isEkycDone && isPhoneDone);

  if (isFullyVerified) {
    el.verifiedMemberNotice.style.display = 'block';
    el.reasonFormCard.style.display = 'none';
  } else {
    el.verifiedMemberNotice.style.display = 'none';
    el.reasonFormCard.style.display = 'block';

    const saved = state.savedReasons[m.mc];
    if (saved && saved.reason) {
      el.detailReasonSelect.value = saved.reason;
      if (saved.reason === 'Other') {
        el.remarksGroup.style.display = 'block';
        el.detailRemarksInput.value = saved.remarks || '';
      } else {
        el.remarksGroup.style.display = 'none';
        el.detailRemarksInput.value = '';
      }

      if (saved.updatedAt) {
        const timeStr = new Date(saved.updatedAt).toLocaleString();
        el.savedTimestampText.textContent = timeStr;
        el.savedTimestampNotice.style.display = 'block';
      } else {
        el.savedTimestampNotice.style.display = 'none';
      }
    } else {
      el.detailReasonSelect.value = '';
      el.detailRemarksInput.value = '';
      el.remarksGroup.style.display = 'none';
      el.savedTimestampNotice.style.display = 'none';
    }

    el.detailReasonSelect.classList.remove('input-error');
    el.detailRemarksInput.classList.remove('input-error');
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

function saveCurrentReason(autoAdvance = true) {
  const m = state.currentList[state.activeMemberIndex];
  if (!m) return;

  hideFormAlerts();
  el.detailReasonSelect.classList.remove('input-error');
  el.detailRemarksInput.classList.remove('input-error');

  const reason = el.detailReasonSelect.value;
  const remarks = el.detailRemarksInput.value.trim();

  if (!reason) {
    el.detailReasonSelect.classList.add('input-error');
    showFormError('Please select a Non-Completion Reason before saving.');
    return;
  }

  if (reason === 'Other' && !remarks) {
    el.detailRemarksInput.classList.add('input-error');
    showFormError('Please specify the reason details in the remarks box below.');
    return;
  }

  const payload = {
    [m.mc]: {
      reason,
      remarks,
      updatedAt: new Date().toISOString()
    }
  };

  state.savedReasons[m.mc] = payload[m.mc];
  // No localStorage — server is synced below

  fetch('/api/reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.warn('Backend sync error:', err));

  showFormSuccess('Reason recorded successfully!');
  showToast('✓ Response saved');

  setTimeout(() => {
    hideFormAlerts();
    if (autoAdvance && state.activeMemberIndex < state.currentList.length - 1) {
      showNextMember();
    } else {
      renderMemberDetail();
    }
  }, 700);
}

function clearCurrentReason() {
  const m = state.currentList[state.activeMemberIndex];
  if (!m) return;

  hideFormAlerts();
  el.detailReasonSelect.classList.remove('input-error');
  el.detailRemarksInput.classList.remove('input-error');

  delete state.savedReasons[m.mc];
  // No localStorage — server is synced below

  const payload = { [m.mc]: { reason: '', remarks: '', updatedAt: new Date().toISOString() } };
  fetch('/api/reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.warn('Backend sync error:', err));

  el.detailReasonSelect.value = '';
  el.detailRemarksInput.value = '';
  el.remarksGroup.style.display = 'none';
  el.savedTimestampNotice.style.display = 'none';

  showToast('Cleared reason');
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

  try {
    await fetch('/api/cutoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('Cutoff server sync warning:', err);
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

function clearCutoffDetail() {
  const shg = state.cutoffCurrentList[state.activeCutoffIndex];
  if (!shg) return;

  delete state.savedCutoff[shg.shgCode];
  // No localStorage — remove from memory and sync to server below

  const payload = { [shg.shgCode]: {} };
  fetch('/api/cutoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.warn('Cutoff server sync warning:', err));

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
    'Status'
  ];

  const rows = activeMembers.map(m => {
    const isEkycYes = m.ekyc.toLowerCase() === 'yes';
    const isPhoneYes = m.pvf;
    const isFullyVerified = (isEkycYes && isPhoneYes);
    const actionNeeded = isFullyVerified ? 'NO' : 'YES';
    const saved = state.savedReasons[m.mc] || {};

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
      csvEscape(m.st)
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

function showToast(msg) {
  el.toastNotification.textContent = msg;
  el.toastNotification.classList.add('show');
  setTimeout(() => {
    el.toastNotification.classList.remove('show');
  }, 2500);
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

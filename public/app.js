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
  selectedCutoffDate: '12.08.2026',
  cutoffSearchQuery: '',
  cutoffHasUnsaved: false
};

// DOM Elements Cache
const el = {
  // Nav Tabs
  navTabMembers: document.getElementById('navTabMembers'),
  navTabCutoff: document.getElementById('navTabCutoff'),

  // Views
  memberListView: document.getElementById('memberListView'),
  memberReasonView: document.getElementById('memberReasonView'),
  shgCutoffView: document.getElementById('shgCutoffView'),

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

  // Page 2 Navigation & Details
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

  // Reason Form & Verified Notice
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
  dateTabsBar: document.getElementById('dateTabsBar'),
  cutoffDateColumnHeader: document.getElementById('cutoffDateColumnHeader'),
  selectedDateLabelHeader: document.getElementById('selectedDateLabelHeader'),
  statCutoffTotal: document.getElementById('statCutoffTotal'),
  statCutoff12: document.getElementById('statCutoff12'),
  statCutoff13: document.getElementById('statCutoff13'),
  statCutoff14: document.getElementById('statCutoff14'),
  statCutoff15: document.getElementById('statCutoff15'),
  statCutoff16: document.getElementById('statCutoff16'),
  statCutoff17: document.getElementById('statCutoff17'),
  statCutoff18: document.getElementById('statCutoff18'),
  cutoffUnsavedNotice: document.getElementById('cutoffUnsavedNotice'),
  markAllYesBtn: document.getElementById('markAllYesBtn'),
  markAllNoBtn: document.getElementById('markAllNoBtn'),
  saveCutoffBtn: document.getElementById('saveCutoffBtn'),
  cutoffTableBody: document.getElementById('cutoffTableBody')
};

document.addEventListener('DOMContentLoaded', () => {
  loadSavedDataFromLocal();
  bindEvents();
  loadData();
});

function loadSavedDataFromLocal() {
  try {
    const rawReasons = localStorage.getItem('shg_member_reasons');
    if (rawReasons) state.savedReasons = JSON.parse(rawReasons);
  } catch (e) {
    state.savedReasons = {};
  }

  try {
    const rawCutoff = localStorage.getItem('shg_cutoff_responses');
    if (rawCutoff) state.savedCutoff = JSON.parse(rawCutoff);
  } catch (e) {
    state.savedCutoff = {};
  }
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
      const serverReasons = await reasonsRes.json();
      state.savedReasons = serverReasons || {};
      localStorage.setItem('shg_member_reasons', JSON.stringify(state.savedReasons));
    }

    if (cutoffListRes && cutoffListRes.ok) {
      state.cutoffList = await cutoffListRes.json();
    }

    if (cutoffHierRes && cutoffHierRes.ok) {
      state.cutoffHierarchy = await cutoffHierRes.json();
      populateCutoffGpDropdown();
    }

    if (cutoffApiRes && cutoffApiRes.ok) {
      const serverCutoff = await cutoffApiRes.json();
      state.savedCutoff = { ...state.savedCutoff, ...serverCutoff };
      localStorage.setItem('shg_cutoff_responses', JSON.stringify(state.savedCutoff));
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
    if (el.shgCutoffView) el.shgCutoffView.style.display = 'none';
    if (el.exportAllCsvBtn) el.exportAllCsvBtn.style.display = 'inline-flex';
    if (el.exportCutoffCsvBtn) el.exportCutoffCsvBtn.style.display = 'none';
  } else if (tabName === 'cutoff') {
    if (el.navTabMembers) el.navTabMembers.classList.remove('active');
    if (el.navTabCutoff) el.navTabCutoff.classList.add('active');
    if (el.memberListView) el.memberListView.style.display = 'none';
    if (el.memberReasonView) el.memberReasonView.style.display = 'none';
    if (el.shgCutoffView) el.shgCutoffView.style.display = 'block';
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

  // Date Tabs selection
  if (el.dateTabsBar) {
    el.dateTabsBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.date-tab');
      if (!btn) return;
      const targetDate = btn.getAttribute('data-date');
      if (targetDate && state.selectedCutoffDate !== targetDate) {
        state.selectedCutoffDate = targetDate;
        el.dateTabsBar.querySelectorAll('.date-tab').forEach(tb => {
          tb.classList.toggle('active', tb.getAttribute('data-date') === targetDate);
        });
        if (el.selectedDateLabelHeader) el.selectedDateLabelHeader.textContent = targetDate;
        renderCutoffTable();
      }
    });
  }

  // Bulk Actions
  if (el.markAllYesBtn) {
    el.markAllYesBtn.addEventListener('click', () => bulkMarkCutoff('Yes'));
  }

  if (el.markAllNoBtn) {
    el.markAllNoBtn.addEventListener('click', () => bulkMarkCutoff('No'));
  }

  if (el.saveCutoffBtn) {
    el.saveCutoffBtn.addEventListener('click', saveCutoffResponses);
  }
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

  const villages = Object.keys(state.hierarchy[state.selectedGp]).sort();
  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>' +
    villages.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.selectVillage.disabled = false;
}

function resetVillageDropdown() {
  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>';
  el.selectVillage.disabled = true;
}

function populateShgDropdown() {
  if (!state.selectedGp || !state.selectedVillage || !state.hierarchy[state.selectedGp][state.selectedVillage]) {
    resetShgDropdown();
    return;
  }

  const shgs = state.hierarchy[state.selectedGp][state.selectedVillage];
  el.selectShg.innerHTML = '<option value="">-- Select SHG --</option>' +
    shgs.map(s => `<option value="${escapeHtml(s.sc)}">${escapeHtml(s.sn)} (${escapeHtml(s.sc)})</option>`).join('');
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

  if (!state.selectedGp && !state.selectedVillage && !state.selectedShg && !state.searchQuery) {
    el.membersTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="placeholder-row">
          Please select a <strong>Gram Panchayat</strong>, <strong>Village</strong>, or <strong>SHG</strong> above to view member list.
        </td>
      </tr>
    `;
    return;
  }

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
        <td class="text-muted" style="font-size:0.8rem;">${idx + 1}</td>
        <td>
          <div class="member-name-cell">
            <span class="m-name">${escapeHtml(m.mn)}</span>
            <span class="m-code">${escapeHtml(m.mc)}</span>
          </div>
        </td>
        <td>
          <div class="member-shg-cell">
            <span class="m-shg">${escapeHtml(m.sn)}</span>
            <span class="m-village">${escapeHtml(m.vil)}</span>
          </div>
        </td>
        <td class="text-center">${ekycBadge}</td>
        <td class="text-center">${phoneBadge}</td>
        <td class="text-center">${reasonBadgeHtml}</td>
        <td class="text-center">
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
  el.shgCutoffView.style.display = 'none';
  el.memberReasonView.style.display = 'block';
  window.scrollTo(0, 0);
}

function showMemberListView() {
  el.memberReasonView.style.display = 'none';
  el.shgCutoffView.style.display = 'none';
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
  localStorage.setItem('shg_member_reasons', JSON.stringify(state.savedReasons));

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
  localStorage.setItem('shg_member_reasons', JSON.stringify(state.savedReasons));

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

  return filtered;
}

function renderCutoffTable() {
  if (!el.cutoffTableBody) return;
  if (!state.cutoffList || state.cutoffList.length === 0) {
    el.cutoffTableBody.innerHTML = '<tr><td colspan="5" class="placeholder-row">Loading SHG Cutoff data...</td></tr>';
    return;
  }

  const filtered = getFilteredCutoffList();

  // Update Header Date Label
  if (el.selectedDateLabelHeader) {
    el.selectedDateLabelHeader.textContent = state.selectedCutoffDate;
  }

  // Update Stats
  if (el.statCutoffTotal) el.statCutoffTotal.textContent = filtered.length.toLocaleString();

  const dateCounts = {};
  CUTOFF_DATES.forEach(d => dateCounts[d] = 0);

  filtered.forEach(item => {
    const resp = state.savedCutoff[item.shgCode] || {};
    CUTOFF_DATES.forEach(d => {
      if (resp[d] === 'Yes') dateCounts[d]++;
    });
  });

  if (el.statCutoff12) el.statCutoff12.textContent = dateCounts['12.08.2026'];
  if (el.statCutoff13) el.statCutoff13.textContent = dateCounts['13.08.2026'];
  if (el.statCutoff14) el.statCutoff14.textContent = dateCounts['14.08.2026'];
  if (el.statCutoff15) el.statCutoff15.textContent = dateCounts['15.08.2026'];
  if (el.statCutoff16) el.statCutoff16.textContent = dateCounts['16.08.2026'];
  if (el.statCutoff17) el.statCutoff17.textContent = dateCounts['17.08.2026'];
  if (el.statCutoff18) el.statCutoff18.textContent = dateCounts['18.08.2026'];

  if (filtered.length === 0) {
    el.cutoffTableBody.innerHTML = '<tr><td colspan="5" class="placeholder-row">No SHGs match the selected filters.</td></tr>';
    return;
  }

  // Optimize rendering for large lists
  const displayItems = (filtered.length > 300 && !state.selectedCutoffGp && !state.cutoffSearchQuery)
    ? filtered.slice(0, 300)
    : filtered;

  let html = '';
  displayItems.forEach((item, index) => {
    const resp = state.savedCutoff[item.shgCode] || {};
    const val = resp[state.selectedCutoffDate];
    const yesSel = val === 'Yes' ? 'selected' : '';
    const noSel = val === 'No' ? 'selected' : '';
    
    html += `<tr>
      <td class="text-muted" style="font-size:0.8rem;">${item.sl || (index + 1)}</td>
      <td><strong>${escapeHtml(item.gp)}</strong></td>
      <td><span>${escapeHtml(item.village)}</span></td>
      <td>
        <div class="shg-info-cell">
          <span class="shg-name-text">${escapeHtml(item.shgName)}</span>
          <span class="shg-code-text">${escapeHtml(item.shgCode)}</span>
        </div>
      </td>
      <td class="text-center">
        <div class="toggle-segment-large">
          <button class="toggle-btn-lg btn-yes ${yesSel}" data-sc="${item.shgCode}" data-dt="${state.selectedCutoffDate}" data-val="Yes" onclick="handleCutoffToggle(this)">Yes</button>
          <button class="toggle-btn-lg btn-no ${noSel}" data-sc="${item.shgCode}" data-dt="${state.selectedCutoffDate}" data-val="No" onclick="handleCutoffToggle(this)">No</button>
        </div>
      </td>
    </tr>`;
  });

  if (filtered.length > displayItems.length) {
    html += `<tr><td colspan="5" class="placeholder-row" style="padding:1rem; font-weight:600; color:var(--primary);">
      Showing first ${displayItems.length} of ${filtered.length} SHGs. Select a Gram Panchayat or Village to narrow down.
    </td></tr>`;
  }

  el.cutoffTableBody.innerHTML = html;
}

window.handleCutoffToggle = function(btn) {
  const shgCode = btn.getAttribute('data-sc');
  const date = btn.getAttribute('data-dt');
  const targetVal = btn.getAttribute('data-val');

  if (!state.savedCutoff[shgCode]) {
    state.savedCutoff[shgCode] = {};
  }

  const currentVal = state.savedCutoff[shgCode][date];
  if (currentVal === targetVal) {
    delete state.savedCutoff[shgCode][date];
  } else {
    state.savedCutoff[shgCode][date] = targetVal;
  }
  state.savedCutoff[shgCode].updatedAt = new Date().toISOString();

  // Save to local storage
  localStorage.setItem('shg_cutoff_responses', JSON.stringify(state.savedCutoff));

  state.cutoffHasUnsaved = true;
  if (el.cutoffUnsavedNotice) el.cutoffUnsavedNotice.style.display = 'inline-block';

  // Toggle visual states immediately
  const parent = btn.parentElement;
  const yesBtn = parent.querySelector('.btn-yes');
  const noBtn = parent.querySelector('.btn-no');

  const newVal = state.savedCutoff[shgCode][date];
  yesBtn.classList.toggle('selected', newVal === 'Yes');
  noBtn.classList.toggle('selected', newVal === 'No');

  // Update top stats
  updateCutoffStatsOnly();
};

function bulkMarkCutoff(val) {
  const filtered = getFilteredCutoffList();
  if (filtered.length === 0) return;

  const curDate = state.selectedCutoffDate;
  const now = new Date().toISOString();

  filtered.forEach(item => {
    if (!state.savedCutoff[item.shgCode]) {
      state.savedCutoff[item.shgCode] = {};
    }
    state.savedCutoff[item.shgCode][curDate] = val;
    state.savedCutoff[item.shgCode].updatedAt = now;
  });

  localStorage.setItem('shg_cutoff_responses', JSON.stringify(state.savedCutoff));

  state.cutoffHasUnsaved = true;
  if (el.cutoffUnsavedNotice) el.cutoffUnsavedNotice.style.display = 'inline-block';

  renderCutoffTable();
  showToast(`✓ Marked ${val} for ${filtered.length} SHGs on ${curDate}`);
}

function updateCutoffStatsOnly() {
  if (!state.cutoffList) return;

  const filtered = getFilteredCutoffList();
  if (el.statCutoffTotal) el.statCutoffTotal.textContent = filtered.length.toLocaleString();

  const dateCounts = {};
  CUTOFF_DATES.forEach(d => dateCounts[d] = 0);

  filtered.forEach(item => {
    const resp = state.savedCutoff[item.shgCode] || {};
    CUTOFF_DATES.forEach(d => {
      if (resp[d] === 'Yes') dateCounts[d]++;
    });
  });

  if (el.statCutoff12) el.statCutoff12.textContent = dateCounts['12.08.2026'];
  if (el.statCutoff13) el.statCutoff13.textContent = dateCounts['13.08.2026'];
  if (el.statCutoff14) el.statCutoff14.textContent = dateCounts['14.08.2026'];
  if (el.statCutoff15) el.statCutoff15.textContent = dateCounts['15.08.2026'];
  if (el.statCutoff16) el.statCutoff16.textContent = dateCounts['16.08.2026'];
  if (el.statCutoff17) el.statCutoff17.textContent = dateCounts['17.08.2026'];
  if (el.statCutoff18) el.statCutoff18.textContent = dateCounts['18.08.2026'];
}

async function saveCutoffResponses() {
  try {
    const res = await fetch('/api/cutoff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.savedCutoff)
    });

    if (res.ok) {
      state.cutoffHasUnsaved = false;
      if (el.cutoffUnsavedNotice) el.cutoffUnsavedNotice.style.display = 'none';
      showToast('✓ Cutoff responses saved successfully!');
    } else {
      showToast('⚠️ Saved locally, server sync failed');
    }
  } catch (err) {
    showToast('⚠️ Saved locally (Offline)');
  }
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

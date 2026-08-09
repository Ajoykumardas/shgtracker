/**
 * Clean & Direct SHG Member Verification Tracker
 */

const REASON_OPTIONS = [
  { value: '', label: '-- Select Reason --' },
  { value: 'Outstation', label: 'Outstation (Currently not present in the Village or District)' },
  { value: 'Migrated', label: 'Migrated to somewhere else / other Place' },
  { value: 'Aadhaar Demographic Mismatch', label: 'Aadhaar / Name / DOB Mismatch in Records' },
  { value: 'Left SHG / Reluctant', label: 'Member Left SHG / Unwilling / Reluctant' },
  { value: 'Other', label: 'Other Reason (Specify in Remarks)' }
];

const state = {
  hierarchy: null,
  members: [],
  savedReasons: {},     // { [memberCode]: { reason: string, remarks: string, updatedAt: string } }
  selectedGp: '',
  selectedVillage: '',
  selectedShg: '',
  searchQuery: '',
  currentList: [],
  activeMemberIndex: -1
};

// DOM Elements Cache
const el = {
  // Views
  memberListView: document.getElementById('memberListView'),
  memberReasonView: document.getElementById('memberReasonView'),

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
  exportAllCsvBtn: document.getElementById('exportAllCsvBtn'),

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
  detailReasonSelect: document.getElementById('detailReasonSelect'),
  remarksGroup: document.getElementById('remarksGroup'),
  detailRemarksInput: document.getElementById('detailRemarksInput'),
  saveReasonBtn: document.getElementById('saveReasonBtn'),
  clearReasonBtn: document.getElementById('clearReasonBtn'),
  savedTimestampNotice: document.getElementById('savedTimestampNotice'),
  savedTimestampText: document.getElementById('savedTimestampText'),
  toastNotification: document.getElementById('toastNotification')
};

document.addEventListener('DOMContentLoaded', () => {
  loadSavedReasonsFromLocal();
  bindEvents();
  loadData();
});

function loadSavedReasonsFromLocal() {
  try {
    const raw = localStorage.getItem('shg_member_reasons');
    if (raw) {
      state.savedReasons = JSON.parse(raw);
    }
  } catch (e) {
    state.savedReasons = {};
  }
}

async function loadData() {
  try {
    const [hierRes, memRes, reasonsRes] = await Promise.all([
      fetch('hierarchy_summary.json'),
      fetch('members.json'),
      fetch('/api/reasons').catch(() => null)
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
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

function bindEvents() {
  // GP Selection
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

  // Reset Selection
  el.resetAllNavBtn.addEventListener('click', resetAllSelection);

  // Search
  el.memberSearchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderMembersTable();
  });

  // Export CSV (All Members in Entire Block)
  el.exportAllCsvBtn.addEventListener('click', exportAllBlockCsv);

  // Page 2 Navigation Events
  el.backToListBtn.addEventListener('click', showListView);

  el.prevMemberBtn.addEventListener('click', () => {
    if (state.activeMemberIndex > 0) {
      openMemberReasonPage(state.activeMemberIndex - 1);
    }
  });

  el.nextMemberBtn.addEventListener('click', () => {
    if (state.activeMemberIndex < state.currentList.length - 1) {
      openMemberReasonPage(state.activeMemberIndex + 1);
    }
  });

  // Reason select change
  el.detailReasonSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    el.remarksGroup.style.display = (val === 'Other') ? 'flex' : 'none';
  });

  // Save Reason
  el.saveReasonBtn.addEventListener('click', () => {
    saveCurrentMemberReason(true);
  });

  // Clear Reason
  el.clearReasonBtn.addEventListener('click', clearCurrentMemberReason);
}

function updateSelectorFooter() {
  el.selectorFooter.style.display = (state.selectedGp || state.selectedVillage || state.selectedShg) ? 'flex' : 'none';
}

function resetAllSelection() {
  state.selectedGp = '';
  state.selectedVillage = '';
  state.selectedShg = '';
  state.searchQuery = '';
  el.selectGp.value = '';
  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>';
  el.selectVillage.disabled = true;
  resetShgDropdown();
  updateSelectorFooter();
  renderMembersTable();
}

function populateGpDropdown() {
  el.selectGp.innerHTML = '<option value="">-- Select GP --</option>';
  if (!state.hierarchy) return;

  Object.keys(state.hierarchy).sort().forEach(gp => {
    const opt = document.createElement('option');
    opt.value = gp;
    opt.textContent = gp;
    el.selectGp.appendChild(opt);
  });
}

function populateVillageDropdown() {
  el.selectVillage.innerHTML = '<option value="">-- Select Village --</option>';
  
  if (!state.selectedGp || !state.hierarchy) {
    el.selectVillage.disabled = true;
    return;
  }

  const gpData = state.hierarchy[state.selectedGp];
  if (gpData && gpData.villages) {
    Object.keys(gpData.villages).sort().forEach(vil => {
      const opt = document.createElement('option');
      opt.value = vil;
      opt.textContent = vil;
      el.selectVillage.appendChild(opt);
    });
    el.selectVillage.disabled = false;
  } else {
    el.selectVillage.disabled = true;
  }
}

function populateShgDropdown() {
  el.selectShg.innerHTML = '<option value="">-- Select SHG --</option>';
  
  if (!state.selectedGp || !state.selectedVillage || !state.hierarchy) {
    el.selectShg.disabled = true;
    return;
  }

  const gpData = state.hierarchy[state.selectedGp];
  const vilData = gpData?.villages?.[state.selectedVillage];

  if (vilData && vilData.shgs) {
    Object.values(vilData.shgs).sort((a, b) => a.name.localeCompare(b.name)).forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.code;
      opt.textContent = `${s.name} (${s.code})`;
      el.selectShg.appendChild(opt);
    });
    el.selectShg.disabled = false;
  } else {
    el.selectShg.disabled = true;
  }
}

function resetShgDropdown() {
  el.selectShg.innerHTML = '<option value="">-- Select SHG --</option>';
  el.selectShg.disabled = true;
}

// ----------------------------------------------------
// Page 1: Member List View
// ----------------------------------------------------

function showListView() {
  el.memberReasonView.style.display = 'none';
  el.memberListView.style.display = 'flex';
  renderMembersTable();
}

function renderMembersTable() {
  if (!state.selectedGp || !state.selectedVillage || !state.selectedShg) {
    el.listHeaderBar.style.display = 'none';
    el.membersTableBody.innerHTML = '<tr><td colspan="7" class="placeholder-row">Select a Gram Panchayat, Village, and SHG above to load members.</td></tr>';
    state.currentList = [];
    return;
  }

  // Find SHG Name
  const gpData = state.hierarchy?.[state.selectedGp];
  const vilData = gpData?.villages?.[state.selectedVillage];
  const shgObj = vilData?.shgs?.[state.selectedShg];
  const shgName = shgObj ? shgObj.name : state.selectedShg;

  // Filter Active members in selected SHG
  let list = state.members.filter(m => {
    return m.gp === state.selectedGp &&
           m.vil === state.selectedVillage &&
           m.sc === state.selectedShg &&
           m.st === 'ACTIVE';
  });

  // Calculate statistics
  let pendingCount = 0;
  list.forEach(m => {
    const isEkycPending = (m.ekyc.toLowerCase() === 'no' || m.ekyc === '-');
    const isPhonePending = (!m.pvf);
    if (isEkycPending || isPhonePending) {
      pendingCount++;
    }
  });

  // Filter by search query if present
  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(m => 
      m.mn.toLowerCase().includes(q) ||
      m.mc.toLowerCase().includes(q) ||
      m.ebkn.toLowerCase().includes(q) ||
      m.ebkid.toLowerCase().includes(q)
    );
  }

  state.currentList = list;

  // Update List Header Bar
  el.listHeaderBar.style.display = 'flex';
  el.currentShgHeading.textContent = `${shgName} (${state.selectedShg})`;
  el.memberStatsBadge.textContent = `${list.length} Members (${pendingCount} Pending)`;

  if (list.length === 0) {
    el.membersTableBody.innerHTML = `<tr><td colspan="7" class="placeholder-row">No active members found in this SHG matching search.</td></tr>`;
    return;
  }

  el.membersTableBody.innerHTML = '';

  list.forEach((m, idx) => {
    const row = document.createElement('tr');

    const isEkycYes = m.ekyc.toLowerCase() === 'yes';
    const isEkycNo = m.ekyc.toLowerCase() === 'no';
    const isPhoneYes = m.pvf;
    const isFullyVerified = (isEkycYes && isPhoneYes);

    const ekycBadge = isEkycYes 
      ? '<span class="status-badge badge-success">✓ Yes</span>' 
      : isEkycNo 
        ? '<span class="status-badge badge-danger">✕ No</span>' 
        : '<span class="status-badge badge-warning">Pending (-)</span>';

    const phoneBadge = isPhoneYes 
      ? '<span class="status-badge badge-success">✓ Yes (TRUE)</span>' 
      : '<span class="status-badge badge-danger">✕ No (FALSE)</span>';

    const ebkDisplay = (m.ebkn || m.ebkid)
      ? `<strong>${escapeHtml(m.ebkn || '-')}</strong><span class="code-font" style="display:block; font-size:0.75rem;">ID: ${escapeHtml(m.ebkid || '-')}</span>`
      : '<span style="color:var(--text-muted);">-</span>';

    // Saved reason display
    const saved = state.savedReasons[m.mc];
    let reasonDisplay = '';
    if (isFullyVerified) {
      reasonDisplay = '<span class="status-badge badge-success">✓ Verified</span>';
    } else if (saved && saved.reason) {
      reasonDisplay = `<span class="reason-logged-tag">✓ ${escapeHtml(saved.reason)}</span>`;
    } else {
      reasonDisplay = '<span class="status-badge badge-warning">Pending Reason</span>';
    }

    const actionButtonText = isFullyVerified ? 'View' : (saved && saved.reason ? 'Edit' : 'Select');
    const actionButtonClass = isFullyVerified ? 'btn-outline' : (saved && saved.reason ? 'btn-outline' : 'btn-primary');

    row.innerHTML = `
      <td style="color:var(--text-muted); font-size:0.8rem;">${idx + 1}</td>
      <td>
        <span class="member-name">${escapeHtml(m.mn)}</span>
        <span class="code-font">${escapeHtml(m.mc)}</span>
      </td>
      <td>${ekycBadge}</td>
      <td>${phoneBadge}</td>
      <td>${ebkDisplay}</td>
      <td>${reasonDisplay}</td>
      <td>
        <button class="btn btn-xs ${actionButtonClass} select-member-btn" data-index="${idx}">
          ${actionButtonText} ➔
        </button>
      </td>
    `;

    row.querySelector('.select-member-btn').addEventListener('click', () => {
      openMemberReasonPage(idx);
    });

    el.membersTableBody.appendChild(row);
  });
}

// ----------------------------------------------------
// Page 2: Dedicated Member Detail & Reason Capture Page
// ----------------------------------------------------

function openMemberReasonPage(index) {
  if (index < 0 || index >= state.currentList.length) return;
  state.activeMemberIndex = index;
  const m = state.currentList[index];

  // Switch View
  el.memberListView.style.display = 'none';
  el.memberReasonView.style.display = 'flex';
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Update Page Navigation
  el.memberIndexDisplay.textContent = `${index + 1} of ${state.currentList.length}`;
  el.prevMemberBtn.disabled = (index === 0);
  el.nextMemberBtn.disabled = (index === state.currentList.length - 1);

  // Populate Member Profile Header
  el.detGpTag.textContent = m.gp;
  el.detVillageTag.textContent = m.vil;
  el.detShgTag.textContent = m.sn;
  el.detMemberName.textContent = m.mn;
  el.detMemberCode.textContent = `Member Code: ${m.mc}`;

  // Verification Statuses
  const isEkycYes = m.ekyc.toLowerCase() === 'yes';
  const isPhoneYes = m.pvf;
  const isFullyVerified = (isEkycYes && isPhoneYes);

  el.detEkycVal.textContent = isEkycYes ? 'Yes (Verified)' : (m.ekyc === '-' ? 'Pending (-)' : 'No');
  el.detEkycVal.className = `stat-value ${isEkycYes ? 'text-success' : 'text-danger'}`;

  el.detPhoneVal.textContent = isPhoneYes ? 'TRUE (Verified)' : 'FALSE (Pending)';
  el.detPhoneVal.className = `stat-value ${isPhoneYes ? 'text-success' : 'text-danger'}`;

  el.detEbkVal.textContent = (m.ebkn || m.ebkid) ? `${m.ebkn || '-'} (${m.ebkid || '-'})` : 'Not Assigned';

  // Toggle Reason Section: ONLY show for pending members!
  if (isFullyVerified) {
    el.verifiedMemberNotice.style.display = 'block';
    el.reasonFormCard.style.display = 'none';
  } else {
    el.verifiedMemberNotice.style.display = 'none';
    el.reasonFormCard.style.display = 'block';

    // Load Saved Reason (if any)
    const saved = state.savedReasons[m.mc] || { reason: '', remarks: '', updatedAt: '' };
    el.detailReasonSelect.value = saved.reason || '';

    if (saved.reason === 'Other') {
      el.remarksGroup.style.display = 'flex';
      el.detailRemarksInput.value = saved.remarks || '';
    } else {
      el.remarksGroup.style.display = 'none';
      el.detailRemarksInput.value = saved.remarks || '';
    }

    if (saved.updatedAt) {
      el.savedTimestampNotice.style.display = 'block';
      el.savedTimestampText.textContent = new Date(saved.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      el.savedTimestampNotice.style.display = 'none';
    }
  }
}

function saveCurrentMemberReason(advanceNext = false) {
  if (state.activeMemberIndex < 0 || state.activeMemberIndex >= state.currentList.length) return;
  const m = state.currentList[state.activeMemberIndex];
  const reason = el.detailReasonSelect.value;
  const remarks = el.detailRemarksInput.value.trim();
  const timestamp = new Date().toISOString();

  if (!reason) {
    delete state.savedReasons[m.mc];
    showToast('Reason cleared');
  } else {
    state.savedReasons[m.mc] = {
      reason,
      remarks,
      updatedAt: timestamp
    };
    showToast(`✓ Saved: ${reason}`);
  }

  // Persist LocalStorage
  localStorage.setItem('shg_member_reasons', JSON.stringify(state.savedReasons));

  // Persist to Server API
  fetch('/api/reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [m.mc]: state.savedReasons[m.mc] || { reason: '', remarks: '', updatedAt: timestamp } })
  }).catch(() => {});

  // Update timestamp notice
  el.savedTimestampNotice.style.display = reason ? 'block' : 'none';
  el.savedTimestampText.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Auto-advance to next member if requested
  if (advanceNext && state.activeMemberIndex < state.currentList.length - 1) {
    setTimeout(() => {
      openMemberReasonPage(state.activeMemberIndex + 1);
    }, 300);
  }
}

function clearCurrentMemberReason() {
  if (state.activeMemberIndex < 0 || state.activeMemberIndex >= state.currentList.length) return;
  const m = state.currentList[state.activeMemberIndex];
  el.detailReasonSelect.value = '';
  el.detailRemarksInput.value = '';
  el.remarksGroup.style.display = 'none';

  delete state.savedReasons[m.mc];
  localStorage.setItem('shg_member_reasons', JSON.stringify(state.savedReasons));

  fetch('/api/reasons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [m.mc]: { reason: '', remarks: '', updatedAt: new Date().toISOString() } })
  }).catch(() => {});

  el.savedTimestampNotice.style.display = 'none';
  showToast('Reason cleared');
}

function showToast(msg) {
  el.toastNotification.textContent = msg;
  el.toastNotification.classList.add('show');
  clearTimeout(showToast._timeout);
  showToast._timeout = setTimeout(() => {
    el.toastNotification.classList.remove('show');
  }, 2000);
}

// ----------------------------------------------------
// CSV Export: ALL Block Members with Responses
// ----------------------------------------------------

function exportAllBlockCsv() {
  if (!state.members || state.members.length === 0) {
    alert('Member dataset is loading. Please wait a moment.');
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
    const actionNeeded = (!isEkycYes || !isPhoneYes) ? 'YES' : 'NO';
    const saved = state.savedReasons[m.mc] || {};

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
      csvEscape(saved.reason || ''),
      csvEscape(saved.remarks || ''),
      csvEscape(saved.updatedAt || ''),
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

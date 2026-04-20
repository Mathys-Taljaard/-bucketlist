/* ============================================
   BUCKET LIST APP — Logic
   ============================================ */

// ---- Config ----
const LOGIN_CODE = "PARIS2026LYLA";
const STORAGE_KEY = "bl_items";
const USER_KEY = "bl_userName";
const REACTION_EMOJIS = ["❤️", "🔥", "✈️", "⭐"];

// 🤖 AI Auto-Fill — Get a FREE Gemini API key at https://aistudio.google.com/app/apikey
// Paste your key below (free tier = 15 requests/min, plenty for this app)
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
const ONLINE_KEY = "bl_onlineUsers";
const AVATARS_KEY = "bl_avatars";  // shared map: { "userName": "avatarUrl or emoji" }

// Fun default avatar emojis to pick from
const AVATAR_EMOJIS = ["😎", "🤠", "🧑‍✈️", "🧳", "🌴", "🏔️", "🦩", "🐻", "🦁", "🎒", "🚀", "🌺", "🎯", "🏄", "🧗"];

// ---- State ----
let currentUser = localStorage.getItem(USER_KEY) || "";
let items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let avatars = JSON.parse(localStorage.getItem(AVATARS_KEY) || "{}");
let currentFilter = "all";
let currentView = localStorage.getItem("bl_view") || "grid";
let editingItemId = null;  // null = adding new, string = editing existing
let groupByUser = false;

// ---- DOM refs ----
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const loginScreen   = $("#login-screen");
const appScreen     = $("#app-screen");
const codeForm      = $("#code-form");
const nameForm      = $("#name-form");
const codeInput     = $("#code-input");
const nameInput     = $("#name-input");
const codeError     = $("#code-error");
const userDisplay   = $("#user-display");
const statTotal     = $("#stat-total");
const statDone      = $("#stat-done");
const emptyState    = $("#empty-state");
const itemsGrid     = $("#items-grid");
const fab           = $("#fab");
const emptyAddBtn   = $("#empty-add-btn");
const logoutBtn     = $("#logout-btn");
const addModal      = $("#add-modal");
const modalClose    = $("#modal-close");
const modalUsername  = $("#modal-username");
const itemTitle     = $("#item-title");
const itemFacts     = $("#item-facts");
const itemImage     = $("#item-image");
const autoFetchBtn  = $("#auto-fetch-btn");
const fetchText     = $("#fetch-text");
const fetchLoading  = $("#fetch-loading");
const photoSelector = $("#photo-selector");
const photoGrid     = $("#photo-grid");
const imagePreview  = $("#image-preview");
const previewImg    = $("#preview-img");
const saveBtn       = $("#save-btn");
const cancelBtn     = $("#cancel-btn");
const viewGridBtn   = $("#view-grid");
const viewListBtn   = $("#view-list");
const confettiBox   = $("#confetti-container");
const onlineUsersEl = $("#online-users");
const linksContainer = $("#links-container");
const addLinkBtn    = $("#add-link-btn");
const avatarPicker  = $("#avatar-picker");
const avatarUrlInput = $("#avatar-url");
const avatarPreviewWrap = $("#avatar-preview-wrap");
const avatarPreviewImg  = $("#avatar-preview");

// ============ INIT ============
(function init() {
  // Returning user with saved profile → skip code, show name+avatar pre-filled
  if (currentUser) {
    codeForm.hidden = true;
    nameForm.hidden = false;
    nameInput.value = currentUser;
  }

  // Build avatar emoji picker (login + profile edit)
  buildAvatarPicker();
  buildProfileAvatarPicker();

  // Pre-select current avatar if returning user
  if (currentUser && avatars[currentUser]) {
    preselectAvatar(avatarPicker, avatarUrlInput, avatarPreviewWrap, avatarPreviewImg, avatars[currentUser]);
  }

  // Login flow — code step (only shown for new users)
  codeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (codeInput.value.toUpperCase() === LOGIN_CODE) {
      codeError.hidden = true;
      codeForm.hidden = true;
      nameForm.hidden = false;
      nameInput.focus();
    } else {
      codeError.textContent = "Wrong code! Try again ✈️";
      codeError.hidden = false;
      codeInput.classList.add("shake");
      setTimeout(() => codeInput.classList.remove("shake"), 400);
    }
  });

  nameForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    currentUser = name;
    localStorage.setItem(USER_KEY, name);

    // Save avatar choice (shared avatars map so all users see each other's pics)
    const selectedEmoji = avatarPicker.querySelector(".avatar-option.selected");
    const customUrl = avatarUrlInput.value.trim();
    if (customUrl) {
      avatars[name] = customUrl;
    } else if (selectedEmoji) {
      avatars[name] = selectedEmoji.dataset.avatar;
    }
    localStorage.setItem(AVATARS_KEY, JSON.stringify(avatars));

    showApp();
  });

  // Custom avatar URL preview
  avatarUrlInput.addEventListener("input", () => {
    const url = avatarUrlInput.value.trim();
    if (url) {
      avatarPreviewImg.src = url;
      avatarPreviewWrap.hidden = false;
      avatarPicker.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    } else {
      avatarPreviewWrap.hidden = true;
    }
  });

  // File upload for login avatar
  $("#avatar-file").addEventListener("change", (e) => {
    handleAvatarFile(e.target.files[0], avatarUrlInput, avatarPreviewImg, avatarPreviewWrap, avatarPicker);
  });

  // Logout
  logoutBtn.addEventListener("click", () => {
    goOffline();
    currentUser = "";
    localStorage.removeItem(USER_KEY);
    loginScreen.hidden = false;
    appScreen.hidden = true;
    codeForm.hidden = false;
    nameForm.hidden = true;
    codeInput.value = "";
    nameInput.value = "";
    avatarUrlInput.value = "";
    avatarPreviewWrap.hidden = true;
    avatarPicker.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
  });

  // Filters
  $$(".filter-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      currentFilter = pill.dataset.filter;
      $$(".filter-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      renderItems();
    });
  });

  // View toggle
  viewGridBtn.addEventListener("click", () => setView("grid"));
  viewListBtn.addEventListener("click", () => setView("list"));
  $("#view-group").addEventListener("click", () => {
    groupByUser = !groupByUser;
    $("#view-group").classList.toggle("active", groupByUser);
    renderItems();
  });

  // Modal open/close
  fab.addEventListener("click", openModal);
  emptyAddBtn.addEventListener("click", openModal);
  modalClose.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  addModal.addEventListener("click", (e) => { if (e.target === addModal) closeModal(); });

  // Auto-fetch
  autoFetchBtn.addEventListener("click", handleAutoFetch);

  // Image URL → preview
  itemImage.addEventListener("input", () => {
    const url = itemImage.value.trim();
    if (url) {
      previewImg.src = url;
      imagePreview.hidden = false;
    } else {
      imagePreview.hidden = true;
    }
  });

  // Save
  saveBtn.addEventListener("click", handleSave);

  // Add-link button in modal
  addLinkBtn.addEventListener("click", () => addLinkRow());

  // Quick booking/travel link buttons
  $$(".quick-link-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const title = itemTitle.value.trim();
      const q = encodeURIComponent(title || "destination");
      const type = btn.dataset.type;
      const linkMap = {
        booking:     { url: `https://www.booking.com/searchresults.html?ss=${q}`, label: "🏨 Booking.com" },
        flights:     { url: `https://www.google.com/travel/flights?q=${q}`, label: "✈️ Google Flights" },
        tripadvisor: { url: `https://www.tripadvisor.com/Search?q=${q}`, label: "⭐ TripAdvisor" },
        maps:        { url: `https://www.google.com/maps/search/${q}`, label: "📍 Google Maps" },
      };
      const link = linkMap[type];
      if (link) addLinkRow(link.url, link.label);
    });
  });

  // Profile edit
  const editProfileBtn = $("#edit-profile-btn");
  editProfileBtn.addEventListener("click", openProfileModal);
  $("#profile-modal-close").addEventListener("click", closeProfileModal);
  $("#profile-cancel-btn").addEventListener("click", closeProfileModal);
  $("#profile-modal").addEventListener("click", (e) => { if (e.target.id === "profile-modal") closeProfileModal(); });
  $("#profile-save-btn").addEventListener("click", saveProfile);
  $("#profile-delete-btn").addEventListener("click", deleteProfile);

  // Profile avatar URL preview
  $("#profile-avatar-url").addEventListener("input", () => {
    const url = $("#profile-avatar-url").value.trim();
    if (url) {
      $("#profile-avatar-preview").src = url;
      $("#profile-avatar-preview-wrap").hidden = false;
      $("#profile-avatar-picker").querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    } else {
      $("#profile-avatar-preview-wrap").hidden = true;
    }
  });

  // File upload for profile avatar
  $("#profile-avatar-file").addEventListener("change", (e) => {
    handleAvatarFile(e.target.files[0], $("#profile-avatar-url"), $("#profile-avatar-preview"), $("#profile-avatar-preview-wrap"), $("#profile-avatar-picker"));
  });

  // Escape key closes any open modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!addModal.hidden) closeModal();
      if (!$("#profile-modal").hidden) closeProfileModal();
      const dm = $("#detail-modal");
      if (dm && !dm.hidden) dm.hidden = true;
    }
  });
})();

// ============ APP VIEWS ============
function setView(view) {
  currentView = view;
  localStorage.setItem("bl_view", view);
  viewGridBtn.classList.toggle("active", view === "grid");
  viewListBtn.classList.toggle("active", view === "list");
  itemsGrid.classList.toggle("list-view", view === "list");
}

function showApp() {
  loginScreen.hidden = true;
  appScreen.hidden = false;
  userDisplay.innerHTML = avatarHTML(currentUser, "mini") + " " + esc(currentUser);
  setView(currentView);
  goOnline();
  renderItems();
}

function renderItems() {
  avatars = JSON.parse(localStorage.getItem(AVATARS_KEY) || "{}");
  const filtered = items.filter((item) => {
    if (currentFilter === "todo") return !item.completed;
    if (currentFilter === "done") return item.completed;
    return true;
  });

  statTotal.textContent = items.length;
  statDone.textContent = items.filter((i) => i.completed).length;
  updateProgress();

  if (filtered.length === 0) {
    itemsGrid.innerHTML = "";
    emptyState.hidden = false;
    const emoji = $(".empty-emoji");
    const h2 = emptyState.querySelector("h2");
    const p = emptyState.querySelector("p");
    if (currentFilter === "all") {
      emoji.textContent = "✈️";
      h2.textContent = "Your adventure awaits!";
      p.textContent = "Add your first bucket list item and start dreaming ✨";
      emptyAddBtn.hidden = false;
    } else if (currentFilter === "todo") {
      emoji.textContent = "🎉";
      h2.textContent = "Everything's done!";
      p.textContent = "Amazing — you've completed all your dreams!";
      emptyAddBtn.hidden = true;
    } else {
      emoji.textContent = "📋";
      h2.textContent = "Nothing completed yet!";
      p.textContent = "Get out there and start checking things off ✈️";
      emptyAddBtn.hidden = true;
    }
    return;
  }

  emptyState.hidden = true;

  // Always group items by person
  const groups = {};
  filtered.forEach(item => {
    const user = item.addedBy || "Unknown";
    if (!groups[user]) groups[user] = [];
    groups[user].push(item);
  });

  // Current user first, then alphabetical
  const sortedUsers = Object.keys(groups).sort((a, b) => {
    if (a === currentUser) return -1;
    if (b === currentUser) return 1;
    return a.localeCompare(b);
  });

  let html = "";
  sortedUsers.forEach(user => {
    const userItems = groups[user];
    const doneCount = userItems.filter(i => i.completed).length;
    const av = avatarHTML(user, "group");
    html += `<div class="user-group">
      <div class="user-group-header">
        ${av}
        <span class="user-group-name">${esc(user)}${user === currentUser ? " (You)" : ""}</span>
        <span class="user-group-count">${userItems.length} dream${userItems.length !== 1 ? "s" : ""} · ${doneCount} done</span>
      </div>
      <div class="items-grid ${currentView === "list" ? "list-view" : ""}">
        ${userItems.map(item => cardHTML(item)).join("")}
      </div>
    </div>`;
  });
  itemsGrid.innerHTML = html;

  // Stagger animation
  itemsGrid.querySelectorAll(".bucket-card").forEach((card, i) => {
    card.style.animationDelay = `${i * 0.07}s`;
  });

  // Bind card events
  bindCardEvents();
}

function cardHTML(item) {
  const reactions = item.reactions || {};
  const imgSection = item.image
    ? `<div class="card-img-wrap" style="overflow:hidden"><img class="card-image" src="${esc(item.image)}" alt="${esc(item.title)}" onerror="this.parentElement.innerHTML='<div class=card-image-fallback>${item.completed ? "✅" : "🌍"}</div>'"/></div>`
    : `<div class="card-img-wrap"><div class="card-image-fallback">${item.completed ? "✅" : "🌍"}</div></div>`;

  const completedBadge = item.completedBy
    ? `<span class="done-by">${avatarHTML(item.completedBy, "mini")} ✓ Done by <strong>${esc(item.completedBy)}</strong></span>`
    : "";

  // Show only a short preview of facts on the card
  const factsText = item.facts || "";
  const shortFacts = factsText.length > 120 ? factsText.substring(0, 120) + "…" : factsText;
  const factsHTML = shortFacts
    ? `<p class="card-facts">${esc(shortFacts)}</p>`
    : "";

  // Count links to hint they exist
  const linksList = item.links || (item.link ? [{ url: item.link, label: "Learn more" }] : []);
  const linksHint = linksList.length > 0 ? `<span class="links-hint">🔗 ${linksList.length} link${linksList.length > 1 ? "s" : ""}</span>` : "";

  const reactionsHTML = REACTION_EMOJIS.map((emoji) => {
    const list = reactions[emoji] || [];
    const reacted = list.includes(currentUser);
    const count = list.length;
    const tooltip = list.length ? list.join(", ") : "Be the first!";
    return `<button class="reaction-btn ${reacted ? "reacted" : ""}" data-id="${item.id}" data-emoji="${emoji}" title="${esc(tooltip)}">
      <span>${emoji}</span>${count > 0 ? `<span class="reaction-count">${count}</span>` : ""}
    </button>`;
  }).join("");

  return `
    <div class="bucket-card glass ${item.completed ? "completed" : ""}" data-id="${item.id}">
      ${imgSection}
      <div class="card-body">
        <div class="card-top">
          <h3 class="card-title ${item.completed ? "done" : ""}">${esc(item.title)}</h3>
          <div class="card-actions">
            <button class="btn-icon edit-btn" data-id="${item.id}" title="Edit">✏️</button>
            <button class="btn-icon toggle-complete" data-id="${item.id}" title="${item.completed ? "Mark incomplete" : "Mark complete!"}">${item.completed ? "✅" : "⭕"}</button>
            <button class="btn-icon delete-btn" data-id="${item.id}" title="Delete">🗑️</button>
          </div>
        </div>
        <div class="card-meta">
          <span class="added-by">${avatarHTML(item.addedBy, "mini")} Added by <strong>${esc(item.addedBy)}</strong></span>
          ${completedBadge}
        </div>
        ${factsHTML}
        <div class="card-footer">
          <button class="btn-view-details" data-id="${item.id}">View Details ${linksHint}</button>
        </div>
        <div class="card-reactions">${reactionsHTML}</div>
      </div>
    </div>`;
}

function bindCardEvents() {
  // Edit
  itemsGrid.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });

  // Toggle complete
  itemsGrid.querySelectorAll(".toggle-complete").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const item = items.find((i) => i.id === id);
      if (!item) return;
      item.completed = !item.completed;
      item.completedBy = item.completed ? currentUser : null;
      if (item.completed) burstConfetti();
      saveItems();
      renderItems();
    });
  });

  // Delete (double-click confirm)
  itemsGrid.querySelectorAll(".delete-btn").forEach((btn) => {
    let confirmTimeout;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("confirm-delete")) {
        items = items.filter((i) => i.id !== btn.dataset.id);
        saveItems();
        renderItems();
      } else {
        btn.classList.add("confirm-delete");
        btn.title = "Click again to delete!";
        clearTimeout(confirmTimeout);
        confirmTimeout = setTimeout(() => {
          btn.classList.remove("confirm-delete");
          btn.title = "Delete";
        }, 3000);
      }
    });
  });

  // Reactions
  itemsGrid.querySelectorAll(".reaction-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const emoji = btn.dataset.emoji;
      const item = items.find((i) => i.id === id);
      if (!item) return;
      if (!item.reactions) item.reactions = {};
      if (!item.reactions[emoji]) item.reactions[emoji] = [];
      const list = item.reactions[emoji];
      const idx = list.indexOf(currentUser);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(currentUser);
        emojiRain(emoji, 2000);
      }
      saveItems();
      renderItems();
    });
  });

  // View Details
  itemsGrid.querySelectorAll(".btn-view-details").forEach((btn) => {
    btn.addEventListener("click", () => openDetailModal(btn.dataset.id));
  });
}

// ============ DETAIL MODAL ============
const detailModal = $("#detail-modal");
const detailTitle = $("#detail-title");
const detailBody = $("#detail-body");
const detailClose = $("#detail-modal-close");

detailClose?.addEventListener("click", () => detailModal.hidden = true);
detailModal?.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.hidden = true;
});

function openDetailModal(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  detailTitle.textContent = `🌍 ${item.title}`;

  const linksList = item.links || (item.link ? [{ url: item.link, label: "Learn more" }] : []);
  const linksHTML = linksList.length > 0
    ? `<div class="detail-links">
        <h4>🔗 Links & Resources</h4>
        ${linksList.map(l =>
          `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="detail-link">
            🔗 ${esc(l.label || l.url)} <span class="arrow">↗</span>
          </a>`
        ).join("")}
      </div>`
    : "";

  const imgHTML = item.image
    ? `<img class="detail-image" src="${esc(item.image)}" alt="${esc(item.title)}" onerror="this.hidden=true" />`
    : "";

  const factsHTML = item.facts
    ? `<div class="detail-facts"><p>${esc(item.facts)}</p></div>`
    : "";

  const metaHTML = `<div class="detail-meta">
    <span>${avatarHTML(item.addedBy, "mini")} Added by <strong>${esc(item.addedBy)}</strong></span>
    ${item.completedBy ? `<span class="done-by">${avatarHTML(item.completedBy, "mini")} ✓ Done by <strong>${esc(item.completedBy)}</strong></span>` : ""}
    ${item.createdAt ? `<span class="detail-date">📅 ${new Date(item.createdAt).toLocaleDateString()}</span>` : ""}
  </div>`;

  detailBody.innerHTML = `
    ${imgHTML}
    ${metaHTML}
    ${factsHTML}
    ${linksHTML}
    <div class="detail-actions">
      <button class="btn-gold" id="detail-edit-btn">✏️ Edit Item</button>
    </div>
  `;

  // Wire edit button inside detail modal
  $("#detail-edit-btn")?.addEventListener("click", () => {
    detailModal.hidden = true;
    openEditModal(itemId);
  });

  detailModal.hidden = false;
}

// ============ MODAL ============
function openModal() {
  editingItemId = null;
  addModal.hidden = false;
  $("#modal-title").textContent = "🌟 New Adventure";
  saveBtn.textContent = "＋ Add to Bucket List 🎉";
  modalUsername.textContent = currentUser;
  itemTitle.focus();
}

function openEditModal(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  addModal.hidden = false;
  $("#modal-title").textContent = "✏️ Edit Adventure";
  saveBtn.textContent = "💾 Save Changes";
  modalUsername.textContent = currentUser;

  // Pre-fill form
  itemTitle.value = item.title || "";
  itemFacts.value = item.facts || "";
  itemImage.value = item.image || "";

  // Show image preview if exists
  if (item.image) {
    previewImg.src = item.image;
    imagePreview.hidden = false;
  }

  // Pre-fill links
  const linksList = item.links || (item.link ? [{ url: item.link, label: "Learn more" }] : []);
  if (linksList.length > 0) {
    populateLinksForm(linksList);
  }

  itemTitle.focus();
}

function closeModal() {
  addModal.hidden = true;
  editingItemId = null;
  resetModalForm();
}

function resetModalForm() {
  itemTitle.value = "";
  itemFacts.value = "";
  itemImage.value = "";
  photoSelector.hidden = true;
  photoGrid.innerHTML = "";
  imagePreview.hidden = true;
  // Reset links to single empty row
  linksContainer.innerHTML = `<div class="link-row">
    <input type="url" class="link-input" placeholder="https://..." />
    <input type="text" class="link-label-input" placeholder="Label (e.g. Official site)" />
  </div>`;
}

// ============ PROFILE EDIT MODAL ============
function openProfileModal() {
  const pm = $("#profile-modal");
  pm.hidden = false;
  $("#profile-name").value = currentUser;
  // Pre-select current avatar
  const picker = $("#profile-avatar-picker");
  const urlInput = $("#profile-avatar-url");
  const previewWrap = $("#profile-avatar-preview-wrap");
  const previewImgEl = $("#profile-avatar-preview");
  preselectAvatar(picker, urlInput, previewWrap, previewImgEl, avatars[currentUser] || "");
  $("#profile-name").focus();
}

function closeProfileModal() {
  $("#profile-modal").hidden = true;
}

function deleteProfile() {
  const name = currentUser;
  if (!confirm(`⚠️ Are you sure you want to delete your profile "${name}"?\n\nThis will remove ALL your bucket list items, reactions, and avatar permanently.`)) return;
  if (!confirm(`🚨 Last chance! This cannot be undone.\n\nDelete profile "${name}" and all associated data?`)) return;

  // Remove all items added by this user
  items = items.filter(i => i.addedBy !== name);

  // Remove this user's reactions from remaining items
  items.forEach(item => {
    if (item.reactions) {
      for (const emoji of REACTION_EMOJIS) {
        if (item.reactions[emoji]) {
          item.reactions[emoji] = item.reactions[emoji].filter(n => n !== name);
        }
      }
    }
    if (item.completedBy === name) item.completedBy = null;
  });
  saveItems();

  // Remove avatar
  delete avatars[name];
  localStorage.setItem(AVATARS_KEY, JSON.stringify(avatars));

  // Go offline
  goOffline();

  // Clear user session
  localStorage.removeItem(USER_KEY);
  currentUser = "";

  // Close modal and go back to login
  closeProfileModal();
  appScreen.hidden = true;
  loginScreen.hidden = false;
  codeForm.hidden = false;
  nameForm.hidden = true;
  nameInput.value = "";
  codeInput.value = "";
}

function saveProfile() {
  const newName = $("#profile-name").value.trim();
  if (!newName) { $("#profile-name").focus(); return; }

  const oldName = currentUser;

  // Get selected avatar
  const picker = $("#profile-avatar-picker");
  const selectedEmoji = picker.querySelector(".avatar-option.selected");
  const customUrl = $("#profile-avatar-url").value.trim();
  let newAvatar = avatars[oldName] || "";
  if (customUrl) {
    newAvatar = customUrl;
  } else if (selectedEmoji) {
    newAvatar = selectedEmoji.dataset.avatar;
  }

  // Update name in all items if changed
  if (newName !== oldName) {
    items.forEach(item => {
      if (item.addedBy === oldName) item.addedBy = newName;
      if (item.completedBy === oldName) item.completedBy = newName;
      // Update reactions
      for (const emoji of REACTION_EMOJIS) {
        const list = item.reactions?.[emoji] || [];
        const idx = list.indexOf(oldName);
        if (idx !== -1) list[idx] = newName;
      }
    });
    saveItems();

    // Update online status
    const online = JSON.parse(localStorage.getItem(ONLINE_KEY) || "{}");
    if (online[oldName]) {
      online[newName] = online[oldName];
      delete online[oldName];
      localStorage.setItem(ONLINE_KEY, JSON.stringify(online));
    }

    // Move avatar
    if (avatars[oldName]) delete avatars[oldName];
  }

  currentUser = newName;
  localStorage.setItem(USER_KEY, newName);
  avatars[newName] = newAvatar;
  localStorage.setItem(AVATARS_KEY, JSON.stringify(avatars));

  userDisplay.innerHTML = avatarHTML(currentUser, "mini") + " " + esc(currentUser);
  closeProfileModal();
  renderItems();
  renderOnlineUsers();
}

// ============ AUTO-FETCH ============
// Extract the LOCATION / PLACE from a bucket list title
// "Hot air balloon ride in Kenya (Serengeti)" → location: "Kenya Serengeti", activity: "Hot air balloon ride"
function extractLocationAndActivity(title) {
  const clean = title.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  // Split on prepositions that usually precede a place name
  const locMatch = clean.match(/\b(?:in|at|near|around|across|over|through|on|of)\s+(.+)$/i);
  let location = "";
  let activity = clean;
  if (locMatch) {
    location = locMatch[1].trim();
    activity = clean.substring(0, locMatch.index).trim();
  }
  // Also look for well-known location indicators (capitalized multi-word at end)
  if (!location) {
    const words = clean.split(/\s+/);
    // Take trailing capitalized words as potential location
    const trailing = [];
    for (let i = words.length - 1; i >= 0; i--) {
      if (/^[A-Z]/.test(words[i])) trailing.unshift(words[i]);
      else break;
    }
    if (trailing.length >= 1 && trailing.length < words.length) {
      location = trailing.join(" ");
    }
  }
  return { location, activity, clean };
}

async function handleAutoFetch() {
  const title = itemTitle.value.trim();
  if (!title) return;

  autoFetchBtn.disabled = true;
  fetchText.hidden = true;
  fetchLoading.hidden = false;

  // Clean title: remove parentheses brackets, normalize whitespace
  const cleanTitle = title.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const { location } = extractLocationAndActivity(title);

  console.log("[AutoFetch] title:", title, "| cleanTitle:", cleanTitle, "| location:", location);

  try {
    // Always search with the EXACT cleaned title first (e.g. "Lake Como", "Hot air balloon ride in Kenya Serengeti")
    // The Wikipedia/Wikivoyage functions now try direct page lookup first, so "Lake Como" → exact article
    const hasGemini = GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY";
    const [wikivoyage, wiki, ddg, aiResult] = await Promise.all([
      fetchWikivoyage(cleanTitle),
      fetchWikipedia(cleanTitle),
      fetchDuckDuckGo(cleanTitle),
      hasGemini ? fetchGeminiInfo(title) : Promise.resolve(null),
    ]);

    // If the full title didn't find good wiki results AND there's a location part, try just the location
    let wikiResult = wiki;
    let wikivoyageResult = wikivoyage;
    if (!wiki?.extract && location) {
      wikiResult = await fetchWikipedia(location);
    }
    if (!wikivoyage?.extract && location) {
      wikivoyageResult = await fetchWikivoyage(location);
    }

    // ---- FACTS ----
    // Priority: Gemini AI > Wikivoyage (travel-focused) > Wikipedia > DuckDuckGo > default
    if (aiResult?.facts) {
      itemFacts.value = aiResult.facts;
    } else if (wikivoyageResult?.extract) {
      itemFacts.value = wikivoyageResult.extract;
    } else if (wikiResult?.extract) {
      itemFacts.value = wikiResult.extract;
    } else if (ddg?.abstract) {
      itemFacts.value = ddg.abstract;
    } else {
      // Generate a helpful default
      itemFacts.value = `${title} — an incredible bucket list experience! Search online for travel guides, booking options, and tips from fellow adventurers.`;
    }

    // ---- LINKS ---- (collect from all sources)
    const collectedLinks = [];

    if (aiResult?.links && Array.isArray(aiResult.links)) {
      aiResult.links.forEach(l => collectedLinks.push(l));
    } else if (aiResult?.link) {
      collectedLinks.push({ url: aiResult.link, label: "Recommended" });
    }
    if (wikiResult?.content_urls?.desktop?.page) {
      collectedLinks.push({ url: wikiResult.content_urls.desktop.page, label: "📖 Wikipedia" });
    }
    if (wikivoyageResult?.url) {
      collectedLinks.push({ url: wikivoyageResult.url, label: "🧳 Wikivoyage Travel Guide" });
    }
    if (ddg?.url) {
      collectedLinks.push({ url: ddg.url, label: ddg.heading || "More info" });
    }
    if (ddg?.relatedLinks) {
      ddg.relatedLinks.forEach(l => collectedLinks.push(l));
    }

    // Always add useful travel search links
    const q = encodeURIComponent(title);
    collectedLinks.push(
      { url: `https://www.google.com/search?q=${q}+travel+guide`, label: "🔍 Google Travel Search" },
      { url: `https://www.tripadvisor.com/Search?q=${q}`, label: "⭐ TripAdvisor" },
      { url: `https://www.booking.com/searchresults.html?ss=${q}`, label: "🏨 Booking.com" },
      { url: `https://www.youtube.com/results?search_query=${q}`, label: "🎬 YouTube Videos" },
    );

    const seen = new Set();
    const uniqueLinks = collectedLinks.filter(l => {
      if (!l.url || seen.has(l.url)) return false;
      seen.add(l.url);
      return true;
    }).slice(0, 8);

    populateLinksForm(uniqueLinks);

    // ---- IMAGES ---- search with exact title + location strategies
    const wikiTitle = wikiResult?.titles?.canonical || cleanTitle;
    const imageSearches = [cleanTitle, location].filter(Boolean);
    const uniqueImageTerms = [...new Set(imageSearches)];
    const [wikiPhotos, ...commonsResults] = await Promise.all([
      fetchWikiImages(wikiTitle),
      ...uniqueImageTerms.slice(0, 3).map(t => fetchCommonsImages(t)),
    ]);

    const allPhotos = [...wikiPhotos];
    for (const photoSet of commonsResults) {
      for (const cp of photoSet) {
        if (!allPhotos.some((p) => p.url === cp.url)) allPhotos.push(cp);
      }
    }
    const photos = allPhotos.slice(0, 8);

    if (ddg?.image && !photos.some((p) => p.url === ddg.image)) {
      photos.unshift({ url: ddg.image, thumb: ddg.image });
    }

    if (photos.length > 0) {
      itemImage.value = photos[0].url;
      previewImg.src = photos[0].url;
      imagePreview.hidden = false;
      if (photos.length > 1) showPhotoGrid(photos.slice(0, 8));
    } else if (wikiResult?.thumbnail?.source) {
      const bigThumb = wikiResult.thumbnail.source.replace(/\/\d+px-/, "/800px-");
      itemImage.value = bigThumb;
      previewImg.src = bigThumb;
      imagePreview.hidden = false;
    }
  } catch (err) {
    console.error("Auto-fetch error:", err);
    // Even on error, provide useful defaults
    if (!itemFacts.value) {
      itemFacts.value = `${title} — an amazing adventure awaits! Use the link buttons below to search for more details.`;
    }
  } finally {
    autoFetchBtn.disabled = false;
    fetchText.hidden = false;
    fetchLoading.hidden = true;
  }
}

// ---- Google Gemini AI (free tier) ----
async function fetchGeminiInfo(term) {
  try {
    const prompt = `You are a travel and adventure expert. The user wants to add this EXACT item to their bucket list: "${term}"

IMPORTANT: Focus specifically on the EXACT location and activity mentioned. If they say "Kenya" or "Africa", the info MUST be about Kenya/Africa — NOT about similar activities in other countries like the USA. Pay close attention to every word including country, city, and region names.

Provide:
1. A compelling 2-3 sentence description about THIS SPECIFIC experience at THIS SPECIFIC location — include interesting facts, why it's worth it, best time to go, and insider tips
2. 3-5 useful website links specifically for THIS location (official tourism site, local operators, booking/tickets, travel blogs about this destination)

Reply ONLY in this exact JSON format, no markdown:
{"facts": "your description here", "links": [{"url": "https://...", "label": "Site name"}]}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const jsonMatch = text.match(/\{[\s\S]*"facts"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { facts: parsed.facts || "", links: parsed.links || [], link: parsed.link || "" };
    }
    return { facts: text.trim(), links: [], link: "" };
  } catch (err) {
    console.error("Gemini error:", err);
    return null;
  }
}

// ---- Wikivoyage (travel-focused wiki, much better than Wikipedia for destinations) ----
async function fetchWikivoyage(term) {
  try {
    // 1) Try direct page lookup first (exact match = best result)
    const directTitle = term.replace(/\s+/g, "_");
    const directRes = await fetch(
      `https://en.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(directTitle)}&prop=extracts&exintro=1&explaintext=1&exsentences=5&format=json&origin=*`
    );
    const directData = await directRes.json();
    const directPages = directData?.query?.pages;
    if (directPages) {
      const dp = Object.values(directPages)[0];
      if (dp && !dp.missing && dp.extract && dp.extract.length > 50) {
        return {
          extract: dp.extract,
          title: dp.title,
          url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(dp.title.replace(/ /g, "_"))}`,
        };
      }
    }

    // 2) Search fallback — pick the result whose title best matches the query
    const searchRes = await fetch(
      `https://en.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results?.length) return null;

    // Sort results: prefer titles containing query words
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/\s+/).filter(w => w.length > 2);
    const scored = results.map(r => {
      const titleLower = r.title.toLowerCase();
      const wordHits = termWords.filter(w => titleLower.includes(w)).length;
      const exactMatch = titleLower === termLower ? 100 : 0;
      return { ...r, score: exactMatch + wordHits };
    }).sort((a, b) => b.score - a.score);

    for (const result of scored) {
      const extractRes = await fetch(
        `https://en.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(result.title)}&prop=extracts&exintro=1&explaintext=1&exsentences=5&format=json&origin=*`
      );
      const extractData = await extractRes.json();
      const pages = extractData?.query?.pages;
      if (!pages) continue;
      const page = Object.values(pages)[0];
      if (page?.extract && page.extract.length > 50) {
        return {
          extract: page.extract,
          title: page.title,
          url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
        };
      }
    }
    return null;
  } catch { return null; }
}

// ---- Wikipedia ----
async function fetchWikipedia(term) {
  try {
    // 1) Try direct page lookup (fastest, most accurate for exact names like "Lake Como")
    const directRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term)}`);
    if (directRes.ok) {
      const data = await directRes.json();
      if (data.type !== "disambiguation" && data.extract && data.extract.length > 30) {
        return data;
      }
    }

    // 2) Search fallback with relevance scoring — prefer results matching query words
    const termLower = term.toLowerCase();
    const termWords = termLower.split(/\s+/).filter(w => w.length > 2);

    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=5&format=json&origin=*`
    );
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results?.length) return null;

    // Score results: prefer titles that closely match what was typed
    const scored = results.map(r => {
      const titleLower = r.title.toLowerCase();
      const wordHits = termWords.filter(w => titleLower.includes(w)).length;
      const exactMatch = titleLower === termLower ? 100 : 0;
      const partialMatch = termLower.includes(titleLower) || titleLower.includes(termLower) ? 10 : 0;
      return { ...r, score: exactMatch + partialMatch + wordHits };
    }).sort((a, b) => b.score - a.score);

    for (const result of scored) {
      const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.title)}`);
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        if (summary.type !== "disambiguation" && summary.extract) return summary;
      }
    }
    return null;
  } catch { return null; }
}

// ---- DuckDuckGo Instant Answer (no key needed) ----
async function fetchDuckDuckGo(term) {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(term)}&format=json&no_html=1&skip_disambig=1`);
    if (!res.ok) return null;
    const data = await res.json();
    const relatedLinks = (data.RelatedTopics || [])
      .filter(t => t.FirstURL)
      .slice(0, 3)
      .map(t => ({ url: t.FirstURL, label: (t.Text || "").substring(0, 50) || "Related" }));
    return {
      abstract: data.Abstract || data.AbstractText || "",
      url: data.AbstractURL || data.Results?.[0]?.FirstURL || "",
      heading: data.Heading || "",
      image: data.Image ? (data.Image.startsWith("http") ? data.Image : `https://duckduckgo.com${data.Image}`) : "",
      source: data.AbstractSource || "",
      relatedLinks,
      relatedTopics: (data.RelatedTopics || []).slice(0, 3).map((t) => t.Text).filter(Boolean),
    };
  } catch { return null; }
}

// ---- Wikipedia article images ----
async function fetchWikiImages(articleTitle) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&prop=images&imlimit=20&format=json&origin=*`
    );
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    const page = Object.values(pages)[0];
    const imageFiles = (page?.images || [])
      .map((img) => img.title)
      .filter((t) => /\.(jpg|jpeg|png|webp)$/i.test(t))
      .filter((t) => !/flag|icon|logo|symbol|coat.of.arms|commons-logo|edit-clear|disambig|question.book|text-document|folder|ambox|info\b/i.test(t))
      .slice(0, 8);

    if (imageFiles.length === 0) return [];

    const fileParam = imageFiles.join("|");
    const urlRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileParam)}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`
    );
    const urlData = await urlRes.json();
    const urlPages = urlData?.query?.pages;
    if (!urlPages) return [];

    return Object.values(urlPages)
      .filter((p) => p.imageinfo?.[0])
      .map((p) => ({
        url: p.imageinfo[0].thumburl || p.imageinfo[0].url,
        thumb: p.imageinfo[0].thumburl || p.imageinfo[0].url,
      }))
      .filter((p) => p.url)
      .slice(0, 4);
  } catch { return []; }
}

// ---- Wikimedia Commons image search (no key needed) ----
async function fetchCommonsImages(term) {
  try {
    const res = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(term)}&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`
    );
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    return Object.values(pages)
      .filter((p) => p.imageinfo?.[0] && /\.(jpg|jpeg|png|webp)/i.test(p.title || ""))
      .map((p) => ({
        url: p.imageinfo[0].thumburl || p.imageinfo[0].url,
        thumb: p.imageinfo[0].thumburl || p.imageinfo[0].url,
      }))
      .filter((p) => p.url)
      .slice(0, 4);
  } catch { return []; }
}

function showPhotoGrid(photos) {
  photoSelector.hidden = false;
  photoGrid.innerHTML = photos.map((p, i) =>
    `<div class="photo-option ${i === 0 ? "selected" : ""}" data-url="${esc(p.url)}">
      <img src="${esc(p.thumb)}" alt="Photo option" />
    </div>`
  ).join("");

  photoGrid.querySelectorAll(".photo-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      photoGrid.querySelectorAll(".photo-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      itemImage.value = opt.dataset.url;
      previewImg.src = opt.dataset.url;
      imagePreview.hidden = false;
    });
  });
}

// ============ SAVE ITEM ============
function handleSave() {
  const title = itemTitle.value.trim();
  if (!title) { itemTitle.focus(); return; }

  // Collect links from the form rows
  const linkRows = linksContainer.querySelectorAll(".link-row");
  const links = [];
  linkRows.forEach(row => {
    const url = row.querySelector(".link-input")?.value.trim();
    const label = row.querySelector(".link-label-input")?.value.trim();
    if (url) links.push({ url, label: label || url });
  });

  if (editingItemId) {
    // ---- EDIT existing item ----
    const item = items.find(i => i.id === editingItemId);
    if (item) {
      item.title = title;
      item.facts = itemFacts.value.trim();
      item.links = links;
      item.image = itemImage.value.trim();
    }
    saveItems();
    closeModal();
    renderItems();
  } else {
    // ---- ADD new item ----
    const newItem = {
      id: crypto.randomUUID(),
      title,
      facts: itemFacts.value.trim(),
      links,
      image: itemImage.value.trim(),
      addedBy: currentUser,
      completed: false,
      completedBy: null,
      reactions: { "❤️": [], "🔥": [], "✈️": [], "⭐": [] },
      createdAt: new Date().toISOString(),
    };

    items.unshift(newItem);
    saveItems();
    burstConfetti();
    closeModal();
    currentFilter = "all";
    $$(".filter-pill").forEach((p) => p.classList.remove("active"));
    $('[data-filter="all"]').classList.add("active");
    renderItems();
  }
}

// ============ INSPIRATIONAL QUOTES ============
const QUOTES = [
  "dream big!", "the world is waiting!", "collect moments, not things!",
  "adventure is out there!", "life is short, travel far!",
  "make memories everywhere!", "say yes to new adventures!",
  "explore, dream, discover!", "wander often, wonder always!",
  "every journey starts here!", "let's see the world together!",
  "live the life you've imagined!", "your next adventure awaits!",
];
let quoteIdx = 0;
function rotateQuote() {
  const el = $("#quote-text");
  if (!el) return;
  quoteIdx = (quoteIdx + 1) % QUOTES.length;
  el.style.opacity = "0";
  setTimeout(() => {
    el.textContent = QUOTES[quoteIdx];
    el.style.opacity = "1";
  }, 400);
}
setInterval(rotateQuote, 8000);

// ============ PROGRESS BAR ============
function updateProgress() {
  const total = items.length;
  const done = items.filter(i => i.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fill = $("#progress-fill");
  const label = $("#progress-label");
  const wrap = $("#progress-wrap");
  if (!fill || !wrap) return;
  wrap.hidden = total === 0;
  fill.style.width = pct + "%";
  label.textContent = pct + "%";

  // Milestone celebrations
  if (total > 0 && pct > 0 && pct % 25 === 0 && done > 0) {
    const milestoneKey = `bl_milestone_${pct}_${total}`;
    if (!sessionStorage.getItem(milestoneKey)) {
      sessionStorage.setItem(milestoneKey, "1");
      if (pct === 100) {
        emojiRain("🏆", 3000);
      } else if (pct === 75) {
        emojiRain("🔥", 2000);
      } else if (pct === 50) {
        emojiRain("⭐", 2000);
      }
    }
  }
}

// ============ SURPRISE ME (Random Picker) ============
function surpriseMe() {
  const incomplete = items.filter(i => !i.completed);
  if (incomplete.length === 0) {
    alert("🎉 All your dreams are completed! Add more adventures!");
    return;
  }
  const pick = incomplete[Math.floor(Math.random() * incomplete.length)];
  // Highlight and scroll to the picked card
  const card = document.querySelector(`.bucket-card[data-id="${pick.id}"]`);
  if (card) {
    // Remove any previous highlight
    document.querySelectorAll(".bucket-card.surprise-highlight").forEach(c => c.classList.remove("surprise-highlight"));
    card.classList.add("surprise-highlight");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    emojiRain("🎲", 1500);
    setTimeout(() => card.classList.remove("surprise-highlight"), 4000);
  } else {
    // Card might be hidden by filter — switch to All
    currentFilter = "all";
    $$(".filter-pill").forEach(p => p.classList.remove("active"));
    $('[data-filter="all"]')?.classList.add("active");
    // Switch to mylist tab
    switchTab("mylist");
    renderItems();
    setTimeout(() => surpriseMe(), 100);
  }
}
$("#surprise-btn")?.addEventListener("click", surpriseMe);

// ============ EXPLORE DESTINATIONS ============
const EXPLORE_DESTINATIONS = [
  // Beach & Islands
  { title: "Santorini, Greece", desc: "Stunning sunsets over whitewashed cliffs and turquoise waters.", cat: ["beach","romantic"], img: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=500&q=80" },
  { title: "Bora Bora, French Polynesia", desc: "Crystal-clear lagoon surrounded by lush tropical peaks.", cat: ["beach","romantic"], img: "https://images.unsplash.com/photo-1589197331516-4d84b72ebde3?w=500&q=80" },
  { title: "Maldives Overwater Bungalow", desc: "Wake up to turquoise waters from your private overwater villa.", cat: ["beach","romantic"], img: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=500&q=80" },
  { title: "Amalfi Coast, Italy", desc: "Drive along dramatic cliffs with colourful villages and Mediterranean views.", cat: ["beach","romantic","food"], img: "https://images.unsplash.com/photo-1534113414509-0eec2bfb493f?w=500&q=80" },
  { title: "Great Barrier Reef, Australia", desc: "Dive into the world's largest coral reef system.", cat: ["beach","nature"], img: "https://images.unsplash.com/photo-1587139223877-04cb899fa3e8?w=500&q=80" },
  { title: "Zanzibar, Tanzania", desc: "White-sand beaches, spice farms, and vibrant coral reefs off East Africa.", cat: ["beach","culture"], img: "https://images.unsplash.com/photo-1586861635167-e5223aadc9fe?w=500&q=80" },
  { title: "Seychelles Islands", desc: "Pristine granite boulders, turquoise bays, and rare wildlife.", cat: ["beach","nature"], img: "https://images.unsplash.com/photo-1589979481223-deb893043163?w=500&q=80" },
  { title: "Phi Phi Islands, Thailand", desc: "Emerald waters and towering limestone cliffs in the Andaman Sea.", cat: ["beach","adventure"], img: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=500&q=80" },
  { title: "Turks and Caicos", desc: "Grace Bay Beach — consistently ranked among the world's best beaches.", cat: ["beach","romantic"], img: "https://images.unsplash.com/photo-1580237072617-771c3ecc4a24?w=500&q=80" },
  { title: "Tulum Beach, Mexico", desc: "Ancient Mayan ruins perched above Caribbean turquoise waters.", cat: ["beach","culture"], img: "https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=500&q=80" },
  // Adventure
  { title: "Machu Picchu, Peru", desc: "Ancient Incan citadel high in the Andes mountains.", cat: ["adventure","culture"], img: "https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=500&q=80" },
  { title: "Northern Lights, Iceland", desc: "See the magical aurora borealis dance across the sky.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=500&q=80" },
  { title: "Safari in Serengeti, Tanzania", desc: "Witness the great wildebeest migration in Africa.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=500&q=80" },
  { title: "Grand Canyon, USA", desc: "One of the world's most spectacular natural wonders.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=500&q=80" },
  { title: "Hot Air Balloon in Cappadocia, Turkey", desc: "Float over fairy chimneys and ancient cave dwellings at sunrise.", cat: ["adventure","romantic"], img: "https://images.unsplash.com/photo-1641128324972-af3212f0f6bd?w=500&q=80" },
  { title: "Bungee Jumping in New Zealand", desc: "Leap from Kawarau Bridge, birthplace of commercial bungee jumping.", cat: ["adventure"], img: "https://images.unsplash.com/photo-1544928147-79a2dbc1f669?w=500&q=80" },
  { title: "Skydiving in Dubai", desc: "Freefall over the iconic Palm Jumeirah with stunning city views.", cat: ["adventure"], img: "https://images.unsplash.com/photo-1518684079-3c830dcef090?w=500&q=80" },
  { title: "Patagonia, Argentina", desc: "Hike among glaciers, granite peaks and pristine wilderness.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1531761535209-180857e963b9?w=500&q=80" },
  { title: "Trekking to Everest Base Camp, Nepal", desc: "Follow the footsteps of legends to the roof of the world.", cat: ["adventure","nature"], img: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?w=500&q=80" },
  { title: "Cage Diving with Great Whites, South Africa", desc: "Come face to face with apex predators off Gansbaai.", cat: ["adventure"], img: "https://images.unsplash.com/photo-1560275619-4662e36fa65c?w=500&q=80" },
  { title: "White Water Rafting, Colorado River", desc: "Navigate thrilling rapids through breathtaking canyon scenery.", cat: ["adventure","nature"], img: "https://images.unsplash.com/photo-1530866495561-507c83867ae3?w=500&q=80" },
  { title: "Zip-lining in Costa Rica", desc: "Soar through the cloud forest canopy at exhilarating speeds.", cat: ["adventure","nature"], img: "https://images.unsplash.com/photo-1528543606781-2f6e6857f318?w=500&q=80" },
  { title: "Dog Sledding in Lapland, Finland", desc: "Glide through snow-covered forests under the Arctic sky.", cat: ["adventure","nature"], img: "https://images.unsplash.com/photo-1517783999520-f068d7431571?w=500&q=80" },
  { title: "Volcano Boarding in Nicaragua", desc: "Slide down the active Cerro Negro volcano on a wooden board.", cat: ["adventure"], img: "https://images.unsplash.com/photo-1542401886-65d6c61db217?w=500&q=80" },
  // Culture
  { title: "Tokyo, Japan", desc: "Neon-lit streets, incredible food, ancient temples and futuristic technology.", cat: ["culture","food"], img: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=500&q=80" },
  { title: "Petra, Jordan", desc: "Explore the ancient rose-red city carved into sandstone cliffs.", cat: ["culture","adventure"], img: "https://images.unsplash.com/photo-1579606032821-4e6161c81571?w=500&q=80" },
  { title: "Pyramids of Giza, Egypt", desc: "Stand before the only surviving wonder of the ancient world.", cat: ["culture","adventure"], img: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=500&q=80" },
  { title: "Angkor Wat, Cambodia", desc: "Explore the world's largest religious monument at sunrise.", cat: ["culture","adventure"], img: "https://images.unsplash.com/photo-1569700942850-30a706c35afc?w=500&q=80" },
  { title: "Cherry Blossoms in Kyoto, Japan", desc: "Walk under clouds of pink sakura in ancient temple gardens.", cat: ["nature","culture","romantic"], img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=500&q=80" },
  { title: "Marrakech Souks, Morocco", desc: "Lose yourself in colourful markets filled with spices, crafts and culture.", cat: ["culture","food"], img: "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=500&q=80" },
  { title: "Colosseum, Rome", desc: "Step inside the ancient arena where gladiators once fought.", cat: ["culture"], img: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=500&q=80" },
  { title: "Taj Mahal, India", desc: "Marvel at the world's most beautiful monument to love.", cat: ["culture","romantic"], img: "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=500&q=80" },
  { title: "Havana, Cuba", desc: "Vintage cars, vibrant music, and colourful colonial architecture.", cat: ["culture"], img: "https://images.unsplash.com/photo-1500759285222-a95626b934cb?w=500&q=80" },
  { title: "Fez Medina, Morocco", desc: "The world's largest car-free urban zone — a maze of ancient alleyways.", cat: ["culture","food"], img: "https://images.unsplash.com/photo-1545071677-25612e93c45e?w=500&q=80" },
  { title: "Chichen Itza, Mexico", desc: "The iconic Mayan pyramid and one of the New Seven Wonders.", cat: ["culture","adventure"], img: "https://images.unsplash.com/photo-1518638150340-f706e86654de?w=500&q=80" },
  { title: "Istanbul, Turkey", desc: "Where East meets West — bazaars, mosques, and Bosphorus views.", cat: ["culture","food"], img: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=500&q=80" },
  // Food
  { title: "Street Food Tour in Bangkok, Thailand", desc: "Taste explosive flavours at world-famous night markets.", cat: ["food","culture"], img: "https://images.unsplash.com/photo-1504214208698-ea1916a2195a?w=500&q=80" },
  { title: "Wine Tasting in Tuscany, Italy", desc: "Sip world-class wines among rolling hills and medieval villages.", cat: ["food","romantic"], img: "https://images.unsplash.com/photo-1523528283115-9bf9b1699245?w=500&q=80" },
  { title: "Sushi Masterclass in Tokyo", desc: "Learn the art of sushi from master chefs at Tsukiji Outer Market.", cat: ["food","culture"], img: "https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80" },
  { title: "Tapas Crawl in Barcelona, Spain", desc: "Hop between pintxo bars in the Gothic Quarter.", cat: ["food","culture"], img: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=500&q=80" },
  { title: "Champagne Region, France", desc: "Tour the cellars and vineyards where the world's finest bubbles are born.", cat: ["food","romantic"], img: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=500&q=80" },
  { title: "Pasta Making in Bologna, Italy", desc: "Roll fresh tagliatelle with a nonna in Italy's food capital.", cat: ["food","culture"], img: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=500&q=80" },
  { title: "Night Market in Taipei, Taiwan", desc: "Hundreds of stalls with bubble tea, fried chicken, and local delicacies.", cat: ["food","culture"], img: "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=500&q=80" },
  { title: "Chocolate Tour in Brussels, Belgium", desc: "Taste artisan pralines and visit legendary chocolatiers.", cat: ["food"], img: "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=500&q=80" },
  // Nature
  { title: "Swiss Alps Train Journey", desc: "Ride the Glacier Express through breathtaking mountain landscapes.", cat: ["nature","romantic"], img: "https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=500&q=80" },
  { title: "Niagara Falls, Canada", desc: "Feel the thundering power of one of the world's most famous waterfalls.", cat: ["nature"], img: "https://images.unsplash.com/photo-1489447068241-b3490214e879?w=500&q=80" },
  { title: "Lake Como, Italy", desc: "Stunning Alpine lake surrounded by elegant villas and lush gardens.", cat: ["romantic","nature"], img: "https://images.unsplash.com/photo-1537859749767-8879e2e6e78c?w=500&q=80" },
  { title: "Victoria Falls, Zambia/Zimbabwe", desc: "The largest curtain of falling water on Earth — the Smoke That Thunders.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=500&q=80" },
  { title: "Plitvice Lakes, Croatia", desc: "16 terraced lakes connected by waterfalls in a lush forest.", cat: ["nature"], img: "https://images.unsplash.com/photo-1555990538-1e15f39e9b36?w=500&q=80" },
  { title: "Banff National Park, Canada", desc: "Turquoise glacial lakes and snow-capped Rocky Mountain peaks.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=500&q=80" },
  { title: "Amazon Rainforest, Brazil", desc: "The lungs of the Earth — explore the most biodiverse place on the planet.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=500&q=80" },
  { title: "Zhangjiajie, China", desc: "Avatar-like floating pillars of sandstone in a misty forest.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1513415564515-763d91423bdd?w=500&q=80" },
  { title: "Milford Sound, New Zealand", desc: "Dramatic fiord with towering peaks, waterfalls, and dolphins.", cat: ["nature"], img: "https://images.unsplash.com/photo-1506773090264-ac0b07293a64?w=500&q=80" },
  { title: "Galápagos Islands, Ecuador", desc: "Walk alongside giant tortoises, iguanas, and blue-footed boobies.", cat: ["nature","adventure"], img: "https://images.unsplash.com/photo-1544979590-37e9b47eb705?w=500&q=80" },
  // Romantic
  { title: "Paris at Night, France", desc: "The City of Light — Eiffel Tower sparkling, Seine River cruises, and macarons.", cat: ["romantic","culture","food"], img: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=500&q=80" },
  { title: "Venice Gondola Ride, Italy", desc: "Glide through romantic canals under ancient bridges.", cat: ["romantic","culture"], img: "https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=500&q=80" },
  { title: "Cinque Terre, Italy", desc: "Five colourful cliffside villages connected by hiking trails and trains.", cat: ["romantic","nature","food"], img: "https://images.unsplash.com/photo-1499678329028-101435549a4e?w=500&q=80" },
  { title: "Matterhorn Sunrise, Switzerland", desc: "Watch dawn paint the iconic pyramid peak in golden light.", cat: ["romantic","nature"], img: "https://images.unsplash.com/photo-1529973565457-a60a2ccf750d?w=500&q=80" },
  { title: "Hot Springs in Blue Lagoon, Iceland", desc: "Soak in milky-blue geothermal waters surrounded by lava fields.", cat: ["romantic","nature"], img: "https://images.unsplash.com/photo-1515488764276-beab007b5e2b?w=500&q=80" },
  { title: "Sunset Sailing in Santorini", desc: "Cruise past the caldera as the sky turns orange and pink.", cat: ["romantic","beach"], img: "https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a?w=500&q=80" },
];

let exploreFilter = "all";
let explorePage = 0;
const EXPLORE_PAGE_SIZE = 12;

// Shuffle helper
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let shuffledExplore = shuffleArray(EXPLORE_DESTINATIONS);

function renderExplore() {
  const grid = $("#explore-grid");
  if (!grid) return;

  // Filter by category
  const catFiltered = exploreFilter === "all"
    ? shuffledExplore
    : shuffledExplore.filter(d => d.cat.includes(exploreFilter));

  // Paginate — show EXPLORE_PAGE_SIZE at a time
  const start = explorePage * EXPLORE_PAGE_SIZE;
  const pageItems = catFiltered.slice(start, start + EXPLORE_PAGE_SIZE);
  const hasMore = start + EXPLORE_PAGE_SIZE < catFiltered.length;
  const totalPages = Math.ceil(catFiltered.length / EXPLORE_PAGE_SIZE);
  const currentPageNum = explorePage + 1;

  const existingTitles = new Set(items.map(i => i.title.toLowerCase()));

  let cardsHTML = pageItems.map((d, i) => {
    const added = existingTitles.has(d.title.toLowerCase());
    return `<div class="explore-card" style="animation-delay:${i * 0.05}s">
      <img class="explore-card-img" src="${esc(d.img)}" alt="${esc(d.title)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 400 200%22><rect fill=%22%231a2a4a%22 width=%22400%22 height=%22200%22/><text x=%2250%%22 y=%2250%%22 fill=%22%23d4a853%22 text-anchor=%22middle%22 dy=%22.3em%22 font-size=%2240%22>🌍</text></svg>'" />
      <div class="explore-card-body">
        <h3 class="explore-card-title">${esc(d.title)}</h3>
        <p class="explore-card-desc">${esc(d.desc)}</p>
        <div class="explore-card-tags">${d.cat.map(c => `<span class="explore-tag">${catEmoji(c)} ${c}</span>`).join("")}</div>
        ${added
          ? `<button class="already-added" disabled>✅ Already in your list</button>`
          : `<button class="explore-card-btn" data-title="${esc(d.title)}" data-desc="${esc(d.desc)}" data-img="${esc(d.img)}">＋ Add to My Bucket List</button>`
        }
      </div>
    </div>`;
  }).join("");

  // Navigation bar below cards
  const navHTML = `<div class="explore-nav">
    <button class="explore-nav-btn" id="explore-prev" ${explorePage === 0 ? "disabled" : ""}>⬅️ Previous</button>
    <span class="explore-nav-info">Page ${currentPageNum} of ${totalPages} · ${catFiltered.length} destinations</span>
    <button class="explore-nav-btn" id="explore-next" ${!hasMore ? "disabled" : ""}>Next ➡️</button>
    <button class="explore-nav-btn explore-shuffle-btn" id="explore-shuffle">🔀 Shuffle & Discover New</button>
  </div>`;

  grid.innerHTML = cardsHTML + navHTML;

  // Bind add buttons
  grid.querySelectorAll(".explore-card-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      addExploreItem(btn.dataset.title, btn.dataset.desc, btn.dataset.img);
      btn.outerHTML = `<button class="already-added" disabled>✅ Added!</button>`;
      burstConfetti();
    });
  });

  // Bind nav buttons
  $("#explore-prev")?.addEventListener("click", () => {
    if (explorePage > 0) { explorePage--; renderExplore(); scrollExploreTop(); }
  });
  $("#explore-next")?.addEventListener("click", () => {
    if (hasMore) { explorePage++; renderExplore(); scrollExploreTop(); }
  });
  $("#explore-shuffle")?.addEventListener("click", () => {
    shuffledExplore = shuffleArray(EXPLORE_DESTINATIONS);
    explorePage = 0;
    renderExplore();
    scrollExploreTop();
    emojiRain("🔀", 1000);
  });
}

function scrollExploreTop() {
  document.querySelector(".explore-header")?.scrollIntoView({ behavior: "smooth" });
}

function addExploreItem(title, desc, img) {
  const newItem = {
    id: crypto.randomUUID(),
    title,
    facts: desc,
    links: [
      { url: `https://www.google.com/search?q=${encodeURIComponent(title)}+travel+guide`, label: "🔍 Google Travel Search" },
      { url: `https://www.tripadvisor.com/Search?q=${encodeURIComponent(title)}`, label: "⭐ TripAdvisor" },
      { url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(title)}`, label: "🏨 Booking.com" },
    ],
    image: img,
    addedBy: currentUser,
    completed: false,
    completedBy: null,
    reactions: { "❤️": [], "🔥": [], "✈️": [], "⭐": [] },
    createdAt: new Date().toISOString(),
  };
  items.unshift(newItem);
  saveItems();
  renderItems();
  updateProgress();
}

function catEmoji(cat) {
  const map = { beach: "🏖️", adventure: "🏔️", culture: "🏛️", food: "🍽️", nature: "🌿", romantic: "💕" };
  return map[cat] || "🌍";
}

// Explore category filter
$("#explore-categories")?.addEventListener("click", (e) => {
  const btn = e.target.closest(".explore-cat");
  if (!btn) return;
  exploreFilter = btn.dataset.cat;
  $$(".explore-cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderExplore();
});

// Tab switching
function switchTab(tab) {
  const mylist = $("#tab-mylist");
  const explore = $("#tab-explore");
  if (!mylist || !explore) return;
  mylist.hidden = tab !== "mylist";
  explore.hidden = tab !== "explore";
  $$(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  if (tab === "explore") renderExplore();
}

$$(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// ============ PERSISTENCE ============
function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ============ CONFETTI ============
function burstConfetti() {
  const colors = ["#d4a853", "#ff6b6b", "#4ecdc4", "#45b7d1", "#f9ca24", "#f0932b", "#6c5ce7", "#a29bfe"];
  const emojis = ["🎉", "✨", "🌟", "🎊", "💫", "🗼", "✈️", "🌍"];

  for (let i = 0; i < 50; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.animationDelay = Math.random() * 1 + "s";
    piece.style.animationDuration = (Math.random() * 2 + 2) + "s";

    if (Math.random() > 0.55) {
      piece.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      piece.style.fontSize = "20px";
    } else {
      piece.style.width = (Math.random() * 8 + 6) + "px";
      piece.style.height = (Math.random() * 8 + 6) + "px";
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "0";
    }

    confettiBox.appendChild(piece);
  }

  setTimeout(() => { confettiBox.innerHTML = ""; }, 4000);
}

// Emoji rain — rains a specific emoji across the screen
function emojiRain(emoji, duration) {
  const count = 35;
  for (let i = 0; i < count; i++) {
    const drop = document.createElement("div");
    drop.className = "confetti-piece";
    drop.textContent = emoji;
    drop.style.left = Math.random() * 100 + "vw";
    drop.style.fontSize = (Math.random() * 14 + 16) + "px";
    drop.style.animationDelay = Math.random() * (duration / 1000) + "s";
    drop.style.animationDuration = (Math.random() * 1.5 + 1.5) + "s";
    confettiBox.appendChild(drop);
  }
  setTimeout(() => { confettiBox.innerHTML = ""; }, duration + 2000);
}

// ============ UTILS ============
function esc(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// Returns HTML for a user's avatar (mini size) — works for any user name
function avatarHTML(userName, size) {
  const sizeMap = {
    online: ["online-avatar", "online-avatar-emoji"],
    group:  ["user-group-avatar", "user-group-avatar-emoji"],
  };
  const [cls, emojiCls] = sizeMap[size] || ["mini-avatar", "mini-avatar-emoji"];
  const av = avatars[userName];
  if (!av) return `<span class="${emojiCls}">👤</span>`;
  if (av.startsWith("http") || av.startsWith("data:")) {
    return `<img class="${cls}" src="${esc(av)}" alt="${esc(userName)}" onerror="this.outerHTML='<span class=\\'${emojiCls}\\'>👤</span>'" />`;
  }
  return `<span class="${emojiCls}">${av}</span>`;
}

function buildAvatarPicker() {
  initPickerEl(avatarPicker, avatarUrlInput, avatarPreviewWrap);
}

function buildProfileAvatarPicker() {
  const picker = $("#profile-avatar-picker");
  const urlInput = $("#profile-avatar-url");
  const previewWrap = $("#profile-avatar-preview-wrap");
  initPickerEl(picker, urlInput, previewWrap);
}

function initPickerEl(pickerEl, urlInputEl, previewWrapEl) {
  pickerEl.innerHTML = AVATAR_EMOJIS.map(e =>
    `<div class="avatar-option" data-avatar="${e}">${e}</div>`
  ).join("");
  pickerEl.querySelectorAll(".avatar-option").forEach(opt => {
    opt.addEventListener("click", () => {
      pickerEl.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      urlInputEl.value = "";
      previewWrapEl.hidden = true;
    });
  });
}

function preselectAvatar(pickerEl, urlInputEl, previewWrapEl, previewImgEl, avatar) {
  pickerEl.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
  urlInputEl.value = "";
  previewWrapEl.hidden = true;
  if (!avatar) return;
  if (avatar.startsWith("http") || avatar.startsWith("data:")) {
    urlInputEl.value = avatar;
    previewImgEl.src = avatar;
    previewWrapEl.hidden = false;
  } else {
    // It's an emoji — find and select it
    const match = pickerEl.querySelector(`[data-avatar="${avatar}"]`);
    if (match) match.classList.add("selected");
  }
}

// Resize and convert uploaded file to data URL (max 150x150 to keep localStorage small)
function handleAvatarFile(file, urlInputEl, previewImgEl, previewWrapEl, pickerEl) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      // Crop to square center
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      urlInputEl.value = dataUrl;
      previewImgEl.src = dataUrl;
      previewWrapEl.hidden = false;
      pickerEl.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ============ LINKS FORM HELPERS ============
function addLinkRow(url, label) {
  const row = document.createElement("div");
  row.className = "link-row";
  row.innerHTML = `
    <input type="url" class="link-input" placeholder="https://..." value="${esc(url || "")}" />
    <input type="text" class="link-label-input" placeholder="Label" value="${esc(label || "")}" />
    <button type="button" class="btn-remove-link" title="Remove">✕</button>`;
  row.querySelector(".btn-remove-link").addEventListener("click", () => row.remove());
  linksContainer.appendChild(row);
}

function populateLinksForm(links) {
  linksContainer.innerHTML = "";
  if (links.length === 0) {
    linksContainer.innerHTML = `<div class="link-row">
      <input type="url" class="link-input" placeholder="https://..." />
      <input type="text" class="link-label-input" placeholder="Label (e.g. Official site)" />
    </div>`;
    return;
  }
  links.forEach(l => addLinkRow(l.url, l.label));
}

// ============ ONLINE USERS ============
let onlineInterval = null;

function goOnline() {
  if (!currentUser) return;
  updateOnlineStatus();
  onlineInterval = setInterval(updateOnlineStatus, 5000);
  window.addEventListener("beforeunload", goOffline);
  renderOnlineUsers();
  // Also listen for storage events from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === ONLINE_KEY) renderOnlineUsers();
  });
}

function goOffline() {
  clearInterval(onlineInterval);
  const online = JSON.parse(localStorage.getItem(ONLINE_KEY) || "{}");
  delete online[currentUser];
  localStorage.setItem(ONLINE_KEY, JSON.stringify(online));
  renderOnlineUsers();
}

function updateOnlineStatus() {
  const online = JSON.parse(localStorage.getItem(ONLINE_KEY) || "{}");
  online[currentUser] = Date.now();
  // Clean up stale entries (older than 15 seconds)
  const cutoff = Date.now() - 15000;
  for (const name in online) {
    if (online[name] < cutoff) delete online[name];
  }
  localStorage.setItem(ONLINE_KEY, JSON.stringify(online));
  renderOnlineUsers();
}

function renderOnlineUsers() {
  const online = JSON.parse(localStorage.getItem(ONLINE_KEY) || "{}");
  avatars = JSON.parse(localStorage.getItem(AVATARS_KEY) || "{}");
  const cutoff = Date.now() - 15000;
  const names = Object.entries(online)
    .filter(([, ts]) => ts > cutoff)
    .map(([name]) => name);

  if (names.length === 0) {
    onlineUsersEl.innerHTML = "";
    return;
  }
  onlineUsersEl.innerHTML = names.map(n =>
    `<span class="online-dot" title="${esc(n)} is online">${avatarHTML(n, "online")} ${esc(n)}</span>`
  ).join("");
}

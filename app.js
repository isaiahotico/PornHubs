// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

// Initialize Firebase SDKs
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const storage = firebase.storage();

// --- STATE MANAGEMENT ---
let currentUser = JSON.parse(localStorage.getItem("ph_user")) || null;
let allPostsCache = [];
let activeGroupId = null;
let activeDmRecipientUid = null;
let activePostId = null;
let selectedCategoryFilter = "All";

// Default System Categories
const defaultCategories = ["All", "Entertainment", "Music", "Gaming", "Cinema", "Tech", "Lifestyle", "Vlog"];

// Rewarded Ad Progress State
let adProgress = {
  popWatched: false,
  interCount: 0,
  lastRewardedTime: parseInt(localStorage.getItem("ph_last_rewarded") || "0")
};

// 5-Minute Cooldown Constant (300,000 ms)
const COOLDOWN_DURATION = 5 * 60 * 1000;

// --- IN-APP AUTOMATIC INTERSTITIAL AD INITIALIZATION ---
function initInAppAds() {
  const lastInAppShow = parseInt(localStorage.getItem("ph_last_inapp") || "0");
  const now = Date.now();

  // Cooldown every 5 minutes for in-app interstitial
  if (now - lastInAppShow >= COOLDOWN_DURATION) {
    if (typeof show_10555663 === "function") {
      try {
        show_10555663({
          type: 'inApp',
          inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
          }
        });
        localStorage.setItem("ph_last_inapp", now.toString());
      } catch (err) {
        console.warn("In-app interstitial ad trigger error:", err);
      }
    }
  }
}

// --- USER INITIALIZATION ---
function initUser() {
  if (!currentUser) {
    const randomId = "u_" + Math.random().toString(36).substring(2, 9);
    currentUser = {
      uid: randomId,
      name: "Creator_" + randomId.substring(2, 6),
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      bio: "Digital Video Creator & Cinephile on Paperhouse Video Limited.",
      credits: 3 // Welcome bonus credits
    };
    localStorage.setItem("ph_user", JSON.stringify(currentUser));
  }

  // Ensure credit and user record in Firebase
  const userRef = db.ref("users/" + currentUser.uid);
  userRef.once("value", (snap) => {
    if (!snap.exists()) {
      userRef.set(currentUser);
    } else {
      const val = snap.val();
      currentUser.credits = typeof val.credits !== "undefined" ? val.credits : currentUser.credits;
      currentUser.name = val.name || currentUser.name;
      currentUser.avatar = val.avatar || currentUser.avatar;
      currentUser.bio = val.bio || currentUser.bio;
      saveLocalUser();
    }
    updateCreditUI();
    updateNavAvatar();
  });

  // Realtime user balance sync
  db.ref("users/" + currentUser.uid + "/credits").on("value", (snap) => {
    if (snap.exists()) {
      currentUser.credits = snap.val();
      saveLocalUser();
      updateCreditUI();
    }
  });
}

function saveLocalUser() {
  localStorage.setItem("ph_user", JSON.stringify(currentUser));
}

function updateCreditUI() {
  const el = document.getElementById("userCreditBalance");
  if (el) el.innerText = currentUser.credits || 0;
}

function updateNavAvatar() {
  const mobileAvatar = document.getElementById("navAvatarMobile");
  if (mobileAvatar) mobileAvatar.src = currentUser.avatar;
}

// --- CATEGORY PILLS UI & FILTER LOGIC ---
function renderCategoryPills() {
  // Aggregate system categories with any custom user-added categories from cache
  const discoveredCategories = new Set(defaultCategories);
  allPostsCache.forEach(p => {
    if (p.category && p.category.trim() !== "") {
      discoveredCategories.add(p.category.trim());
    }
  });

  const container = document.getElementById("categoryPills");
  if (!container) return;

  container.innerHTML = Array.from(discoveredCategories).map(cat => {
    const isActive = selectedCategoryFilter === cat;
    return `
      <button onclick="setCategoryFilter('${escapeHTML(cat)}')" 
              class="px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition active:scale-95 ${isActive 
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20' 
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-500/50 hover:text-white'}">
        ${escapeHTML(cat)}
      </button>
    `;
  }).join("");
}

function setCategoryFilter(category) {
  selectedCategoryFilter = category;
  renderCategoryPills();
  applySearchAndCategoryFilter();
}

function toggleCustomCategory(value) {
  const container = document.getElementById("customCategoryContainer");
  const input = document.getElementById("upCustomCategory");
  if (value === "custom") {
    container.classList.remove("hidden");
    input.required = true;
    input.focus();
  } else {
    container.classList.add("hidden");
    input.required = false;
    input.value = "";
  }
}

// --- REWARDED ADS WORKFLOW (1 POP + 2 REWARDED INTERSTITIALS = 1 CREDIT) ---
function openAdRewardModal() {
  updateAdModalStatus();
  document.getElementById("modalAdReward").classList.remove("hidden");
}

function updateAdModalStatus() {
  const now = Date.now();
  const diff = now - adProgress.lastRewardedTime;
  const inCooldown = diff < COOLDOWN_DURATION;

  const btnPop = document.getElementById("btnWatchPopAd");
  const btnInter = document.getElementById("btnWatchInterAd");
  const badgePop = document.getElementById("badgePop");
  const badgeInter = document.getElementById("badgeInter");
  const cooldownNotice = document.getElementById("cooldownTimerNotice");

  if (inCooldown) {
    const remainSec = Math.ceil((COOLDOWN_DURATION - diff) / 1000);
    const mins = Math.floor(remainSec / 60);
    const secs = remainSec % 60;
    document.getElementById("cooldownRemaining").innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    cooldownNotice.classList.remove("hidden");

    btnPop.disabled = true;
    btnInter.disabled = true;
    btnPop.classList.add("opacity-50", "cursor-not-allowed");
    btnInter.classList.add("opacity-50", "cursor-not-allowed");
  } else {
    cooldownNotice.classList.add("hidden");
    btnPop.disabled = adProgress.popWatched;
    btnInter.disabled = adProgress.interCount >= 2;

    btnPop.classList.toggle("opacity-50", adProgress.popWatched);
    btnInter.classList.toggle("opacity-50", adProgress.interCount >= 2);
  }

  badgePop.innerText = adProgress.popWatched ? "Completed" : "Pending";
  badgePop.className = adProgress.popWatched ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400" : "text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400";

  badgeInter.innerText = `${adProgress.interCount} / 2`;
  badgeInter.className = adProgress.interCount >= 2 ? "text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400" : "text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400";
}

// 1. Rewarded Popup Ad Trigger
function triggerPopRewardedAd() {
  if (Date.now() - adProgress.lastRewardedTime < COOLDOWN_DURATION) {
    alert("Please wait for the 5-minute cooldown to finish.");
    return;
  }

  if (typeof show_10555663 === "function") {
    show_10555663('pop').then(() => {
      adProgress.popWatched = true;
      checkAdCompletion();
      updateAdModalStatus();
    }).catch(e => {
      console.warn("Pop ad dismissed or error:", e);
      adProgress.popWatched = true;
      checkAdCompletion();
      updateAdModalStatus();
    });
  } else {
    adProgress.popWatched = true;
    checkAdCompletion();
    updateAdModalStatus();
  }
}

// 2. Rewarded Interstitial Ad Trigger (Must watch 2 times)
function triggerInterstitialRewardedAd() {
  if (Date.now() - adProgress.lastRewardedTime < COOLDOWN_DURATION) {
    alert("Please wait for the 5-minute cooldown to finish.");
    return;
  }

  if (typeof show_10555663 === "function") {
    show_10555663().then(() => {
      adProgress.interCount++;
      alert('You have seen an ad!');
      checkAdCompletion();
      updateAdModalStatus();
    }).catch(e => {
      console.warn("Interstitial ad error:", e);
      adProgress.interCount++;
      checkAdCompletion();
      updateAdModalStatus();
    });
  } else {
    adProgress.interCount++;
    alert('You have seen an ad!');
    checkAdCompletion();
    updateAdModalStatus();
  }
}

function checkAdCompletion() {
  if (adProgress.popWatched && adProgress.interCount >= 2) {
    currentUser.credits = (currentUser.credits || 0) + 1;
    db.ref("users/" + currentUser.uid + "/credits").set(currentUser.credits);
    saveLocalUser();
    updateCreditUI();

    adProgress.popWatched = false;
    adProgress.interCount = 0;
    adProgress.lastRewardedTime = Date.now();
    localStorage.setItem("ph_last_rewarded", adProgress.lastRewardedTime.toString());

    alert("Congratulations! 1 Video Credit has been credited to your balance!");
    closeModal("modalAdReward");
  }
}

// --- NAVIGATION & VIEW ROUTING ---
function navigateTo(viewId, targetUid = null) {
  const views = ["feed", "leaderboard", "groups", "group-chat", "profile", "direct-chat"];
  views.forEach(v => {
    const el = document.getElementById("view-" + v);
    if (el) el.classList.add("hidden");
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewId === "my-profile") {
    loadProfile(currentUser.uid);
    document.getElementById("view-profile").classList.remove("hidden");
  } else if (viewId === "user-profile" && targetUid) {
    loadProfile(targetUid);
    document.getElementById("view-profile").classList.remove("hidden");
  } else {
    const activeEl = document.getElementById("view-" + viewId);
    if (activeEl) activeEl.classList.remove("hidden");
  }
}

// --- FEED & POSTS REALTIME SYNC (AUTO-PUBLISHED LIVE) ---
db.ref("posts").orderByChild("createdAt").on("value", (snapshot) => {
  allPostsCache = [];
  snapshot.forEach((child) => {
    allPostsCache.unshift({ id: child.key, ...child.val() });
  });
  renderCategoryPills();
  applySearchAndCategoryFilter();
  renderLeaderboard(allPostsCache);
});

function applySearchAndCategoryFilter() {
  const searchVal = (document.getElementById("globalSearchInput")?.value || "").trim().toLowerCase();
  
  let filtered = allPostsCache;

  // Category filter
  if (selectedCategoryFilter !== "All") {
    filtered = filtered.filter(p => (p.category || "").toLowerCase() === selectedCategoryFilter.toLowerCase());
  }

  // Search filter
  if (searchVal) {
    filtered = filtered.filter(p => 
      (p.title || "").toLowerCase().includes(searchVal) ||
      (p.description || "").toLowerCase().includes(searchVal) ||
      (p.category || "").toLowerCase().includes(searchVal) ||
      (p.authorName || "").toLowerCase().includes(searchVal)
    );
  }

  renderFeed(filtered);
}

function renderFeed(posts) {
  const container = document.getElementById("postsContainer");
  if (!posts || posts.length === 0) {
    container.innerHTML = `<div class="col-span-full py-16 text-center text-slate-500 text-xs">No videos match this filter. Be the first to publish instantly!</div>`;
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="${post.theme || 'theme-diamond'} rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-200 active:scale-95 shadow-md">
      
      <!-- Video Thumbnail & Play Trigger -->
      <div class="relative aspect-[4/3] bg-black cursor-pointer group" onclick="requestPlayVideo('${post.id}')">
        <img src="${post.thumbnailUrl}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="" loading="lazy"/>
        <div class="absolute inset-0 bg-black/30 flex items-center justify-center">
          <div class="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-bold pl-0.5 shadow-lg shadow-amber-500/40">
            <i class="fa-solid fa-play text-xs"></i>
          </div>
        </div>
        
        <!-- Category Pill Badge on Card -->
        <span class="absolute top-1.5 left-1.5 bg-black/80 backdrop-blur text-[8px] font-black uppercase tracking-wider text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30">
          ${escapeHTML(post.category || 'General')}
        </span>

        <!-- Small Fit Views Counter Badge -->
        <span class="absolute bottom-1.5 right-1.5 bg-slate-950/80 backdrop-blur text-[9px] px-1.5 py-0.5 rounded-md font-mono text-amber-300 border border-slate-700/60">
          <i class="fa-solid fa-eye text-[8px] mr-0.5"></i> ${post.views || 0}
        </span>
      </div>

      <!-- Small Fit Content Section -->
      <div class="p-2 flex flex-col justify-between flex-1 space-y-1.5">
        <div>
          <h4 class="font-bold text-xs line-clamp-1 text-white hover:text-amber-400 transition cursor-pointer" onclick="requestPlayVideo('${post.id}')">
            ${escapeHTML(post.title)}
          </h4>
          <p class="text-[10px] text-slate-400 line-clamp-1">${escapeHTML(post.description)}</p>
        </div>

        <div class="pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px]">
          <!-- Author Link -->
          <div class="flex items-center space-x-1 cursor-pointer truncate max-w-[65%]" onclick="navigateTo('user-profile', '${post.authorUid}')">
            <img src="${post.authorAvatar}" class="w-4 h-4 rounded-full object-cover border border-amber-500/50 shrink-0" alt=""/>
            <span class="text-slate-300 font-medium truncate">${escapeHTML(post.authorName)}</span>
          </div>

          <!-- Likes & Fast Download Link -->
          <div class="flex items-center space-x-2 text-slate-400 shrink-0">
            <button onclick="handleLike('${post.id}')" class="hover:text-amber-400 transition flex items-center gap-0.5">
              <i class="fa-regular fa-thumbs-up text-[10px]"></i>
              <span>${post.likes ? Object.keys(post.likes).length : 0}</span>
            </button>
            <a download href="${post.videoUrl}" target="_blank" class="hover:text-emerald-400 transition" title="Fast Download">
              <i class="fa-solid fa-download text-[10px]"></i>
            </a>
          </div>
        </div>
      </div>

    </div>
  `).join("");
}

// Leaderboard Top Viewed
function renderLeaderboard(posts) {
  const container = document.getElementById("leaderboardContainer");
  const sorted = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 50);

  if (!sorted.length) {
    container.innerHTML = `<div class="text-center text-slate-500 text-xs py-8">No leaderboard data available.</div>`;
    return;
  }

  container.innerHTML = sorted.map((p, idx) => `
    <div class="bg-slate-900 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between hover:border-amber-500/40 transition">
      <div class="flex items-center space-x-3 truncate">
        <span class="text-sm font-black ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-600'} w-5 text-center shrink-0">#${idx + 1}</span>
        <img src="${p.thumbnailUrl}" class="w-12 h-8 rounded object-cover shrink-0 cursor-pointer" onclick="requestPlayVideo('${p.id}')"/>
        <div class="truncate">
          <div class="flex items-center gap-1.5">
            <span class="text-[8px] bg-slate-800 text-amber-400 px-1 py-0.5 rounded font-mono font-bold uppercase">${escapeHTML(p.category || 'General')}</span>
            <h4 class="font-bold text-xs truncate hover:text-amber-400 cursor-pointer" onclick="requestPlayVideo('${p.id}')">${escapeHTML(p.title)}</h4>
          </div>
          <span class="text-[10px] text-slate-400 cursor-pointer" onclick="navigateTo('user-profile', '${p.authorUid}')">By ${escapeHTML(p.authorName)}</span>
        </div>
      </div>
      <div class="text-right shrink-0 pl-2">
        <span class="font-black text-amber-400 text-xs">${p.views || 0}</span>
        <div class="text-[8px] text-slate-500 font-mono">VIEWS</div>
      </div>
    </div>
  `).join("");
}

// Search Logic
function handleSearch(val) {
  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  applySearchAndCategoryFilter();
}

function clearSearch() {
  const input = document.getElementById("globalSearchInput");
  if (input) input.value = "";
  handleSearch("");
}

// --- VIDEO CONSUMPTION & 1 CREDIT DEDUCTION ---
function requestPlayVideo(postId) {
  const post = allPostsCache.find(p => p.id === postId);
  if (!post) return;

  const isOwnVideo = post.authorUid === currentUser.uid;

  if (!isOwnVideo) {
    if ((currentUser.credits || 0) < 1) {
      alert("You need 1 Credit to watch this video. Watch rewarded ads to earn credits!");
      openAdRewardModal();
      return;
    }

    currentUser.credits = Math.max(0, currentUser.credits - 1);
    db.ref("users/" + currentUser.uid + "/credits").set(currentUser.credits);
    saveLocalUser();
    updateCreditUI();
  }

  openVideoModal(post);
}

function openVideoModal(post) {
  activePostId = post.id;

  db.ref(`posts/${post.id}/views`).transaction(v => (v || 0) + 1);

  const video = document.getElementById("playerVideo");
  video.src = post.videoUrl;
  video.play().catch(() => {});

  document.getElementById("playerCategoryBadge").innerText = post.category || 'General';
  document.getElementById("playerTitle").innerText = post.title;
  document.getElementById("playerDesc").innerText = post.description;
  document.getElementById("playerViews").innerText = (post.views || 0) + 1;
  document.getElementById("playerDate").innerText = new Date(post.createdAt || Date.now()).toLocaleDateString();

  const dlBtn = document.getElementById("playerBtnDownload");
  dlBtn.href = post.videoUrl;
  dlBtn.setAttribute("download", `${post.title.replace(/\s+/g, '_')}.mp4`);

  document.getElementById("playerBtnLike").onclick = () => handleLike(post.id);
  document.getElementById("playerBtnShare").onclick = () => handleShareToProfile(post);

  db.ref(`comments/${post.id}`).on("value", (snap) => {
    const list = [];
    snap.forEach(c => list.unshift(c.val()));
    renderComments(list);
  });

  document.getElementById("modalPlayer").classList.remove("hidden");
}

function handleLike(postId) {
  const ref = db.ref(`posts/${postId}/likes/${currentUser.uid}`);
  ref.once("value", (snap) => {
    if (snap.exists()) {
      ref.remove();
    } else {
      ref.set(true);
    }
  });
}

function handleShareToProfile(post) {
  db.ref(`shares/${currentUser.uid}/${post.id}`).set({
    ...post,
    sharedAt: firebase.database.ServerValue.TIMESTAMP
  });
  alert("Video re-shared to your profile area!");
}

function handleAddComment(e) {
  e.preventDefault();
  const text = document.getElementById("inputComment").value.trim();
  if (!text || !activePostId) return;

  db.ref(`comments/${activePostId}`).push({
    authorUid: currentUser.uid,
    authorName: currentUser.name,
    authorAvatar: currentUser.avatar,
    text,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });

  document.getElementById("inputComment").value = "";
}

function renderComments(list) {
  const container = document.getElementById("playerCommentsList");
  if (!list.length) {
    container.innerHTML = `<div class="text-[10px] text-slate-500 py-1">No comments yet.</div>`;
    return;
  }
  container.innerHTML = list.map(c => `
    <div class="flex items-start space-x-2 text-[11px]">
      <img src="${c.authorAvatar}" class="w-5 h-5 rounded-full object-cover shrink-0 cursor-pointer" onclick="navigateTo('user-profile', '${c.authorUid}')"/>
      <div class="bg-slate-950 p-2 rounded-lg flex-1 border border-slate-800">
        <span class="font-bold text-amber-400 cursor-pointer" onclick="navigateTo('user-profile', '${c.authorUid}')">${escapeHTML(c.authorName)}</span>
        <p class="text-slate-300 text-[10px] mt-0.5">${escapeHTML(c.text)}</p>
      </div>
    </div>
  `).join("");
}

// --- INSTANT AUTO-PUBLISH VIDEO UPLOAD LOGIC ---
async function handleMediaUpload(e) {
  e.preventDefault();
  const videoFile = document.getElementById("upVideoFile").files[0];
  const thumbFile = document.getElementById("upThumbFile").files[0];
  const title = document.getElementById("upTitle").value.trim();
  const desc = document.getElementById("upDescription").value.trim();
  const theme = document.getElementById("upCardTheme").value;
  
  // Resolve Selected Category or Custom Input
  const categorySelect = document.getElementById("upCategorySelect").value;
  let finalCategory = categorySelect;
  if (categorySelect === "custom") {
    finalCategory = document.getElementById("upCustomCategory").value.trim() || "General";
  }

  const btn = document.getElementById("btnSubmitUpload");

  if (!videoFile || !thumbFile) return;

  // Validate Max 10 Minutes Duration via temporary video object
  const tempVideo = document.createElement("video");
  tempVideo.preload = "metadata";
  tempVideo.src = URL.createObjectURL(videoFile);

  tempVideo.onloadedmetadata = async () => {
    URL.revokeObjectURL(tempVideo.src);
    if (tempVideo.duration > 605) { // 10 minutes + 5s buffer
      alert("Video duration exceeds 10 minutes limit! Please select a shorter video.");
      return;
    }

    btn.disabled = true;
    const progressContainer = document.getElementById("uploadProgressContainer");
    progressContainer.classList.remove("hidden");
    document.getElementById("uploadStatusText").innerText = "Streaming Video & Thumbnail to CDN...";

    try {
      const fileKey = Date.now().toString();
      const vidRef = storage.ref(`videos/${currentUser.uid}_${fileKey}_${videoFile.name}`);
      const thumbRef = storage.ref(`thumbs/${currentUser.uid}_${fileKey}_${thumbFile.name}`);

      // Parallel Upload with Byte Transfer Tracking
      const vidTask = vidRef.put(videoFile);
      const thumbTask = thumbRef.put(thumbFile);

      vidTask.on("state_changed", (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        document.getElementById("uploadProgressBar").style.width = pct + "%";
        document.getElementById("uploadPercent").innerText = pct + "%";
      });

      // Wait for both to complete
      await Promise.all([vidTask, thumbTask]);

      document.getElementById("uploadStatusText").innerText = "Auto-publishing to Feed & Realtime DB...";
      const videoUrl = await vidRef.getDownloadURL();
      const thumbnailUrl = await thumbRef.getDownloadURL();

      // Instant push to Firebase Realtime Database
      const newPostRef = db.ref("posts").push();
      const newPostData = {
        title,
        description: desc,
        category: finalCategory,
        videoUrl,
        thumbnailUrl,
        theme,
        authorUid: currentUser.uid,
        authorName: currentUser.name,
        authorAvatar: currentUser.avatar,
        views: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP
      };

      await newPostRef.set(newPostData);

      // Close modal and navigate instantly to feed
      closeModal("modalUpload");
      document.getElementById("uploadForm").reset();
      toggleCustomCategory("Entertainment");
      navigateTo("feed");

      alert(`Video instantly published live in "${finalCategory}"!`);
    } catch (err) {
      alert("Instant upload error: " + err.message);
    } finally {
      btn.disabled = false;
      progressContainer.classList.add("hidden");
    }
  };
}

// --- PROFILE MANAGEMENT & VISITOR DISPLAY ---
async function loadProfile(uid) {
  const isSelf = uid === currentUser.uid;
  const snap = await db.ref(`users/${uid}`).once("value");
  const userData = snap.val() || currentUser;

  document.getElementById("profileDisplayName").innerText = userData.name;
  document.getElementById("profileDisplayBio").innerText = userData.bio || "Digital video creator on Paperhouse Video Limited.";
  document.getElementById("profileDisplayAvatar").src = userData.avatar;

  document.getElementById("btnEditName").style.display = isSelf ? "inline-block" : "none";
  document.getElementById("btnChangeAvatar").style.display = isSelf ? "flex" : "none";

  const actionContainer = document.getElementById("profileActions");
  if (!isSelf) {
    actionContainer.innerHTML = `
      <button onclick="openDirectMessage('${uid}', '${escapeHTML(userData.name)}', '${userData.avatar}')" class="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 active:scale-95 transition shadow-lg shadow-amber-500/20">
        <i class="fa-solid fa-envelope"></i>
        <span>Message ${escapeHTML(userData.name)}</span>
      </button>
    `;
  } else {
    actionContainer.innerHTML = `
      <button onclick="editBio()" class="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-700">
        Edit Bio
      </button>
    `;
  }

  // Load User's Videos in User Area
  const userPosts = allPostsCache.filter(p => p.authorUid === uid);
  document.getElementById("profilePostCount").innerText = userPosts.length;
  const totalViews = userPosts.reduce((acc, curr) => acc + (curr.views || 0), 0);
  document.getElementById("profileTotalViews").innerText = totalViews;

  const container = document.getElementById("profilePostsContainer");
  if (!userPosts.length) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs">No videos published by this creator yet.</div>`;
    return;
  }

  container.innerHTML = userPosts.map(p => `
    <div class="${p.theme || 'theme-diamond'} rounded-xl overflow-hidden cursor-pointer" onclick="requestPlayVideo('${p.id}')">
      <img src="${p.thumbnailUrl}" class="w-full aspect-[4/3] object-cover" loading="lazy"/>
      <div class="p-2">
        <div class="flex items-center justify-between">
          <span class="text-[8px] bg-slate-800 text-amber-400 px-1 py-0.5 rounded font-bold uppercase">${escapeHTML(p.category || 'General')}</span>
          <span class="text-[9px] text-slate-400">${p.views || 0} views</span>
        </div>
        <h5 class="font-bold text-[11px] truncate text-white mt-1">${escapeHTML(p.title)}</h5>
      </div>
    </div>
  `).join("");
}

// Edit Username
function editUserName() {
  const current = currentUser.name;
  const newName = prompt("Enter your new display name:", current);
  if (newName && newName.trim() !== "" && newName.trim() !== current) {
    currentUser.name = newName.trim();
    saveLocalUser();
    db.ref(`users/${currentUser.uid}/name`).set(currentUser.name);
    document.getElementById("profileDisplayName").innerText = currentUser.name;
    alert("Display name updated!");
  }
}

// Edit Bio
function editBio() {
  const current = currentUser.bio;
  const newBio = prompt("Enter your new bio:", current);
  if (newBio !== null && newBio.trim() !== "") {
    currentUser.bio = newBio.trim();
    saveLocalUser();
    db.ref(`users/${currentUser.uid}/bio`).set(currentUser.bio);
    document.getElementById("profileDisplayBio").innerText = currentUser.bio;
  }
}

// Change Profile Picture / Avatar
async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const ref = storage.ref(`avatars/${currentUser.uid}_${file.name}`);
    await ref.put(file);
    const downloadUrl = await ref.getDownloadURL();

    currentUser.avatar = downloadUrl;
    saveLocalUser();
    await db.ref(`users/${currentUser.uid}/avatar`).set(downloadUrl);

    document.getElementById("profileDisplayAvatar").src = downloadUrl;
    updateNavAvatar();
    alert("Profile avatar updated successfully!");
  } catch (err) {
    alert("Avatar update error: " + err.message);
  }
}

// --- DIRECT MESSAGING (USER-TO-USER) ---
function openDirectMessage(recipientUid, name, avatar) {
  activeDmRecipientUid = recipientUid;
  document.getElementById("dmRecipientName").innerText = name;
  document.getElementById("dmRecipientAvatar").src = avatar;

  const convKey = [currentUser.uid, recipientUid].sort().join("_");
  db.ref(`direct_messages/${convKey}`).limitToLast(50).on("value", (snap) => {
    const list = [];
    snap.forEach(m => list.push(m.val()));
    renderChatMessages("dmMessages", list);
  });

  navigateTo("direct-chat");
}

function handleSendDirectMessage(e) {
  e.preventDefault();
  const text = document.getElementById("inputDirectMsg").value.trim();
  if (!text || !activeDmRecipientUid) return;

  const convKey = [currentUser.uid, activeDmRecipientUid].sort().join("_");
  db.ref(`direct_messages/${convKey}`).push({
    senderUid: currentUser.uid,
    senderName: currentUser.name,
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  document.getElementById("inputDirectMsg").value = "";
}

// --- COMMUNITY GROUPS (MAX 5 GROUPS, 300 MEMBERS) ---
db.ref("groups").on("value", (snapshot) => {
  const groups = [];
  snapshot.forEach(g => groups.push({ id: g.key, ...g.val() }));
  renderGroups(groups);
});

function renderGroups(groups) {
  const container = document.getElementById("groupsContainer");
  if (!groups.length) {
    container.innerHTML = `<div class="col-span-full text-center text-slate-500 text-xs py-8">No groups created yet. Be the first!</div>`;
    return;
  }

  container.innerHTML = groups.map(g => {
    const memberCount = g.members ? Object.keys(g.members).length : 0;
    const isMember = g.members && g.members[currentUser.uid];

    return `
      <div class="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-xs text-white truncate">${escapeHTML(g.name)}</h4>
            <span class="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 font-mono">${memberCount}/300</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5">Creator: ${escapeHTML(g.creatorName)}</p>
        </div>
        <div class="mt-3">
          ${isMember ? `
            <button onclick="enterGroupChat('${g.id}', '${escapeHTML(g.name)}', ${memberCount})" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-1 rounded-lg text-xs transition">
              Open Chat
            </button>
          ` : `
            <button onclick="handleJoinGroup('${g.id}', ${memberCount})" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-1 rounded-lg text-xs transition">
              Join Group
            </button>
          `}
        </div>
      </div>
    `;
  }).join("");
}

async function handleCreateGroup(e) {
  e.preventDefault();
  const name = document.getElementById("newGroupName").value.trim();
  if (!name) return;

  const snap = await db.ref("groups").orderByChild("creatorUid").equalTo(currentUser.uid).once("value");
  if (snap.numChildren() >= 5) {
    alert("Limit reached: You can create a maximum of 5 groups.");
    return;
  }

  const groupRef = db.ref("groups").push();
  await groupRef.set({
    name,
    creatorUid: currentUser.uid,
    creatorName: currentUser.name,
    createdAt: firebase.database.ServerValue.TIMESTAMP,
    members: {
      [currentUser.uid]: true
    }
  });

  closeModal("modalCreateGroup");
  document.getElementById("newGroupName").value = "";
}

function handleJoinGroup(groupId, memberCount) {
  if (memberCount >= 300) {
    alert("This group has reached its maximum capacity of 300 members.");
    return;
  }
  db.ref(`groups/${groupId}/members/${currentUser.uid}`).set(true);
}

function enterGroupChat(groupId, groupName, memberCount) {
  activeGroupId = groupId;
  document.getElementById("currentGroupName").innerText = groupName;
  document.getElementById("currentGroupMeta").innerText = `${memberCount} / 300 Members`;

  db.ref(`group_messages/${groupId}`).limitToLast(50).on("value", (snap) => {
    const list = [];
    snap.forEach(m => list.push(m.val()));
    renderChatMessages("groupMessages", list);
  });

  navigateTo("group-chat");
}

function handleSendGroupMessage(e) {
  e.preventDefault();
  const text = document.getElementById("inputGroupMsg").value.trim();
  if (!text || !activeGroupId) return;

  db.ref(`group_messages/${activeGroupId}`).push({
    senderUid: currentUser.uid,
    senderName: currentUser.name,
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  document.getElementById("inputGroupMsg").value = "";
}

// Chat Messages Renderer
function renderChatMessages(elementId, messages) {
  const el = document.getElementById(elementId);
  el.innerHTML = messages.map(m => {
    const isSelf = m.senderUid === currentUser.uid;
    return `
      <div class="flex flex-col ${isSelf ? 'items-end' : 'items-start'}">
        <div class="px-3 py-1.5 rounded-2xl max-w-[80%] ${isSelf ? 'bg-amber-500 text-slate-950 font-medium' : 'bg-slate-800 text-slate-200 border border-slate-700'}">
          ${escapeHTML(m.text)}
        </div>
        <span class="text-[8px] text-slate-500 mt-0.5 px-1">${escapeHTML(m.senderName || '')}</span>
      </div>
    `;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

// --- MODAL UTILITIES ---
function openUploadModal() { document.getElementById("modalUpload").classList.remove("hidden"); }
function openCreateGroupModal() { document.getElementById("modalCreateGroup").classList.remove("hidden"); }
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
  if (id === "modalPlayer") {
    const vid = document.getElementById("playerVideo");
    vid.pause();
    vid.src = "";
  }
}

function escapeHTML(str) {
  return (str || "").replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// --- APP BOOTSTRAP ---
window.addEventListener("DOMContentLoaded", () => {
  initUser();
  initInAppAds();
  renderCategoryPills();
});

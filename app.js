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
let currentUser = JSON.parse(localStorage.getItem("sh_user")) || null;
let activeGroupId = null;
let activeDmRecipientUid = null;
let activePostId = null;
let allPostsCache = [];

// Initialize Local Session If Not Exists
function initUser() {
  if (!currentUser) {
    const randomId = "u_" + Math.random().toString(36).substring(2, 9);
    currentUser = {
      uid: randomId,
      name: "User_" + randomId.substring(2, 6),
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
      bio: "Digital media enthusiast & creator."
    };
    localStorage.setItem("sh_user", JSON.stringify(currentUser));
  }
  // Sync to database
  db.ref("users/" + currentUser.uid).update(currentUser);
  updateNavUser();
}

function updateNavUser() {
  document.getElementById("navAvatar").src = currentUser.avatar;
}

// Navigation Handler
function navigateTo(viewId, targetUid = null) {
  const views = ["feed", "leaderboard", "groups", "group-chat", "profile", "direct-chat"];
  views.forEach(v => {
    const el = document.getElementById("view-" + v);
    if (el) el.classList.add("hidden");
  });

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

// --- MEDIA STREAM & LEADERBOARD LOGIC ---

// Listen for Realtime Public Posts
db.ref("posts").orderByChild("createdAt").on("value", (snapshot) => {
  allPostsCache = [];
  snapshot.forEach((child) => {
    allPostsCache.unshift({ id: child.key, ...child.val() });
  });
  renderFeed(allPostsCache);
  renderLeaderboard(allPostsCache);
});

function renderFeed(posts) {
  const container = document.getElementById("postsContainer");
  if (!posts || posts.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-500">No media uploaded yet. Be the first to publish!</div>`;
    return;
  }

  container.innerHTML = posts.map(post => `
    <div class="${post.theme || 'theme-diamond'} rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1">
      <div class="relative aspect-video bg-black cursor-pointer group" onclick="openPlayer('${post.id}')">
        <img src="${post.thumbnailUrl}" class="w-full h-full object-cover group-hover:opacity-80 transition" alt=""/>
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <div class="w-10 h-10 bg-amber-500/90 text-slate-950 rounded-full flex items-center justify-center font-bold pl-0.5">
            <i class="fa-solid fa-play"></i>
          </div>
        </div>
        <span class="absolute bottom-2 right-2 bg-black/80 text-[10px] px-1.5 py-0.5 rounded font-mono text-slate-200">
          <i class="fa-solid fa-eye text-amber-400"></i> ${post.views || 0}
        </span>
      </div>

      <div class="p-3.5 flex flex-col justify-between flex-1">
        <div>
          <h4 class="font-bold text-sm line-clamp-1 cursor-pointer hover:text-amber-400 transition" onclick="openPlayer('${post.id}')">${escapeHTML(post.title)}</h4>
          <p class="text-xs text-slate-400 line-clamp-2 mt-1">${escapeHTML(post.description)}</p>
        </div>

        <div class="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
          <div class="flex items-center space-x-2 cursor-pointer" onclick="navigateTo('user-profile', '${post.authorUid}')">
            <img src="${post.authorAvatar}" class="w-5 h-5 rounded-full object-cover" alt=""/>
            <span class="text-slate-300 font-medium text-[11px] truncate max-w-[90px]">${escapeHTML(post.authorName)}</span>
          </div>
          <div class="flex items-center space-x-2 text-slate-400">
            <button onclick="handleLike('${post.id}')" class="hover:text-amber-400 transition">
              <i class="fa-regular fa-thumbs-up"></i> ${post.likes ? Object.keys(post.likes).length : 0}
            </button>
            <a download href="${post.videoUrl}" target="_blank" class="hover:text-emerald-400 transition" title="Fast Download">
              <i class="fa-solid fa-download"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderLeaderboard(posts) {
  const container = document.getElementById("leaderboardContainer");
  const sorted = [...posts].sort((a, b) => (b.views || 0) - (a.views || 0));

  container.innerHTML = sorted.map((p, idx) => `
    <div class="bg-slate-900 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between hover:border-amber-500/50 transition">
      <div class="flex items-center space-x-4">
        <span class="text-lg font-black ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-600'} w-6 text-center">#${idx + 1}</span>
        <img src="${p.thumbnailUrl}" class="w-16 h-10 rounded-lg object-cover cursor-pointer" onclick="openPlayer('${p.id}')"/>
        <div>
          <h4 class="font-bold text-sm hover:text-amber-400 cursor-pointer" onclick="openPlayer('${p.id}')">${escapeHTML(p.title)}</h4>
          <span class="text-xs text-slate-400">By ${escapeHTML(p.authorName)}</span>
        </div>
      </div>
      <div class="text-right">
        <span class="font-extrabold text-amber-400 text-sm">${p.views || 0}</span>
        <div class="text-[10px] text-slate-500">VIEWS</div>
      </div>
    </div>
  `).join("");
}

// Search Filter
function handleSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) {
    renderFeed(allPostsCache);
    return;
  }
  const filtered = allPostsCache.filter(p => 
    p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
  );
  renderFeed(filtered);
}

// --- VIDEO UPLOAD WORKFLOW ---
async function handleMediaUpload(e) {
  e.preventDefault();
  const videoFile = document.getElementById("upVideoFile").files[0];
  const thumbFile = document.getElementById("upThumbFile").files[0];
  const title = document.getElementById("upTitle").value.trim();
  const desc = document.getElementById("upDescription").value.trim();
  const theme = document.getElementById("upCardTheme").value;
  const btn = document.getElementById("btnSubmitUpload");

  if (!videoFile || !thumbFile) return;

  btn.disabled = true;
  document.getElementById("uploadProgressContainer").classList.remove("hidden");

  try {
    const randKey = Date.now().toString();
    const vidRef = storage.ref(`videos/${currentUser.uid}_${randKey}_${videoFile.name}`);
    const thumbRef = storage.ref(`thumbs/${currentUser.uid}_${randKey}_${thumbFile.name}`);

    // Upload Video with fast chunk tracking
    const vidTask = vidRef.put(videoFile);
    vidTask.on("state_changed", (snapshot) => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      document.getElementById("uploadProgressBar").style.width = pct + "%";
      document.getElementById("uploadPercent").innerText = pct + "%";
    });

    await vidTask;
    const videoUrl = await vidRef.getDownloadURL();

    // Upload Thumbnail
    await thumbRef.put(thumbFile);
    const thumbnailUrl = await thumbRef.getDownloadURL();

    // Write Post Object to RTDB
    const newPostRef = db.ref("posts").push();
    await newPostRef.set({
      title,
      description: desc,
      videoUrl,
      thumbnailUrl,
      theme,
      authorUid: currentUser.uid,
      authorName: currentUser.name,
      authorAvatar: currentUser.avatar,
      views: 0,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    });

    closeModal("modalUpload");
    document.getElementById("uploadForm").reset();
    alert("Post published successfully!");
  } catch (err) {
    alert("Upload failed: " + err.message);
  } finally {
    btn.disabled = false;
    document.getElementById("uploadProgressContainer").classList.add("hidden");
  }
}

// --- MEDIA PLAYER & INTERACTIONS ---
function openPlayer(postId) {
  activePostId = postId;
  const post = allPostsCache.find(p => p.id === postId);
  if (!post) return;

  // Increment view counter
  db.ref(`posts/${postId}/views`).transaction(v => (v || 0) + 1);

  document.getElementById("playerVideo").src = post.videoUrl;
  document.getElementById("playerTitle").innerText = post.title;
  document.getElementById("playerDesc").innerText = post.description;
  document.getElementById("playerViews").innerText = (post.views || 0) + 1;
  document.getElementById("playerDate").innerText = new Date(post.createdAt || Date.now()).toLocaleDateString();
  document.getElementById("playerBtnDownload").href = post.videoUrl;

  document.getElementById("playerBtnLike").onclick = () => handleLike(postId);
  document.getElementById("playerBtnShare").onclick = () => handleShareToProfile(post);

  // Sync Comments
  db.ref(`comments/${postId}`).on("value", (snap) => {
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
  alert("Re-shared to your profile gallery!");
}

function handleAddComment(e) {
  e.preventDefault();
  const text = document.getElementById("inputComment").value.trim();
  if (!text || !activePostId) return;

  db.ref(`comments/${activePostId}`).push({
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
    container.innerHTML = `<div class="text-xs text-slate-500">No comments yet.</div>`;
    return;
  }
  container.innerHTML = list.map(c => `
    <div class="flex items-start space-x-2 text-xs">
      <img src="${c.authorAvatar}" class="w-6 h-6 rounded-full object-cover"/>
      <div class="bg-slate-950 p-2 rounded-lg flex-1 border border-slate-800">
        <span class="font-bold text-amber-400">${escapeHTML(c.authorName)}</span>
        <p class="text-slate-300 mt-0.5">${escapeHTML(c.text)}</p>
      </div>
    </div>
  `).join("");
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
    container.innerHTML = `<div class="col-span-full text-center text-slate-500 py-6">No groups created yet.</div>`;
    return;
  }
  container.innerHTML = groups.map(g => {
    const memberCount = g.members ? Object.keys(g.members).length : 0;
    const isMember = g.members && g.members[currentUser.uid];

    return `
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
        <div>
          <div class="flex justify-between items-center">
            <h4 class="font-bold text-sm">${escapeHTML(g.name)}</h4>
            <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-amber-400 font-mono">${memberCount}/300</span>
          </div>
          <p class="text-xs text-slate-400 mt-1">Creator: ${escapeHTML(g.creatorName)}</p>
        </div>
        <div class="mt-4 flex gap-2">
          ${isMember ? `
            <button onclick="enterGroupChat('${g.id}', '${escapeHTML(g.name)}', ${memberCount})" class="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-1.5 rounded-lg text-xs transition">
              Open Chat
            </button>
          ` : `
            <button onclick="handleJoinGroup('${g.id}', ${memberCount})" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-1.5 rounded-lg text-xs transition">
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

  // Check how many groups this user already created (Max 5 limit)
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

  // Attach group chat listener
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
    senderAvatar: currentUser.avatar,
    text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  document.getElementById("inputGroupMsg").value = "";
}

// --- PROFILE & DIRECT MESSAGING ---
async function loadProfile(uid) {
  const snap = await db.ref(`users/${uid}`).once("value");
  const userData = snap.val() || currentUser;

  document.getElementById("profileDisplayName").innerText = userData.name;
  document.getElementById("profileDisplayBio").innerText = userData.bio || "Content creator on StreamHub.";
  document.getElementById("profileDisplayAvatar").src = userData.avatar;

  const isSelf = uid === currentUser.uid;
  document.getElementById("btnChangeAvatar").style.display = isSelf ? "flex" : "none";

  const actionContainer = document.getElementById("profileActions");
  if (!isSelf) {
    actionContainer.innerHTML = `
      <button onclick="openDirectMessage('${uid}', '${escapeHTML(userData.name)}', '${userData.avatar}')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-amber-500/20">
        <i class="fa-solid fa-envelope"></i> <span>Message</span>
      </button>
    `;
  } else {
    actionContainer.innerHTML = `
      <button onclick="editBio()" class="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-700">
        Edit Bio
      </button>
    `;
  }

  // Load User Posts
  const userPosts = allPostsCache.filter(p => p.authorUid === uid);
  document.getElementById("profilePostCount").innerText = userPosts.length;
  const totalViews = userPosts.reduce((acc, curr) => acc + (curr.views || 0), 0);
  document.getElementById("profileTotalViews").innerText = totalViews;

  const postContainer = document.getElementById("profilePostsContainer");
  if (!userPosts.length) {
    postContainer.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500">No media uploads found.</div>`;
    return;
  }
  postContainer.innerHTML = userPosts.map(p => `
    <div class="${p.theme || 'theme-diamond'} rounded-xl overflow-hidden cursor-pointer" onclick="openPlayer('${p.id}')">
      <img src="${p.thumbnailUrl}" class="w-full aspect-video object-cover"/>
      <div class="p-3">
        <h5 class="font-bold text-xs truncate">${escapeHTML(p.title)}</h5>
        <div class="text-[10px] text-slate-400 mt-1 flex justify-between">
          <span>${p.views || 0} views</span>
          <span class="text-emerald-400">Published</span>
        </div>
      </div>
    </div>
  `).join("");
}

async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;

  try {
    const ref = storage.ref(`avatars/${currentUser.uid}_${file.name}`);
    await ref.put(file);
    const downloadUrl = await ref.getDownloadURL();

    currentUser.avatar = downloadUrl;
    localStorage.setItem("sh_user", JSON.stringify(currentUser));
    await db.ref(`users/${currentUser.uid}/avatar`).set(downloadUrl);

    document.getElementById("profileDisplayAvatar").src = downloadUrl;
    updateNavUser();
    alert("Profile picture updated!");
  } catch (err) {
    alert("Avatar update error: " + err.message);
  }
}

function editBio() {
  const currentBio = document.getElementById("profileDisplayBio").innerText;
  const newBio = prompt("Enter your new bio:", currentBio);
  if (newBio !== null) {
    currentUser.bio = newBio;
    localStorage.setItem("sh_user", JSON.stringify(currentUser));
    db.ref(`users/${currentUser.uid}/bio`).set(newBio);
    document.getElementById("profileDisplayBio").innerText = newBio;
  }
}

// Open Direct Messaging View
function openDirectMessage(recipientUid, name, avatar) {
  activeDmRecipientUid = recipientUid;
  document.getElementById("dmRecipientName").innerText = name;
  document.getElementById("dmRecipientAvatar").src = avatar;

  // Build unified conversation key
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

// Universal Chat Bubble Renderer
function renderChatMessages(elementId, messages) {
  const el = document.getElementById(elementId);
  el.innerHTML = messages.map(m => {
    const isSelf = m.senderUid === currentUser.uid;
    return `
      <div class="flex flex-col ${isSelf ? 'items-end' : 'items-start'}">
        <div class="flex items-end gap-1.5 max-w-[80%] ${isSelf ? 'flex-row-reverse' : ''}">
          <div class="px-3.5 py-2 rounded-2xl text-xs ${isSelf ? 'bg-amber-500 text-slate-950 font-medium' : 'bg-slate-800 text-slate-200 border border-slate-700'}">
            ${escapeHTML(m.text)}
          </div>
        </div>
        <span class="text-[9px] text-slate-500 mt-1 px-1">${m.senderName || ''}</span>
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
    document.getElementById("playerVideo").pause();
    document.getElementById("playerVideo").src = "";
  }
}

function escapeHTML(str) {
  return (str || "").replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

// --- APPLICATION BOOT ---
initUser();
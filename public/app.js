// ==================== 全局状态 ====================
var state = {
  currentUser: null,
  currentView: 'home',
  currentCategory: 'all',
  currentPage: 1,
  currentPostId: null,
  currentChatUserId: null,
  unreadCount: 0
};

// 头像加载失败时的兜底图（内联 SVG，不依赖任何静态文件）
var AVATAR_FALLBACK = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">' +
  '<circle cx="50" cy="50" r="50" fill="#cbd5e0"/>' +
  '<text x="50" y="63" font-size="36" fill="#ffffff" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700">🐻</text>' +
  '</svg>'
);

var categoryMap = {
  art: '🎨 艺术', life: '🌿 生活', academic: '📚 学术', entertainment: '🎮 娱乐'
};
var catClassMap = {
  art: 'cat-art', life: 'cat-life', academic: 'cat-academic', entertainment: 'cat-entertainment'
};

// ==================== 初始化 ====================
function init() {
  fetchCurrentUser();
  renderTopbar();
  renderHome();
  if (state.currentUser) { pollUnread(); }
}
init();

// ==================== API 封装 ====================
function getToken() {
  return localStorage.getItem('token');
}
function setToken(token) {
  if (token) { localStorage.setItem('token', token); }
  else { localStorage.removeItem('token'); }
}

async function api(url, options) {
  options = options || {};
  try {
    var headers = { 'Content-Type': 'application/json' };
    var token = getToken();
    if (token) { headers['Authorization'] = token; }
    if (options.headers) {
      Object.keys(options.headers).forEach(function(k) { headers[k] = options.headers[k]; });
    }
    var res = await fetch(url, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    });
    var data = await res.json();
    if (!res.ok && data.error) { throw new Error(data.error); }
    return data;
  } catch (e) {
    showToast(e.message || '请求失败');
    throw e;
  }
}

async function fetchCurrentUser() {
  try {
    var data = await api('/api/me');
    state.currentUser = data.user;
    updateUnreadCount();
  } catch(e) {}
}

async function updateUnreadCount() {
  if (!state.currentUser) { state.unreadCount = 0; return; }
  try {
    var data = await api('/api/unread-count');
    state.unreadCount = data.count;
    renderTopbar();
  } catch(e) {}
}

function pollUnread() {
  setInterval(updateUnreadCount, 30000);
}

// ==================== 导航 ====================
function navigate(view, params) {
  state.currentView = view;
  if (view === 'home' || !view) {
    state.currentPostId = null;
    state.currentChatUserId = null;
    renderHome();
  } else if (view === 'post') {
    renderPostDetail(params.id || state.currentPostId);
  } else if (view === 'profile') {
    renderProfile(params.userId || (state.currentUser ? state.currentUser.id : null));
  } else if (view === 'messages') {
    renderMessages();
  }
  window.scrollTo(0, 0);
}

function switchCategory(cat, el) {
  state.currentCategory = cat;
  state.currentPage = 1;
  var items = document.querySelectorAll('.cat-item');
  items.forEach(function(c) { c.classList.remove('active'); });
  if (el) { el.classList.add('active'); }
  else {
    var target = document.querySelector('.cat-item[data-cat="' + cat + '"]');
    if (target) { target.classList.add('active'); }
  }
  loadPosts();
}

// ==================== Toast ====================
function showToast(msg) {
  var container = document.getElementById('toastContainer');
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}

// ==================== 顶部栏 ====================
function renderTopbar() {
  var el = document.getElementById('topbarActions');
  if (state.currentUser) {
    var ddBadge = state.unreadCount > 0 ? '(' + state.unreadCount + '条新消息)' : '';
    el.innerHTML = '<div class="user-menu" onclick="toggleDropdown(event)">' +
      '<div style="position:relative;">' +
        '<img src="' + state.currentUser.avatar + '" class="user-avatar" onerror="this.src=AVATAR_FALLBACK">' +
        '<div class="msg-badge" id="msgBadge" style="display:' + (state.unreadCount > 0 ? 'flex' : 'none') + '">' + (state.unreadCount > 99 ? '99+' : state.unreadCount) + '</div>' +
      '</div>' +
      '<span class="user-nickname">' + escapeHtml(state.currentUser.nickname) + '</span>' +
      '<span style="font-size:10px;color:#999;">▼</span>' +
      '<div class="dropdown-menu" id="userDropdown">' +
        '<a href="javascript:void(0)" onclick="navigate(\'profile\',{userId:\'' + state.currentUser.id + '\'})">👤 我的主页</a>' +
        '<a href="javascript:void(0)" onclick="navigate(\'messages\')">💬 私信<span style="margin-left:6px;color:#ff4444;font-size:12px;">' + ddBadge + '</span></a>' +
        '<button onclick="showCreatePost()">✏️ 发布帖子</button>' +
        '<button onclick="logout()">🚪 退出登录</button>' +
      '</div>' +
    '</div>';
  } else {
    el.innerHTML = '<button class="btn-login" onclick="showLogin()">登录 / 注册</button>';
  }
}

function toggleDropdown(e) {
  e.stopPropagation();
  document.getElementById('userDropdown').classList.toggle('show');
}
document.addEventListener('click', function() {
  var dd = document.getElementById('userDropdown');
  if (dd) { dd.classList.remove('show'); }
});

// ==================== 登录/注册弹窗 ====================
function showLogin() {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'loginModal';
  overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); } };
  overlay.innerHTML = '<div class="modal">' +
    '<div class="modal-header"><h2>登录 / 注册</h2><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="form-group"><label>昵称</label><input type="text" id="loginNickname" placeholder="请输入昵称" maxlength="20"></div>' +
      '<div class="form-group"><label>密码</label><input type="password" id="loginPassword" placeholder="请输入密码（至少3位）" maxlength="30"></div>' +
      '<p style="font-size:12px;color:#999;margin-bottom:16px;">如果昵称不存在，将自动注册新账号</p>' +
      '<button class="btn-submit" id="loginBtn" onclick="doLogin()">登录 / 注册</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);
  setTimeout(function() { document.getElementById('loginNickname').focus(); }, 300);
}

async function doLogin() {
  var nickname = document.getElementById('loginNickname').value.trim();
  var password = document.getElementById('loginPassword').value.trim();
  if (!nickname || !password) { return showToast('请填写昵称和密码'); }
  if (password.length < 3) { return showToast('密码至少3位'); }

  var btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.textContent = '处理中...';

  try {
    var data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ nickname: nickname, password: password })
    });
    setToken(data.token);
    state.currentUser = data.user;
    document.getElementById('loginModal').remove();
    renderTopbar();
    renderHome();
    showToast('欢迎回来，' + data.user.nickname + '！');
    if (state.currentUser) { pollUnread(); }
  } catch(e) {
    try {
      var data2 = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ nickname: nickname, password: password })
      });
      setToken(data2.token);
      state.currentUser = data2.user;
      document.getElementById('loginModal').remove();
      renderTopbar();
      renderHome();
      showToast('注册成功，欢迎加入金熊站！');
      if (state.currentUser) { pollUnread(); }
    } catch(e2) {
      btn.disabled = false;
      btn.textContent = '登录 / 注册';
    }
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  setToken(null);
  state.currentUser = null;
  state.unreadCount = 0;
  renderTopbar();
  renderHome();
  showToast('已退出登录');
}

// ==================== 首页 ====================
function renderHome() {
  state.currentView = 'home';
  state.currentPostId = null;
  state.currentChatUserId = null;
  var main = document.getElementById('mainWrap');
  main.innerHTML = '<div class="content-area" id="postsArea"><div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div></div>' +
    '<div class="sidebar" id="sidebarArea"></div>';
  loadPosts();
  renderSidebar();
}

async function loadPosts() {
  var area = document.getElementById('postsArea');
  if (!area) { return; }
  try {
    var data = await api('/api/posts?category=' + state.currentCategory + '&page=' + state.currentPage + '&limit=20');
    renderPosts(data);
  } catch(e) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">😢</div><p>加载失败，请刷新重试</p></div>';
  }
}

function renderPosts(data) {
  var area = document.getElementById('postsArea');
  if (!data.posts || data.posts.length === 0) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>暂无帖子，快来发第一个帖子吧！</p></div>';
    return;
  }

  var html = '';
  data.posts.forEach(function(p) {
    var images = p.images || [];
    var files = p.files || [];
    var imageHtml = '';
    if (images.length > 0) {
      imageHtml = '<div class="post-card-images">';
      images.slice(0, 4).forEach(function(url) {
        var ext = url.split('.').pop().toLowerCase();
        if (['mp4','webm','ogg','mov'].indexOf(ext) !== -1) {
          imageHtml += '<video src="' + url + '" onclick="event.stopPropagation();showMedia(\'' + url + '\',\'video\')" muted></video>';
        } else {
          imageHtml += '<img src="' + url + '" onclick="event.stopPropagation();showMedia(\'' + url + '\',\'image\')">';
        }
      });
      if (images.length > 4) {
        imageHtml += '<span style="font-size:12px;color:#999;align-self:center;">+' + (images.length - 4) + '张</span>';
      }
      imageHtml += '</div>';
    }
    var fileHtml = '';
    if (files.length > 0) {
      fileHtml = '<div class="post-card-files">';
      files.slice(0, 3).forEach(function(f) {
        fileHtml += '<span class="file-tag">📎 ' + escapeHtml(f.name) + '</span>';
      });
      if (files.length > 3) {
        fileHtml += '<span style="font-size:12px;color:#999;">+' + (files.length - 3) + '个</span>';
      }
      fileHtml += '</div>';
    }

    html += '<div class="post-card" onclick="navigate(\'post\',{id:\'' + p.id + '\'})">' +
      '<div class="post-card-header">' +
        '<img src="' + p.avatar + '" class="post-card-avatar" onerror="this.src=AVATAR_FALLBACK">' +
        '<span class="post-card-nickname">' + escapeHtml(p.nickname) + '</span>' +
        '<span class="cat-badge ' + (catClassMap[p.category] || '') + '">' + (categoryMap[p.category] || p.category) + '</span>' +
        '<span class="post-card-time">' + formatTime(p.created_at) + '</span>' +
      '</div>' +
      '<div class="post-card-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="post-card-content">' + escapeHtml(p.content) + '</div>' +
      imageHtml + fileHtml +
      '<div class="post-card-stats">' +
        '<span>❤️ ' + (p.like_count || 0) + '</span>' +
        '<span>💬 ' + (p.comment_count || 0) + '</span>' +
      '</div>' +
    '</div>';
  });

  var paginationHtml = '';
  if (data.totalPages > 1) {
    paginationHtml = '<div class="pagination">';
    paginationHtml += '<button ' + (data.page <= 1 ? 'disabled' : '') + ' onclick="state.currentPage--;loadPosts()">上一页</button>';
    for (var i = 1; i <= data.totalPages; i++) {
      if (i === 1 || i === data.totalPages || (i >= data.page - 2 && i <= data.page + 2)) {
        paginationHtml += '<button class="' + (i === data.page ? 'active' : '') + '" onclick="state.currentPage=' + i + ';loadPosts()">' + i + '</button>';
      } else if (i === data.page - 3 || i === data.page + 3) {
        paginationHtml += '<span style="padding:8px 4px;">...</span>';
      }
    }
    paginationHtml += '<button ' + (data.page >= data.totalPages ? 'disabled' : '') + ' onclick="state.currentPage++;loadPosts()">下一页</button>';
    paginationHtml += '</div>';
  }

  area.innerHTML = html + paginationHtml;
}

function renderSidebar() {
  var el = document.getElementById('sidebarArea');
  if (!el) { return; }

  var createAction = state.currentUser ? 'showCreatePost()' : 'showLogin()';

  var catTags = '';
  Object.keys(categoryMap).forEach(function(key) {
    catTags += '<span class="cat-badge ' + catClassMap[key] + '" style="cursor:pointer;padding:6px 14px;font-size:13px;" onclick="switchCategory(\'' + key + '\',document.querySelector(\'.cat-item[data-cat=\\\'' + key + '\\\']\'))">' + categoryMap[key] + '</span>';
  });

  el.innerHTML = '<div class="sidebar-card">' +
    '<button class="btn-create" onclick="' + createAction + '">✏️ 发布新帖子</button>' +
    '<p style="font-size:12px;color:#999;text-align:center;">分享你的想法、作品和生活</p>' +
    '</div>' +
    '<div class="sidebar-card"><h3>📢 社区分类</h3><div style="display:flex;flex-wrap:wrap;gap:8px;">' + catTags + '</div></div>' +
    '<div class="sidebar-card"><h3>🔥 热门帖子</h3><div id="hotPostsList"><span style="color:#999;font-size:13px;">加载中...</span></div></div>';

  loadHotPosts();
}

async function loadHotPosts() {
  try {
    var data = await api('/api/posts?category=all&page=1&limit=5');
    var list = document.getElementById('hotPostsList');
    if (data.posts && data.posts.length > 0) {
      list.innerHTML = data.posts.map(function(p) {
        return '<div class="hot-post-item" onclick="navigate(\'post\',{id:\'' + p.id + '\'})">' +
          '<span class="hot-title">' + escapeHtml(p.title) + '</span>' +
          '<span class="hot-meta">❤️' + (p.like_count || 0) + ' 💬' + (p.comment_count || 0) + ' · ' + escapeHtml(p.nickname) + '</span></div>';
      }).join('');
    } else {
      list.innerHTML = '<span style="color:#bbb;font-size:12px;">暂无帖子</span>';
    }
  } catch(e) {}
}

// ==================== 发帖弹窗 ====================
var selectedFiles = [];

function showCreatePost() {
  if (!state.currentUser) { return showLogin(); }
  selectedFiles = [];

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'createPostModal';
  overlay.onclick = function(e) { if (e.target === overlay) { overlay.remove(); } };
  overlay.innerHTML = '<div class="modal" style="max-width:640px;">' +
    '<div class="modal-header"><h2>✏️ 发布新帖子</h2><button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">✕</button></div>' +
    '<div class="modal-body">' +
      '<div class="form-group"><label>分类</label><select id="postCategory"><option value="art">🎨 艺术</option><option value="life">🌿 生活</option><option value="academic">📚 学术</option><option value="entertainment">🎮 娱乐</option></select></div>' +
      '<div class="form-group"><label>标题</label><input type="text" id="postTitle" placeholder="请输入标题" maxlength="100"></div>' +
      '<div class="form-group"><label>内容</label><textarea id="postContent" placeholder="分享你的想法..." rows="5"></textarea></div>' +
      '<div class="form-group"><label>上传图片/视频/文件（最多10个）</label>' +
        '<div class="file-upload-area" onclick="document.getElementById(\'postFileInput\').click()">📁 点击选择文件或拖放到这里<br><small>图片会自动压缩，单次总量最大 5MB，最多 10 个</small></div>' +
        '<input type="file" id="postFileInput" multiple accept="*/*" style="display:none;" onchange="handleFileSelect(event)">' +
        '<div class="file-preview" id="filePreview"></div>' +
      '</div>' +
      '<button class="btn-submit" id="submitPostBtn" onclick="submitPost()">发布帖子</button>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);

  var dropArea = overlay.querySelector('.file-upload-area');
  dropArea.addEventListener('dragover', function(e) { e.preventDefault(); dropArea.style.borderColor = '#ff6b35'; });
  dropArea.addEventListener('dragleave', function() { dropArea.style.borderColor = '#d9d9d9'; });
  dropArea.addEventListener('drop', function(e) {
    e.preventDefault();
    dropArea.style.borderColor = '#d9d9d9';
    handleFiles(e.dataTransfer.files);
  });
}

function handleFileSelect(e) {
  handleFiles(e.target.files);
}

// Netlify 函数请求体上限约 6MB，这里按 5MB 控制总量；图片会先自动压缩
var MAX_TOTAL_UPLOAD = 5 * 1024 * 1024;
var MAX_SINGLE_UPLOAD = 5 * 1024 * 1024;

// 把大图压到最长边 1600px 的 JPEG，通常能压到 300KB 以内
function compressImage(file) {
  return new Promise(function(resolve) {
    var isImage = /^image\//.test(file.type);
    if (!isImage || file.type === 'image/gif' || file.type === 'image/svg+xml') { return resolve(file); }
    if (file.size <= 500 * 1024) { return resolve(file); }

    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      try {
        var max = 1600;
        var scale = Math.min(1, max / Math.max(img.width, img.height));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function(blob) {
          URL.revokeObjectURL(url);
          if (!blob || blob.size >= file.size) { return resolve(file); }
          var name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          try {
            resolve(new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }));
          } catch (e) {
            resolve(file);
          }
        }, 'image/jpeg', 0.82);
      } catch (e) {
        URL.revokeObjectURL(url);
        resolve(file);
      }
    };
    img.onerror = function() {
      URL.revokeObjectURL(url);
      resolve(file); // 比如 iPhone 的 HEIC，浏览器解不了就原样上传
    };
    img.src = url;
  });
}

async function handleFiles(files) {
  var maxTotal = 10;
  if (selectedFiles.length + files.length > maxTotal) {
    showToast('最多上传' + maxTotal + '个文件');
    return;
  }
  for (var i = 0; i < files.length; i++) {
    if (selectedFiles.length >= maxTotal) { break; }
    var file = await compressImage(files[i]);
    if (file.size > MAX_SINGLE_UPLOAD) {
      showToast('「' + file.name + '」超过 5MB，请换小一点的文件');
      continue;
    }
    selectedFiles.push(file);
  }
  renderFilePreview();
}

function renderFilePreview() {
  var el = document.getElementById('filePreview');
  if (!el) { return; }
  el.innerHTML = selectedFiles.map(function(f, i) {
    return '<div class="file-preview-item">' + escapeHtml(f.name) + ' (' + formatSize(f.size) + ')' +
      '<button onclick="selectedFiles.splice(' + i + ',1);renderFilePreview()">✕</button></div>';
  }).join('');
}

async function submitPost() {
  var category = document.getElementById('postCategory').value;
  var title = document.getElementById('postTitle').value.trim();
  var content = document.getElementById('postContent').value.trim();

  if (!title) { return showToast('请输入标题'); }
  if (!content) { return showToast('请输入内容'); }

  var totalBytes = selectedFiles.reduce(function(sum, f) { return sum + f.size; }, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD) {
    return showToast('文件总大小超过 5MB，请减少数量或换更小的图片');
  }

  var btn = document.getElementById('submitPostBtn');
  btn.disabled = true;
  btn.textContent = '发布中...';

  var formData = new FormData();
  formData.append('category', category);
  formData.append('title', title);
  formData.append('content', content);
  selectedFiles.forEach(function(f) { formData.append('files', f); });

  try {
    var token = getToken();
    var res = await fetch('/api/post', {
      method: 'POST',
      headers: token ? { 'Authorization': token } : {},
      body: formData
    });
    var data = await res.json();
    if (!res.ok) { throw new Error(data.error); }
    document.getElementById('createPostModal').remove();
    showToast('发布成功！');
    state.currentPage = 1;
    loadPosts();
    renderSidebar();
  } catch(e) {
    showToast(e.message);
    btn.disabled = false;
    btn.textContent = '发布帖子';
  }
}

// ==================== 帖子详情 ====================
async function renderPostDetail(postId) {
  if (!postId) { return renderHome(); }
  state.currentView = 'post';
  state.currentPostId = postId;

  var main = document.getElementById('mainWrap');
  main.innerHTML = '<div class="content-area" id="postDetailArea" style="max-width:800px;margin:0 auto;">' +
    '<div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div></div>';

  try {
    var data = await api('/api/post/' + postId);
    var p = data.post;
    var comments = data.comments || [];
    var isOwner = state.currentUser && state.currentUser.id === p.user_id;

    var imagesHtml = '';
    var images = p.images || [];
    if (images.length > 0) {
      imagesHtml = '<div class="post-detail-images">';
      images.forEach(function(url) {
        var ext = url.split('.').pop().toLowerCase();
        if (['mp4','webm','ogg','mov'].indexOf(ext) !== -1) {
          imagesHtml += '<video src="' + url + '" controls style="max-width:100%;max-height:400px;border-radius:8px;margin-bottom:8px;"></video>';
        } else {
          imagesHtml += '<img src="' + url + '" onclick="showMedia(\'' + url + '\',\'image\')">';
        }
      });
      imagesHtml += '</div>';
    }

    var filesHtml = '';
    var files = p.files || [];
    if (files.length > 0) {
      filesHtml = '<div style="margin-bottom:12px;">';
      files.forEach(function(f) {
        filesHtml += '<a href="' + f.url + '" download="' + escapeHtml(f.name) + '" class="file-tag" style="text-decoration:none;margin:2px;">📎 ' + escapeHtml(f.name) + '</a>';
      });
      filesHtml += '</div>';
    }

    var commentsListHtml = '';
    comments.forEach(function(c) {
      var deleteBtn = '';
      if (state.currentUser && state.currentUser.id === c.user_id) {
        deleteBtn = '<button class="comment-delete" onclick="deleteComment(\'' + c.id + '\')">删除</button>';
      }
      commentsListHtml += '<div class="comment-item" id="comment-' + c.id + '">' +
        '<img src="' + c.avatar + '" class="comment-avatar" onerror="this.src=AVATAR_FALLBACK">' +
        '<div class="comment-body">' +
          '<span class="comment-nickname">' + escapeHtml(c.nickname) + '</span>' +
          '<span class="comment-time">' + formatTime(c.created_at) + '</span>' +
          deleteBtn +
          '<div class="comment-content">' + escapeHtml(c.content) + '</div>' +
        '</div>' +
      '</div>';
    });

    var commentInputHtml = '';
    if (state.currentUser) {
      commentInputHtml = '<div class="comment-input-area">' +
        '<img src="' + state.currentUser.avatar + '" onerror="this.src=AVATAR_FALLBACK">' +
        '<textarea id="commentInput" placeholder="写下你的评论..." rows="1"></textarea>' +
        '<button onclick="submitComment(\'' + p.id + '\')">发送</button>' +
      '</div>';
    } else {
      commentInputHtml = '<div style="text-align:center;padding:16px;color:#999;font-size:14px;">' +
        '<a href="javascript:void(0)" onclick="showLogin()" style="color:#4a90d9;">登录</a>后即可评论</div>';
    }

    var area = document.getElementById('postDetailArea');
    area.innerHTML = '<button onclick="navigate(\'home\')" style="background:none;color:#4a90d9;font-size:14px;margin-bottom:12px;display:inline-block;">← 返回列表</button>' +
      '<div class="post-detail">' +
        '<div class="post-detail-header">' +
          '<img src="' + p.avatar + '" class="post-detail-avatar" onerror="this.src=AVATAR_FALLBACK" style="cursor:pointer;" onclick="navigate(\'profile\',{userId:\'' + p.user_id + '\'})" title="查看用户主页">' +
          '<div>' +
            '<div class="post-detail-nickname" style="cursor:pointer;" onclick="navigate(\'profile\',{userId:\'' + p.user_id + '\'})">' + escapeHtml(p.nickname) + '</div>' +
            '<div class="post-detail-time">' + formatTime(p.created_at) + '</div>' +
          '</div>' +
          '<span class="cat-badge ' + (catClassMap[p.category] || '') + '">' + (categoryMap[p.category] || p.category) + '</span>' +
        '</div>' +
        '<div class="post-detail-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="post-detail-content">' + escapeHtml(p.content) + '</div>' +
        imagesHtml + filesHtml +
        '<div class="post-detail-actions">' +
          '<button class="btn-like ' + (p.userLiked ? 'liked' : '') + '" id="likeBtn" onclick="toggleLike(\'' + p.id + '\')">' +
            (p.userLiked ? '❤️' : '🤍') + ' <span id="likeCount">' + (p.like_count || 0) + '</span>' +
          '</button>' +
          (isOwner ? '<button class="btn-delete" onclick="deletePost(\'' + p.id + '\')">🗑️ 删除</button>' : '') +
          (state.currentUser && !isOwner ? '<button class="btn-chat" onclick="startChat(\'' + p.user_id + '\',\'' + escapeAttr(p.nickname) + '\',\'' + p.avatar + '\')">💬 私聊</button>' : '') +
        '</div>' +
        '<div class="comments-section">' +
          '<h3>💬 评论 (' + comments.length + ')</h3>' +
          commentInputHtml +
          '<div id="commentsList">' + commentsListHtml + '</div>' +
        '</div>' +
      '</div>';

    window.scrollTo(0, 0);
  } catch(e) {
    var area2 = document.getElementById('postDetailArea');
    if (area2) {
      area2.innerHTML = '<div class="empty-state"><div class="empty-icon">😢</div><p>帖子不存在或已被删除</p>' +
        '<button onclick="navigate(\'home\')" style="margin-top:12px;color:#4a90d9;background:none;font-size:14px;">← 返回首页</button></div>';
    }
  }
}

async function toggleLike(postId) {
  if (!state.currentUser) { return showLogin(); }
  try {
    var data = await api('/api/like/' + postId, { method: 'POST' });
    var btn = document.getElementById('likeBtn');
    if (data.liked) {
      btn.className = 'btn-like liked';
      btn.innerHTML = '❤️ <span id="likeCount">' + data.likeCount + '</span>';
    } else {
      btn.className = 'btn-like';
      btn.innerHTML = '🤍 <span id="likeCount">' + data.likeCount + '</span>';
    }
  } catch(e) {}
}

async function deletePost(postId) {
  if (!confirm('确定要删除这个帖子吗？此操作不可撤销。')) { return; }
  try {
    await api('/api/post/' + postId, { method: 'DELETE' });
    showToast('帖子已删除');
    navigate('home');
  } catch(e) {}
}

async function submitComment(postId) {
  var input = document.getElementById('commentInput');
  var content = input.value.trim();
  if (!content) { return; }
  try {
    await api('/api/comment', {
      method: 'POST',
      body: JSON.stringify({ postId: postId, content: content })
    });
    await renderPostDetail(postId);
  } catch(e) {}
}

async function deleteComment(commentId) {
  if (!confirm('确定删除这条评论吗？')) { return; }
  try {
    await api('/api/comment/' + commentId, { method: 'DELETE' });
    await renderPostDetail(state.currentPostId);
  } catch(e) {}
}

// ==================== 用户主页 ====================
async function renderProfile(userId) {
  if (!userId) { return renderHome(); }
  state.currentView = 'profile';

  var main = document.getElementById('mainWrap');
  main.innerHTML = '<div class="content-area" id="profileArea" style="max-width:800px;margin:0 auto;">' +
    '<div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div></div>';

  try {
    var data = await api('/api/user/' + userId);
    var u = data.user;
    var isMe = state.currentUser && state.currentUser.id === userId;

    var editForm = '';
    if (isMe) {
      editForm = '<div class="sidebar-card"><h3>✏️ 编辑资料</h3><div class="edit-profile-form">' +
        '<div class="avatar-upload">' +
          '<img src="' + state.currentUser.avatar + '" id="profileAvatarPreview" onerror="this.src=AVATAR_FALLBACK">' +
          '<label for="avatarFileInput">更换头像</label>' +
          '<input type="file" id="avatarFileInput" accept="image/*" onchange="uploadAvatar()">' +
        '</div>' +
        '<div class="form-group"><label>昵称</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<input type="text" id="editNickname" value="' + escapeHtml(state.currentUser.nickname) + '" maxlength="20" style="flex:1;">' +
            '<button onclick="updateNickname()" style="padding:8px 16px;background:#4a90d9;color:#fff;border-radius:8px;font-size:14px;">保存</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
    }

    var area = document.getElementById('profileArea');
    area.innerHTML = '<button onclick="navigate(\'home\')" style="background:none;color:#4a90d9;font-size:14px;margin-bottom:12px;display:inline-block;">← 返回首页</button>' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;">' +
        '<div style="flex:1;min-width:300px;">' +
          '<div class="user-profile">' +
            '<div class="profile-cover"></div>' +
            '<div class="profile-info">' +
              '<img src="' + u.avatar + '" class="profile-avatar" onerror="this.src=AVATAR_FALLBACK">' +
              '<div>' +
                '<div class="profile-name">' + escapeHtml(u.nickname) + '</div>' +
                '<div class="profile-meta">📝 ' + u.postCount + ' 篇帖子 · 加入于 ' + formatDate(u.created_at) + '</div>' +
              '</div>' +
              (!isMe && state.currentUser ? '<button class="btn-chat" style="margin-left:auto;margin-bottom:8px;" onclick="startChat(\'' + u.id + '\',\'' + escapeAttr(u.nickname) + '\',\'' + u.avatar + '\')">💬 私聊</button>' : '') +
            '</div>' +
            '<div class="profile-body">' +
              '<h3>📝 ' + (isMe ? '我的' : 'TA的') + '帖子</h3>' +
              '<div id="userPostsList"><span style="color:#999;">加载中...</span></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="width:300px;flex-shrink:0;">' +
          editForm +
          (!isMe && state.currentUser ? '<div class="sidebar-card" style="text-align:center;"><p style="margin-bottom:10px;color:#666;">想和 ' + escapeHtml(u.nickname) + ' 交流？</p>' +
            '<button class="btn-create" style="font-size:14px;" onclick="startChat(\'' + u.id + '\',\'' + escapeAttr(u.nickname) + '\',\'' + u.avatar + '\')">💬 发送私信</button></div>' : '') +
        '</div>' +
      '</div>';

    loadUserPosts(userId);
  } catch(e) {
    var area2 = document.getElementById('profileArea');
    if (area2) {
      area2.innerHTML = '<div class="empty-state"><div class="empty-icon">😢</div><p>用户不存在</p>' +
        '<button onclick="navigate(\'home\')" style="margin-top:12px;color:#4a90d9;background:none;font-size:14px;">← 返回首页</button></div>';
    }
  }
}

async function loadUserPosts(userId) {
  try {
    var data = await api('/api/user/' + userId + '/posts');
    var list = document.getElementById('userPostsList');
    if (data.posts && data.posts.length > 0) {
      list.innerHTML = data.posts.map(function(p) {
        return '<div style="padding:10px 0;border-bottom:1px solid #f0f0f0;cursor:pointer;" onclick="navigate(\'post\',{id:\'' + p.id + '\'})">' +
          '<div style="font-weight:500;color:#333;">' + escapeHtml(p.title) + '</div>' +
          '<div style="font-size:12px;color:#999;">' + formatTime(p.created_at) + ' · ❤️' + (p.like_count || 0) + ' · 💬' + (p.comment_count || 0) + '</div>' +
        '</div>';
      }).join('');
    } else {
      list.innerHTML = '<p style="color:#bbb;font-size:14px;">暂无帖子</p>';
    }
  } catch(e) {}
}

async function uploadAvatar() {
  var file = document.getElementById('avatarFileInput').files[0];
  if (!file) { return; }
  var formData = new FormData();
  formData.append('avatar', file);
  try {
    var token = getToken();
    var res = await fetch('/api/user/avatar', {
      method: 'POST',
      headers: token ? { 'Authorization': token } : {},
      body: formData
    });
    var data = await res.json();
    if (!res.ok) { throw new Error(data.error); }
    state.currentUser.avatar = data.avatar;
    document.getElementById('profileAvatarPreview').src = data.avatar + '?t=' + Date.now();
    renderTopbar();
    showToast('头像更新成功！');
  } catch(e) {
    showToast(e.message);
  }
}

async function updateNickname() {
  var nickname = document.getElementById('editNickname').value.trim();
  if (!nickname) { return showToast('昵称不能为空'); }
  try {
    await api('/api/user/nickname', {
      method: 'PUT',
      body: JSON.stringify({ nickname: nickname })
    });
    state.currentUser.nickname = nickname;
    renderTopbar();
    showToast('昵称更新成功！');
  } catch(e) {}
}

// ==================== 私信 ====================
async function renderMessages(chatUserId, chatNickname, chatAvatar) {
  state.currentView = 'messages';
  if (chatUserId) { state.currentChatUserId = chatUserId; }

  var main = document.getElementById('mainWrap');
  main.innerHTML = '<div class="content-area" id="messagesArea" style="max-width:900px;margin:0 auto;">' +
    '<div class="empty-state"><div class="empty-icon">⏳</div><p>加载中...</p></div></div>';

  if (!state.currentUser) {
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">🔒</div><p>请先登录</p>' +
      '<button class="btn-login" onclick="showLogin()" style="margin-top:12px;">登录 / 注册</button></div>';
    return;
  }

  try {
    var data = await api('/api/messages');
    var conversations = data.conversations || [];

    var chatListHtml = '';
    if (conversations.length === 0) {
      chatListHtml = '<div style="text-align:center;padding:40px;color:#bbb;">暂无私信</div>';
    } else {
      conversations.forEach(function(c) {
        var isActive = c.other_id === state.currentChatUserId;
        var badgeHtml = c.unread > 0 ? '<div class="chat-list-badge">' + (c.unread > 99 ? '99+' : c.unread) + '</div>' : '';
        chatListHtml += '<div class="chat-list-item ' + (isActive ? 'active' : '') + '" onclick="openChat(\'' + c.other_id + '\',\'' + escapeAttr(c.nickname) + '\',\'' + c.avatar + '\')">' +
          '<img src="' + c.avatar + '" class="chat-list-avatar" onerror="this.src=AVATAR_FALLBACK">' +
          '<div class="chat-list-info"><div class="chat-list-name">' + escapeHtml(c.nickname) + '</div>' +
          '<div class="chat-list-msg">' + escapeHtml(c.last_message || '') + '</div></div>' +
          badgeHtml +
        '</div>';
      });
    }

    var chatMainHtml = '';
    if (state.currentChatUserId) {
      chatMainHtml = '<div class="empty-state" style="height:100%;"><p>加载中...</p></div>';
    } else {
      chatMainHtml = '<div class="chat-empty">选择左侧对话开始聊天</div>';
    }

    document.getElementById('messagesArea').innerHTML = '<button onclick="navigate(\'home\')" style="background:none;color:#4a90d9;font-size:14px;margin-bottom:12px;display:inline-block;">← 返回首页</button>' +
      '<div class="chat-container">' +
        '<div class="chat-list">' + chatListHtml + '</div>' +
        '<div class="chat-main" id="chatMain">' + chatMainHtml + '</div>' +
      '</div>';

    if (state.currentChatUserId) {
      await loadChatMessages(state.currentChatUserId);
    }
    updateUnreadCount();
  } catch(e) {
    document.getElementById('messagesArea').innerHTML = '<div class="empty-state"><div class="empty-icon">😢</div><p>加载失败</p></div>';
  }
}

function openChat(userId, nickname, avatar) {
  state.currentChatUserId = userId;
  var items = document.querySelectorAll('.chat-list-item');
  items.forEach(function(item) { item.classList.remove('active'); });
  var chatMain = document.getElementById('chatMain');
  if (chatMain) { chatMain.innerHTML = '<div class="empty-state" style="height:100%;"><p>加载中...</p></div>'; }
  loadChatMessages(userId, nickname, avatar);
}

function startChat(userId, nickname, avatar) {
  if (!state.currentUser) { return showLogin(); }
  renderMessages(userId, nickname, avatar);
}

async function loadChatMessages(userId, nickname, avatar) {
  var chatMain = document.getElementById('chatMain');
  if (!chatMain) { return; }

  try {
    var data = await api('/api/messages/' + userId);
    var messages = data.messages || [];

    var otherInfo = { nickname: nickname, avatar: avatar };
    if (messages.length > 0) {
      var lastMsg = messages[0];
      if (lastMsg.from_user_id === userId) {
        otherInfo = { nickname: lastMsg.from_nickname, avatar: lastMsg.from_avatar };
      } else {
        otherInfo = { nickname: lastMsg.to_nickname, avatar: lastMsg.to_avatar };
      }
    }

    var messagesHtml = '';
    if (messages.length === 0) {
      messagesHtml = '<div class="chat-empty" style="flex:1;">暂无消息，发送第一条消息吧！</div>';
    } else {
      messages.forEach(function(m) {
        var isMine = m.from_user_id === state.currentUser.id;
        messagesHtml += '<div class="chat-msg ' + (isMine ? 'mine' : 'other') + '">' +
          escapeHtml(m.content) + '<div class="chat-msg-time">' + formatTime(m.created_at) + '</div></div>';
      });
    }

    chatMain.innerHTML = '<div class="chat-main-header">' +
      '<img src="' + otherInfo.avatar + '" onerror="this.src=AVATAR_FALLBACK">' +
      escapeHtml(otherInfo.nickname) +
      '</div>' +
      '<div class="chat-messages" id="chatMessages">' + messagesHtml + '</div>' +
      '<div class="chat-input-area">' +
        '<input type="text" id="chatMessageInput" placeholder="输入消息..." onkeydown="if(event.key===\'Enter\')sendMessage(\'' + userId + '\')">' +
        '<button onclick="sendMessage(\'' + userId + '\')">发送</button>' +
      '</div>';

    var msgContainer = document.getElementById('chatMessages');
    if (msgContainer) { msgContainer.scrollTop = msgContainer.scrollHeight; }
    updateUnreadCount();
  } catch(e) {
    chatMain.innerHTML = '<div class="chat-empty">加载失败</div>';
  }
}

async function sendMessage(toUserId) {
  var input = document.getElementById('chatMessageInput');
  var content = input.value.trim();
  if (!content) { return; }

  try {
    var data = await api('/api/message', {
      method: 'POST',
      body: JSON.stringify({ toUserId: toUserId, content: content })
    });
    input.value = '';

    var msgContainer = document.getElementById('chatMessages');
    var emptyDiv = msgContainer.querySelector('.chat-empty');
    if (emptyDiv) { emptyDiv.remove(); }

    var msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg mine';
    msgDiv.innerHTML = escapeHtml(content) + '<div class="chat-msg-time">' + formatTime(data.message.created_at) + '</div>';
    msgContainer.appendChild(msgDiv);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  } catch(e) {}
}

// ==================== 搜索 ====================
async function searchPosts() {
  var q = document.getElementById('searchInput').value.trim();
  if (!q) { return; }

  state.currentView = 'search';
  var main = document.getElementById('mainWrap');
  main.innerHTML = '<div class="content-area" id="postsArea" style="max-width:800px;margin:0 auto;">' +
    '<div class="empty-state"><div class="empty-icon">🔍</div><p>搜索中...</p></div></div>';

  var items = document.querySelectorAll('.cat-item');
  items.forEach(function(c) { c.classList.remove('active'); });

  try {
    var data = await api('/api/search?q=' + encodeURIComponent(q) + '&category=' + state.currentCategory);
    var area = document.getElementById('postsArea');
    area.innerHTML = '<button onclick="navigate(\'home\')" style="background:none;color:#4a90d9;font-size:14px;margin-bottom:12px;display:inline-block;">← 返回首页</button>' +
      '<h3 style="margin-bottom:14px;">🔍 搜索"' + escapeHtml(q) + '"的结果 (' + data.posts.length + ')</h3>';

    if (data.posts.length === 0) {
      area.innerHTML += '<div class="empty-state"><div class="empty-icon">📭</div><p>未找到相关帖子</p></div>';
    } else {
      renderPosts({ posts: data.posts, total: data.posts.length, page: 1, totalPages: 1 });
    }
  } catch(e) {
    document.getElementById('postsArea').innerHTML = '<div class="empty-state"><div class="empty-icon">😢</div><p>搜索失败</p></div>';
  }
}

// ==================== 媒体查看器 ====================
function showMedia(url, type) {
  var overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  overlay.onclick = function() { overlay.remove(); };
  if (type === 'video') {
    overlay.innerHTML = '<video src="' + url + '" controls autoplay onclick="event.stopPropagation()"></video>';
  } else {
    overlay.innerHTML = '<img src="' + url + '">';
  }
  document.body.appendChild(overlay);
}

// ==================== 工具函数 ====================
function escapeHtml(str) {
  if (!str) { return ''; }
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  if (!str) { return ''; }
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatTime(dateStr) {
  if (!dateStr) { return ''; }
  var date = new Date(dateStr);
  var now = new Date();
  var diff = now - date;
  if (diff < 60000) { return '刚刚'; }
  if (diff < 3600000) { return Math.floor(diff / 60000) + '分钟前'; }
  if (diff < 86400000) { return Math.floor(diff / 3600000) + '小时前'; }
  if (diff < 604800000) { return Math.floor(diff / 86400000) + '天前'; }
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatDate(dateStr) {
  if (!dateStr) { return ''; }
  var date = new Date(dateStr);
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
}

function formatSize(bytes) {
  if (bytes < 1024) { return bytes + 'B'; }
  if (bytes < 1048576) { return (bytes / 1024).toFixed(1) + 'KB'; }
  if (bytes < 1073741824) { return (bytes / 1048576).toFixed(1) + 'MB'; }
  return (bytes / 1073741824).toFixed(1) + 'GB';
}
// ===== 数据配置 =====
const SECTS = [
  '大唐官府','化生寺','方寸山','女儿村','神木林',
  '天机城','天宫','龙宫','五庄观','普陀山',
  '凌波城','花果山','狮驼岭','魔王寨','阴曹地府',
  '盘丝洞','无底洞','女魃墓','东海渊','九黎城','弥勒山'
];

const MAX_MODULES = 5;
const MAX_ANGER = 150;
const MIN_ANGER = 0;

// 通用愤怒场景按钮配置
const SCENE_GROUPS = [
  {
    label: '增加愤怒',
    btns: [
      { name: '有塔', delta: 24, type: 'increase', icon: '🗼' },
      { name: '召唤宝宝', delta: 8, type: 'increase', icon: '🐾' },
      { name: '毒875', delta: 'poison875', type: 'special', icon: '☠️' },
    ]
  },
  {
    label: '减少愤怒（固定值）',
    btns: [
      { name: '被紧箍咒', delta: -3, type: 'decrease', icon: '💫' },
      { name: '被笑里', delta: -70, type: 'decrease', icon: '😄' },
      { name: '被女儿笑里', delta: -82, type: 'decrease', icon: '💃' },
      { name: '用放下/法放', delta: -24, type: 'decrease', icon: '🌿' },
      { name: '用攻心/破甲/凝滞', delta: -28, type: 'decrease', icon: '⚔️' },
      { name: '用法光/法野/流云/光辉/笑里/野兽', delta: -32, type: 'decrease', icon: '✨' },
      { name: '用弱点/水清', delta: -40, type: 'decrease', icon: '🎯' },
      { name: '用破血/琴音/怒目/破碎', delta: -64, type: 'decrease', icon: '🎵' },
      { name: '用晶清/罗汉/慈航', delta: -120, type: 'decrease', icon: '🌸' },
    ]
  }
];

// ===== 状态管理 =====
let modules = [];
let moduleIdCounter = 0;
let isDark = false;

// ===== 工具函数 =====
function clampAnger(val) {
  if (isNaN(val) || val === null || val === undefined) return 0;
  const n = Math.round(Number(val));
  return Math.max(MIN_ANGER, Math.min(MAX_ANGER, n));
}

/**
 * 根据受击伤害计算本次增加的愤怒值
 * 规则：
 *   ratio < 10%：(damage/totalHp)*100，不足1按1，超过10按10
 *   10% <= ratio < 20%：固定+10
 *   20% <= ratio < 30%：固定+15
 *   30% <= ratio < 50%：固定+25
 *   50% <= ratio < 80%：固定+40
 *   80% <= ratio <= 100%：固定+55
 */
function calcAngerFromDamage(damage, totalHp) {
  if (!totalHp || totalHp <= 0 || damage <= 0) return 0;
  const ratio = damage / totalHp;

  if (ratio < 0.10) {
    // 严格小于10%
    const raw = (damage / totalHp) * 100;
    return Math.min(10, Math.max(1, Math.ceil(raw)));
  } else if (ratio < 0.20) {
    // [10%, 20%)
    return 10;
  } else if (ratio < 0.30) {
    // [20%, 30%)
    return 15;
  } else if (ratio < 0.50) {
    // [30%, 50%)
    return 25;
  } else if (ratio < 0.80) {
    // [50%, 80%)
    return 40;
  } else {
    // [80%, 100%+]
    return 55;
  }
}

// 显示 Toast 提示
function showToast(msg, color) {
  const existing = document.querySelector('.change-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'change-toast';
  toast.style.borderLeftColor = color || 'var(--primary)';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

// ===== 模块渲染 =====
function createModuleHTML(mod) {
  const sectOptions = SECTS.map(s =>
    `<option value="${s}" ${mod.sect === s ? 'selected' : ''}>${s}</option>`
  ).join('');

  const sceneGroupsHTML = SCENE_GROUPS.map(group => `
    <div class="scene-group">
      <div class="scene-group-label">${group.label}</div>
      <div class="scene-btns">
        ${group.btns.map(btn => {
          let deltaText = '';
          if (btn.delta === 'poison875') {
            deltaText = '公式增加';
          } else {
            deltaText = btn.delta > 0 ? `+${btn.delta}` : `${btn.delta}`;
          }
          return `<button class="scene-btn ${btn.type}" data-module="${mod.id}" data-delta="${btn.delta}" title="${btn.name}">
            <span class="btn-name">${btn.icon} ${btn.name}</span>
            <span class="delta">${deltaText}</span>
          </button>`;
        }).join('')}
      </div>
    </div>
  `).join('');

  const angerPct = (mod.anger / MAX_ANGER) * 100;
  // 进度条颜色根据愤怒值变化
  let barClass = 'anger-bar-fill';
  if (mod.anger >= 100) barClass += ' high';
  else if (mod.anger >= 60) barClass += ' mid';

  return `
    <div class="calc-module" id="module-${mod.id}">
      <div class="module-header">
        <div class="module-title-area">
          <div class="module-num">${getModuleIndex(mod.id) + 1}</div>
          <span class="module-sect-name" id="sect-name-${mod.id}">${mod.sect}</span>
          <span class="module-sect-tag">愤怒计算器</span>
        </div>
        <button class="delete-module-btn" data-module="${mod.id}" title="删除此模块">✕</button>
      </div>
      <div class="module-body">

        <!-- 愤怒值显示 -->
        <div class="anger-display">
          <div class="anger-label">⚡ 当前愤怒值</div>
          <div class="anger-value-row">
            <input
              type="number"
              class="anger-input-inline"
              id="anger-${mod.id}"
              value="${mod.anger}"
              min="0"
              max="150"
              data-module="${mod.id}"
            />
            <span class="anger-max">/ 150</span>
          </div>
          <button class="clear-anger-btn" data-module="${mod.id}" title="清空愤怒值">🧹 清空愤怒</button>
          <div class="anger-bar-wrap">
            <div class="${barClass}" id="anger-bar-${mod.id}" style="width:${angerPct}%"></div>
          </div>
          <div class="anger-hint" id="anger-hint-${mod.id}">${getAngerHint(mod.anger)}</div>
        </div>

        <!-- 基础设置 -->
        <div class="form-section">
          <div class="section-title">基础设置</div>
          <div class="form-row">
            <label class="form-label">门派</label>
            <select class="form-select" id="sect-${mod.id}" data-module="${mod.id}">
              ${sectOptions}
            </select>
          </div>
          <div class="form-row">
            <label class="form-label">预估总血量</label>
            <input
              type="number"
              class="form-input"
              id="hp-${mod.id}"
              value="${mod.totalHp > 0 ? mod.totalHp : ''}"
              placeholder="请输入总血量"
              min="1"
              data-module="${mod.id}"
            />
          </div>
        </div>

        <div class="divider"></div>

        <!-- 受击伤害 -->
        <div class="form-section">
          <div class="section-title">受击伤害计算</div>
          <div class="form-row">
            <label class="form-label">受击伤害</label>
            <input
              type="number"
              class="form-input"
              id="damage-${mod.id}"
              value="${mod.damage > 0 ? mod.damage : ''}"
              placeholder="输入受击伤害值"
              min="0"
              data-module="${mod.id}"
            />
            <button class="calc-btn" id="calc-btn-${mod.id}" data-module="${mod.id}">计算愤怒</button>
          </div>
          <div class="damage-hint" id="damage-hint-${mod.id}"></div>
        </div>

        <div class="divider"></div>

        <!-- 通用愤怒场景 -->
        <div class="scene-section">
          <div class="section-title">通用愤怒场景</div>
          <div class="scene-groups">
            ${sceneGroupsHTML}
          </div>
        </div>

      </div>
    </div>
  `;
}

// 根据愤怒值返回状态提示文字
function getAngerHint(anger) {
  if (anger === 0) return '<span class="hint-calm">平静</span>';
  if (anger < 30) return '<span class="hint-low">低愤怒</span>';
  if (anger < 60) return '<span class="hint-mid">中等愤怒</span>';
  if (anger < 100) return '<span class="hint-high">高愤怒</span>';
  if (anger < 150) return '<span class="hint-danger">极高愤怒</span>';
  return '<span class="hint-max">🔥 愤怒满值！</span>';
}

function getModuleIndex(id) {
  return modules.findIndex(m => m.id === id);
}

function renderModules() {
  const container = document.getElementById('modulesContainer');
  const emptyState = document.getElementById('emptyState');
  const addBtn = document.getElementById('addModuleBtn');

  if (modules.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'flex';
  } else {
    emptyState.style.display = 'none';
    container.innerHTML = modules.map(mod => createModuleHTML(mod)).join('');
    bindModuleEvents();
  }

  addBtn.disabled = modules.length >= MAX_MODULES;
  addBtn.title = modules.length >= MAX_MODULES ? `最多添加 ${MAX_MODULES} 个模块` : '';

  // 更新模块计数徽章
  const countEl = document.getElementById('moduleCount');
  if (countEl) {
    countEl.textContent = `${modules.length} / ${MAX_MODULES}`;
    countEl.style.display = modules.length > 0 ? 'inline-flex' : 'none';
  }
}

// 更新愤怒值显示（不重新渲染整个模块）
function updateAngerDisplay(modId, newAnger, direction) {
  const mod = modules.find(m => m.id === modId);
  if (!mod) return;
  mod.anger = clampAnger(newAnger);

  const angerEl = document.getElementById(`anger-${modId}`);
  const barEl = document.getElementById(`anger-bar-${modId}`);
  const hintEl = document.getElementById(`anger-hint-${modId}`);

  if (angerEl) {
    angerEl.value = mod.anger;
    // 触发动画
    angerEl.classList.remove('pulse-up', 'pulse-down');
    void angerEl.offsetWidth; // reflow
    if (direction === 'up') {
      angerEl.classList.add('pulse-up');
    } else {
      angerEl.classList.add('pulse-down');
    }
    setTimeout(() => angerEl.classList.remove('pulse-up', 'pulse-down'), 600);
  }

  if (barEl) {
    barEl.style.width = `${(mod.anger / MAX_ANGER) * 100}%`;
    // 更新进度条颜色类
    barEl.className = 'anger-bar-fill';
    if (mod.anger >= 100) barEl.classList.add('high');
    else if (mod.anger >= 60) barEl.classList.add('mid');
  }

  if (hintEl) {
    hintEl.innerHTML = getAngerHint(mod.anger);
  }
}

// 实时更新伤害提示
function updateDamageHint(modId) {
  const mod = modules.find(m => m.id === modId);
  const hintEl = document.getElementById(`damage-hint-${modId}`);
  if (!mod || !hintEl) return;

  const damage = mod.damage || 0;
  const totalHp = mod.totalHp || 0;

  if (!totalHp || totalHp <= 0 || !damage || damage <= 0) {
    hintEl.innerHTML = '';
    return;
  }

  const ratio = (damage / totalHp) * 100;
  const added = calcAngerFromDamage(damage, totalHp);
  let rangeText = '';
  if (ratio < 10) rangeText = '< 10%';
  else if (ratio < 20) rangeText = '10% ~ 20%';
  else if (ratio < 30) rangeText = '20% ~ 30%';
  else if (ratio < 50) rangeText = '30% ~ 50%';
  else if (ratio < 80) rangeText = '50% ~ 80%';
  else rangeText = '≥ 80%';

  hintEl.innerHTML = `<span class="hint-preview">占血量 <b>${ratio.toFixed(1)}%</b>（${rangeText}），预计增加 <b class="hint-add">+${added}</b> 点愤怒</span>`;
}

// ===== 事件绑定 =====
function bindModuleEvents() {
  // 删除模块
  document.querySelectorAll('.delete-module-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const id = parseInt(this.dataset.module);
      modules = modules.filter(m => m.id !== id);
      renderModules();
      showToast('✅ 已删除模块', '#e63946');
    });
  });

  // 清空愤怒值
  document.querySelectorAll('.clear-anger-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const id = parseInt(this.dataset.module);
      updateAngerDisplay(id, 0, 'down');
      showToast('🧹 愤怒值已清空', '#4895ef');
    });
  });

  // 门派选择
  document.querySelectorAll('.form-select').forEach(sel => {
    sel.addEventListener('change', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (mod) {
        mod.sect = this.value;
        const nameEl = document.getElementById(`sect-name-${id}`);
        if (nameEl) nameEl.textContent = this.value;
      }
    });
  });

  // 总血量输入
  document.querySelectorAll('input[id^="hp-"]').forEach(inp => {
    inp.addEventListener('input', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (mod) {
        mod.totalHp = parseFloat(this.value) || 0;
        updateDamageHint(id);
      }
    });
  });

  // 受击伤害输入 —— 实时更新提示
  document.querySelectorAll('input[id^="damage-"]').forEach(inp => {
    inp.addEventListener('input', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (mod) {
        mod.damage = parseFloat(this.value) || 0;
        updateDamageHint(id);
      }
    });
  });

  // 计算愤怒按钮
  document.querySelectorAll('.calc-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (!mod) return;

      const damage = mod.damage || 0;
      const totalHp = mod.totalHp || 0;

      if (!totalHp || totalHp <= 0) {
        showToast('⚠️ 请先填写预估总血量', '#f4a261');
        document.getElementById(`hp-${id}`)?.focus();
        return;
      }
      if (!damage || damage <= 0) {
        showToast('⚠️ 请先填写受击伤害值', '#f4a261');
        document.getElementById(`damage-${id}`)?.focus();
        return;
      }

      const added = calcAngerFromDamage(damage, totalHp);
      const oldAnger = mod.anger;
      const newAnger = clampAnger(oldAnger + added);
      const ratio = ((damage / totalHp) * 100).toFixed(1);

      updateAngerDisplay(id, newAnger, 'up');
      showToast(`受击 ${damage}（占血量 ${ratio}%），愤怒 +${added}，当前 ${newAnger}`, '#e85d04');
    });
  });

  // 当前愤怒手动输入 —— 实时 clamp 并更新进度条
  document.querySelectorAll('input[id^="anger-"]').forEach(inp => {
    inp.addEventListener('input', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (!mod) return;

      let val = parseInt(this.value);
      if (isNaN(val)) val = 0;

      // 实时 clamp：低于0显示0，高于150显示150
      const clamped = clampAnger(val);
      mod.anger = clamped;

      // 如果输入值超出范围，立即修正显示
      if (val < MIN_ANGER || val > MAX_ANGER) {
        this.value = clamped;
      }

      // 更新进度条和提示
      const barEl = document.getElementById(`anger-bar-${id}`);
      if (barEl) {
        barEl.style.width = `${(clamped / MAX_ANGER) * 100}%`;
        barEl.className = 'anger-bar-fill';
        if (clamped >= 100) barEl.classList.add('high');
        else if (clamped >= 60) barEl.classList.add('mid');
      }
      const hintEl = document.getElementById(`anger-hint-${id}`);
      if (hintEl) hintEl.innerHTML = getAngerHint(clamped);
    });

    inp.addEventListener('blur', function () {
      const id = parseInt(this.dataset.module);
      const mod = modules.find(m => m.id === id);
      if (!mod) return;
      // blur 时确保显示 clamped 值
      this.value = mod.anger;
    });
  });

  // 场景按钮
  document.querySelectorAll('.scene-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const id = parseInt(this.dataset.module);
      const deltaRaw = this.dataset.delta;
      const mod = modules.find(m => m.id === id);
      if (!mod) return;

      let delta = 0;
      let toastMsg = '';
      let direction = 'down';

      if (deltaRaw === 'poison875') {
        // 毒875：增加 (875/预估总血量)*100 的愤怒
        if (!mod.totalHp || mod.totalHp <= 0) {
          showToast('⚠️ 请先填写预估总血量', '#f4a261');
          return;
        }
        const increase = (875 / mod.totalHp) * 100;
        delta = Math.ceil(increase); // 向上取整增加
        const newVal = clampAnger(mod.anger + delta);
        toastMsg = `☠️ 毒875：增加 ${delta} 点（公式值 ${increase.toFixed(2)}），当前 ${newVal}`;
        direction = 'up';
      } else {
        delta = parseInt(deltaRaw);
        const btnName = this.querySelector('.btn-name')?.textContent?.trim() || '';
        const sign = delta > 0 ? '+' : '';
        const newVal = clampAnger(mod.anger + delta);
        toastMsg = `${btnName}：愤怒 ${sign}${delta}，当前 ${newVal}`;
        direction = delta > 0 ? 'up' : 'down';
      }

      const newAnger = clampAnger(mod.anger + delta);
      updateAngerDisplay(id, newAnger, direction);
      showToast(toastMsg, direction === 'up' ? '#e85d04' : '#4895ef');
    });
  });
}

// ===== 添加模块 =====
function addModule() {
  if (modules.length >= MAX_MODULES) {
    showToast(`⚠️ 最多只能添加 ${MAX_MODULES} 个模块`, '#f4a261');
    return;
  }
  moduleIdCounter++;
  modules.push({
    id: moduleIdCounter,
    sect: SECTS[0],
    totalHp: 0,
    anger: 0,
    damage: 0,
  });
  renderModules();
  // 滚动到新模块
  setTimeout(() => {
    const newMod = document.getElementById(`module-${moduleIdCounter}`);
    if (newMod) newMod.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// ===== 主题切换 =====
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (isDark) {
    icon.textContent = '☀️';
    label.textContent = '浅色模式';
  } else {
    icon.textContent = '🌙';
    label.textContent = '深色模式';
  }
  localStorage.setItem('mhxy-theme', isDark ? 'dark' : 'light');
}

// ===== 动态注入计算器 HTML =====
function buildAppHTML() {
  return `
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <div class="header-left">
        <span class="header-icon">🔥</span>
        <h1 class="header-title">梦幻西游 · 愤怒计算器</h1>
      </div>
      <div class="header-right">
        <button class="theme-toggle" id="themeToggle" title="切换主题">
          <span class="theme-icon" id="themeIcon">🌙</span>
          <span id="themeLabel">深色模式</span>
        </button>
        <button class="add-module-btn" id="addModuleBtn">
          <span>＋ 添加模块</span>
          <span class="module-count-badge" id="moduleCount" style="display:none;">0 / 5</span>
        </button>
      </div>
    </header>

    <!-- 模块容器 -->
    <main class="modules-container" id="modulesContainer"></main>

    <!-- 空状态提示 -->
    <div class="empty-state" id="emptyState" style="display:none;">
      <div class="empty-icon">⚔️</div>
      <p>暂无计算器模块</p>
      <p class="empty-sub">点击右上角「添加模块」开始使用</p>
    </div>

    <!-- 底部全局操作区 -->
    <div class="global-actions" id="globalActions">
      <button class="global-wuzhuang-btn" id="globalWuzhuangBtn" title="所有模块愤怒值 +1">
        🌿 有五庄观全体加1愤怒
      </button>
      <button class="global-jingu-btn" id="globalJinguBtn" title="所有模块愤怒值 -3">
        💫 紧箍咒挂满，全减3愤怒
      </button>
    </div>

    <footer>
      <p>由 <a href="https://xymhxy.github.io/home/" style="color: #8A2BE2;" target="_blank">xyanwechat</a> 个人学习使用，请勿用于任何非学习用途</p>
    </footer>
  `;
}

// ===== 计算器初始化（登录成功后调用） =====
function initApp() {
  const appContainer = document.getElementById('appContainer');
  if (!appContainer) return;

  // 注入计算器 HTML
  appContainer.innerHTML = buildAppHTML();
  appContainer.style.display = 'block';

  // 读取主题偏好
  const savedTheme = localStorage.getItem('mhxy-theme');
  if (savedTheme === 'dark') {
    isDark = true;
    document.body.classList.add('dark');
    document.body.classList.remove('light');
    document.getElementById('themeIcon').textContent = '☀️';
    document.getElementById('themeLabel').textContent = '浅色模式';
  }

  // 绑定顶部按钮
  const themeToggleEl = document.getElementById('themeToggle');
  if (themeToggleEl) themeToggleEl.addEventListener('click', toggleTheme);

  const addModuleBtnEl = document.getElementById('addModuleBtn');
  if (addModuleBtnEl) addModuleBtnEl.addEventListener('click', addModule);

  // 底部全局五庄观按钮
  const globalWuzhuangBtn = document.getElementById('globalWuzhuangBtn');
  if (globalWuzhuangBtn) {
    globalWuzhuangBtn.addEventListener('click', function () {
      if (modules.length === 0) {
        showToast('⚠️ 暂无模块，请先添加模块', '#f4a261');
        return;
      }
      modules.forEach(mod => {
        updateAngerDisplay(mod.id, mod.anger + 1, 'up');
      });
      showToast(`🌿 五庄观出现！所有模块愤怒 +1`, '#2dc653');
    });
  }

  // 底部全局紧箍咒按钮
  const globalJinguBtn = document.getElementById('globalJinguBtn');
  if (globalJinguBtn) {
    globalJinguBtn.addEventListener('click', function () {
      if (modules.length === 0) {
        showToast('⚠️ 暂无模块，请先添加模块', '#f4a261');
        return;
      }
      modules.forEach(mod => {
        updateAngerDisplay(mod.id, mod.anger - 3, 'down');
      });
      showToast(`💫 紧箍咒挂满！所有模块愤怒 -3`, '#4895ef');
    });
  }

  // 默认添加1个模块
  addModule();
}

// ===== 登录逻辑 =====
const LOGIN_ACCOUNTS = [
  { user: 'xm',  pass: '666666' },
  { user: 'jie', pass: '111111' },
    { user: 'ceshi', pass: '111111' },
	    { user: 'shui', pass: '111111' },
];
const LOGIN_KEY  = 'mhxy-logged-in';

function initLogin() {
  const overlay = document.getElementById('loginOverlay');
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const submitBtn  = document.getElementById('loginSubmitBtn');
  const errorEl    = document.getElementById('loginError');
  const eyeBtn     = document.getElementById('loginEyeBtn');

  if (!overlay) return;

  // 已登录则直接隐藏遮罩并加载计算器
  if (sessionStorage.getItem(LOGIN_KEY) === '1') {
    overlay.classList.add('hidden');
    initApp();
    return;
  }

  // 显示/隐藏密码
  if (eyeBtn && passwordEl) {
    eyeBtn.addEventListener('click', function () {
      const isText = passwordEl.type === 'text';
      passwordEl.type = isText ? 'password' : 'text';
      eyeBtn.textContent = isText ? '👁' : '🙈';
    });
  }

  // 登录提交
  function doLogin() {
    const user = usernameEl ? usernameEl.value.trim() : '';
    const pass = passwordEl ? passwordEl.value : '';

    if (!user || !pass) {
      showLoginError('账号和密码不能为空');
      return;
    }

    const matched = LOGIN_ACCOUNTS.some(a => a.user === user && a.pass === pass);

    if (matched) {
      // 登录成功：先注入计算器，再淡出遮罩
      errorEl.textContent = '';
      sessionStorage.setItem(LOGIN_KEY, '1');
      initApp(); // 登录成功后才构建计算器
      overlay.style.animation = 'loginOverlayOut 0.45s ease forwards';
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 440);
    } else {
      showLoginError('账号或密码错误！该计算器仅用于个人学习，不涉及游戏数据读取等敏感行为，且不对外开放注册，如确为学习交流，请联系xyanwechat');
      if (usernameEl) usernameEl.classList.add('error');
      if (passwordEl) passwordEl.classList.add('error');
      setTimeout(() => {
        if (usernameEl) usernameEl.classList.remove('error');
        if (passwordEl) passwordEl.classList.remove('error');
      }, 600);
    }
  }

  function showLoginError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.animation = 'none';
      void errorEl.offsetWidth;
      errorEl.style.animation = '';
    }
  }

  if (submitBtn) submitBtn.addEventListener('click', doLogin);

  // 回车键登录
  [usernameEl, passwordEl].forEach(el => {
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') doLogin();
    });
  });

  // 自动聚焦账号输入框
  if (usernameEl) setTimeout(() => usernameEl.focus(), 300);
}

// ===== 页面入口 =====
function init() {
  initLogin();
}

document.addEventListener('DOMContentLoaded', init);

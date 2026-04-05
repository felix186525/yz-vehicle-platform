const apiBase = "/yz-vehicle-platform/api";
const tokenKey = "yzFleetAuthToken";

const state = {
  panel: "dashboard",
  q: "",
  vehicleStatus: "all",
  formType: "",
  editId: "",
  token: localStorage.getItem(tokenKey) || "",
  user: null,
  data: {
    menu: [
      ["dashboard", "运营总览"],
      ["vehicles", "车辆档案"],
      ["drivers", "驾驶员"],
      ["users", "账号管理"],
      ["dispatch", "调度中心"],
      ["safety", "安全生产"],
      ["maintenance", "维保能源"],
    ],
    biz: [
      ["旅游包车", 38],
      ["校车运营", 24],
      ["机场接驳", 18],
      ["政府租赁", 12],
      ["赛事活动", 8],
    ],
    alerts: [],
    eventTimeline: [
      ["06:30", "调度中心完成 126 台增援车辆签到。"],
      ["08:45", "南京南站接驳专线全部到位，GPS 在线率 100%。"],
      ["11:20", "仪征停车摆渡车流高峰，启动第 2 波加车。"],
      ["00:55", "返程客流疏散完成，零投诉零滞留。"],
    ],
    fleet: [],
    vehicles: [],
    drivers: [],
    users: [],
    dispatch: [],
    safety: [],
    maintenance: [],
    energy: [],
    safetyKpis: [],
  },
};

const roleMenus = {
  管理员: ["dashboard", "vehicles", "drivers", "users", "dispatch", "safety", "maintenance"],
  调度员: ["dashboard", "vehicles", "drivers", "dispatch"],
  安全员: ["dashboard", "vehicles", "drivers", "safety"],
  机务员: ["dashboard", "vehicles", "maintenance"],
};

const roleLabels = ["管理员", "调度员", "安全员", "机务员"];

const forms = {
  vehicle: {
    title: "车辆档案",
    key: "vehicles",
    fields: [
      ["plate", "车牌", "text"],
      ["model", "车型", "text"],
      ["seats", "座位", "number"],
      ["status", "状态", "select", ["运营中", "待命", "维保中"]],
      ["biz", "业务类型", "text"],
      ["annual", "年检日期", "date"],
      ["insurance", "保险日期", "date"],
      ["task", "今日任务", "text", [], true],
    ],
  },
  driver: {
    title: "驾驶员",
    key: "drivers",
    fields: [
      ["name", "姓名", "text"],
      ["license", "准驾车型", "text"],
      ["years", "驾龄", "text"],
      ["score", "安全评分", "number"],
      ["shift", "排班", "text"],
      ["expiry", "资质到期", "date"],
      ["mental", "心理测评", "select", ["稳定", "需复测"]],
    ],
  },
  user: {
    title: "账号",
    key: "users",
    fields: [
      ["username", "用户名", "text"],
      ["name", "姓名", "text"],
      ["role", "角色", "select", roleLabels],
      ["password", "密码", "password", [], true],
    ],
  },
  dispatch: {
    title: "派车单",
    key: "dispatch",
    fields: [
      ["code", "派车单号", "text"],
      ["name", "任务名称", "text"],
      ["priority", "优先级", "select", ["高优", "常规"]],
      ["progress", "派发进度", "text"],
      ["owner", "负责人", "text"],
      ["note", "任务说明", "text", [], true],
    ],
  },
  maintenance: {
    title: "维保工单",
    key: "maintenance",
    fields: [
      ["code", "工单编号", "text"],
      ["plate", "车牌", "text"],
      ["kind", "工单类型", "select", ["一级保养", "二级保养", "故障维修", "例检"]],
      ["status", "工单状态", "select", ["待进厂", "进行中", "已完成"]],
      ["planDate", "计划完成", "date"],
      ["note", "工单说明", "text", [], true],
    ],
  },
  energy: {
    title: "能耗记录",
    key: "energy",
    fields: [
      ["plate", "车牌", "text"],
      ["energyType", "能耗类型", "select", ["燃油", "充电"]],
      ["volume", "数量", "number"],
      ["unitPrice", "单价", "number"],
      ["amount", "总金额", "number"],
      ["date", "发生日期", "date"],
      ["note", "备注", "text", [], true],
    ],
  },
  safety: {
    title: "安全事件",
    key: "safety",
    fields: [
      ["title", "事件标题", "text"],
      ["plate", "关联车辆", "text"],
      ["level", "风险等级", "select", ["一般", "较高", "紧急"]],
      ["status", "整改状态", "select", ["待整改", "整改中", "已闭环"]],
      ["date", "发生日期", "date"],
      ["detail", "事件说明", "text", [], true],
    ],
  },
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function badgeClass(level) {
  return level === "danger" ? "badge danger" : level === "warn" ? "badge warn" : "badge";
}

function can(action) {
  return !!(state.user && state.user.permissions && state.user.permissions.indexOf(action) >= 0);
}

function canOpen(type) {
  return can(`${forms[type].key}:write`);
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function request(path, options) {
  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options && options.headers ? options.headers : {}),
    },
  });
  if (resp.status === 401) {
    logout(false);
    throw new Error("登录已失效，请重新登录");
  }
  const text = await resp.text();
  const body = text ? JSON.parse(text) : {};
  if (!resp.ok) throw new Error(body.error || "请求失败");
  return body;
}

function syncDerived() {
  const d = state.data;
  const vehicles = d.vehicles;
  d.fleet = [
    ["运营中", `${vehicles.filter((v) => v.status === "运营中").length} 台`, "badge"],
    ["待命", `${vehicles.filter((v) => v.status === "待命").length} 台`, "badge"],
    ["维保中", `${vehicles.filter((v) => v.status === "维保中").length} 台`, "badge warn"],
    ["应急储备", "4 台", "badge"],
  ];
  const soonVehicles = vehicles
    .filter((v) => v.annual)
    .sort((a, b) => a.annual.localeCompare(b.annual))
    .slice(0, 2)
    .map((v) => [v.plate, `年检日期 ${v.annual}，请提前安排。`, "warn"]);
  const soonDrivers = d.drivers
    .filter((v) => v.expiry)
    .sort((a, b) => a.expiry.localeCompare(b.expiry))
    .slice(0, 2)
    .map((v) => [v.name, `从业资质到期日 ${v.expiry}。`, v.mental === "需复测" ? "danger" : "warn"]);
  const openSafety = d.safety
    .filter((v) => v.status !== "已闭环")
    .slice(0, 2)
    .map((v) => [v.title, `${v.plate || "未关联车辆"} · ${v.status}`, v.level === "紧急" ? "danger" : "warn"]);
  d.alerts = [...openSafety, ...soonVehicles, ...soonDrivers].slice(0, 4);
  d.safetyKpis = [
    ["车辆合规率", "100%"],
    ["安全事件总数", String(d.safety.length)],
    ["待整改事件", String(d.safety.filter((v) => v.status === "待整改").length)],
    ["闭环率", d.safety.length ? `${Math.round((d.safety.filter((v) => v.status === "已闭环").length / d.safety.length) * 100)}%` : "100%"],
  ];
}

function renderMenu() {
  const allowed = roleMenus[state.user ? state.user.role : "管理员"] || roleMenus["管理员"];
  const menu = state.data.menu.filter((item) => allowed.indexOf(item[0]) >= 0);
  if (menu.length && allowed.indexOf(state.panel) === -1) state.panel = menu[0][0];
  $("#menu").innerHTML = menu
    .map(([id, name]) => `<button class="${state.panel === id ? "active" : ""}" data-panel="${id}" type="button">${name}</button>`)
    .join("");
}

function renderMetrics() {
  const d = state.data;
  const metrics = [
    ["在册车辆", String(d.vehicles.length), "实时联动车辆档案"],
    ["今日出车", String(d.vehicles.filter((v) => v.status === "运营中").length), "实时联动车辆状态"],
    ["安全事件", String(d.safety.length), "含待整改与闭环事项"],
    ["能源成本", `${d.energy.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(0)}`, "油电费用累计"],
  ];
  $("#metrics").innerHTML = metrics
    .map(([label, value, tip]) => `<article class="metric"><span class="muted">${label}</span><strong>${value}</strong><small class="muted">${tip}</small></article>`)
    .join("");
}

function renderBars() {
  $("#biz-bars").innerHTML = state.data.biz
    .map(([name, value]) => `<div class="bar-row"><div class="list-item"><strong>${name}</strong><span>${value}%</span></div><div class="bar-track"><div class="bar-fill" style="width:${value}%"></div></div></div>`)
    .join("");
}

function renderList(id, items, mapper) {
  $(id).innerHTML = items.map(mapper).join("");
}

function rowActions(type, id) {
  if (!can(`${forms[type].key}:write`)) return "";
  return `<div class="row-actions"><button class="mini ghost" data-edit="${type}" data-id="${id}" type="button">编辑</button><button class="mini danger-btn" data-del="${type}" data-id="${id}" type="button">删除</button></div>`;
}

function renderActionButtons() {
  $$("[data-open]").forEach((btn) => {
    btn.style.display = canOpen(btn.dataset.open) ? "" : "none";
  });
}

function renderVehicles() {
  const q = state.q.trim();
  const rows = state.data.vehicles.filter((v) => (!q || Object.values(v).join(" ").includes(q)) && (state.vehicleStatus === "all" || v.status === state.vehicleStatus));
  $("#vehicle-rows").innerHTML = rows.map((v) => `<tr><td>${v.plate}</td><td>${v.model}</td><td>${v.seats}</td><td><span class="${badgeClass(v.status === "维保中" ? "warn" : "ok")}">${v.status}</span></td><td>${v.biz}</td><td>${v.annual}</td><td>${v.insurance}</td><td><div>${v.task || "无"}</div>${rowActions("vehicle", v.id)}</td></tr>`).join("") || `<tr><td colspan="8"><div class="empty">暂无符合条件的车辆</div></td></tr>`;
}

function renderDrivers() {
  const q = state.q.trim();
  const rows = state.data.drivers.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#driver-rows").innerHTML = rows.map((v) => `<tr><td>${v.name}</td><td>${v.license}</td><td>${v.years}</td><td>${v.score}</td><td>${v.shift}</td><td>${v.expiry}</td><td><div>${v.mental}</div>${rowActions("driver", v.id)}</td></tr>`).join("") || `<tr><td colspan="7"><div class="empty">暂无符合条件的驾驶员</div></td></tr>`;
}

function renderUsers() {
  const q = state.q.trim();
  const rows = state.data.users.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#user-rows").innerHTML = rows.map((v) => `<tr><td>${v.username}</td><td>${v.name}</td><td>${v.role}</td><td>${(v.permissions || []).join("、") || "无"}</td><td>${rowActions("user", v.id)}</td></tr>`).join("") || `<tr><td colspan="5"><div class="empty">暂无账号</div></td></tr>`;
}

function renderDispatch() {
  const q = state.q.trim();
  $("#dispatch-cards").innerHTML = state.data.dispatch.filter((v) => !q || Object.values(v).join(" ").includes(q)).map((v) => `<article class="dispatch-item"><div><div class="list-item"><strong>${v.code}</strong><span class="${badgeClass(v.priority === "高优" ? "danger" : "ok")}">${v.priority}</span></div><p>${v.name}</p><p>${v.owner}</p><p>${v.note}</p></div><div><strong>${v.progress}</strong>${rowActions("dispatch", v.id)}</div></article>`).join("") || `<div class="empty">暂无符合条件的派车单</div>`;
}

function renderSafety() {
  const q = state.q.trim();
  const rows = state.data.safety.filter((v) => !q || Object.values(v).join(" ").includes(q));
  renderList("#safety-kpis", state.data.safetyKpis, (v) => `<div class="list-item"><strong>${v[0]}</strong><span class="badge">${v[1]}</span></div>`);
  $("#safety-issues").innerHTML = rows.map((v) => `<div class="list-item"><div><strong>${v.title}</strong><p>${v.plate || "未关联车辆"} · ${v.date} · ${v.detail}</p></div><div><span class="${badgeClass(v.level === "紧急" ? "danger" : "warn")}">${v.status}</span>${rowActions("safety", v.id)}</div></div>`).join("") || `<div class="empty">暂无安全事件</div>`;
}

function renderMaintenance() {
  const q = state.q.trim();
  const rows = state.data.maintenance.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#maintenance-list").innerHTML = rows.map((v) => `<div class="list-item"><div><strong>${v.code} / ${v.plate}</strong><p>${v.kind} · ${v.note}</p></div><div><span class="${badgeClass(v.status === "进行中" ? "warn" : "ok")}">${v.status}</span><p>${v.planDate}</p>${rowActions("maintenance", v.id)}</div></div>`).join("") || `<div class="empty">暂无维保工单</div>`;
}

function renderEnergy() {
  const q = state.q.trim();
  const rows = state.data.energy.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#energy-list").innerHTML = rows
    .map((v) => `<div class="list-item"><div><strong>${v.plate}</strong><p>${v.energyType} ${v.volume} · ${v.date}</p></div><div><span class="badge">${Number(v.amount || 0).toFixed(2)} 元</span><p class="muted">${v.note || "无备注"}</p>${rowActions("energy", v.id)}</div></div>`)
    .join("") || `<div class="empty">暂无能耗记录</div>`;
}

function switchPanel(id) {
  state.panel = id;
  renderMenu();
  $$(".panel").forEach((el) => el.classList.toggle("active", el.dataset.panel === id));
  const current = state.data.menu.find(([key]) => key === id);
  $("#page-tag").textContent = current ? current[1] : "平台";
  $("#page-title").textContent = id === "dashboard" ? "今日运营驾驶舱" : current ? current[1] : "平台";
}

function openAlerts() {
  $("#alert-modal").classList.remove("hidden");
  renderList("#modal-body", state.data.alerts, (v) => `<div class="list-item"><div><strong>${v[0]}</strong><p>${v[1]}</p></div><span class="${badgeClass(v[2])}">${v[2] === "danger" ? "紧急" : "提醒"}</span></div>`);
}

function openForm(type, id) {
  state.formType = type;
  state.editId = id || "";
  const cfg = forms[type];
  const item = id ? state.data[cfg.key].find((row) => row.id === id) : {};
  $("#form-title").textContent = `${id ? "编辑" : "新增"}${cfg.title}`;
  $("#entity-form").innerHTML = cfg.fields
    .map(([name, label, kind, options = [], full]) => {
      const value = item && item[name] ? item[name] : "";
      const required = !(type === "user" && name === "password" && id);
      const reqAttr = required ? "required" : "";
      const control = kind === "select"
        ? `<select name="${name}" ${reqAttr}>${options.map((opt) => `<option value="${opt}" ${opt === value ? "selected" : ""}>${opt}</option>`).join("")}</select>`
        : `<input name="${name}" type="${kind}" value="${name === "password" ? "" : value}" ${reqAttr} />`;
      return `<div class="field ${full ? "full" : ""}"><label>${label}</label>${control}</div>`;
    })
    .join("") + `<div class="form-actions"><button class="ghost" id="cancel-form" type="button">取消</button><button type="submit">${id ? "保存修改" : "确认新增"}</button></div>`;
  $("#form-modal").classList.remove("hidden");
}

function closeForm() {
  $("#form-modal").classList.add("hidden");
}

function renderStaticLists() {
  renderBars();
  renderList("#alerts", state.data.alerts, (v) => `<div class="list-item"><div><strong>${v[0]}</strong><p>${v[1]}</p></div><span class="${badgeClass(v[2])}">${v[2] === "danger" ? "紧急" : "提醒"}</span></div>`);
  renderList("#event-timeline", state.data.eventTimeline, (v) => `<div class="timeline-item"><strong>${v[0]}</strong><p>${v[1]}</p></div>`);
  renderList("#fleet-status", state.data.fleet, (v) => `<div class="list-item"><strong>${v[0]}</strong><span class="${v[2]}">${v[1]}</span></div>`);
  renderMaintenance();
  renderEnergy();
  renderSafety();
}

function renderAll() {
  syncDerived();
  renderActionButtons();
  renderStaticLists();
  renderMetrics();
  renderVehicles();
  renderDrivers();
  renderUsers();
  renderDispatch();
}

async function loadBootstrap() {
  const body = await request("/bootstrap");
  state.data.vehicles = body.vehicles || [];
  state.data.drivers = body.drivers || [];
  state.data.users = body.users || [];
  state.data.dispatch = body.dispatch || [];
  state.data.safety = body.safety || [];
  state.data.maintenance = body.maintenance || [];
  state.data.energy = body.energy || [];
  renderAll();
}

async function submitForm(e) {
  e.preventDefault();
  const cfg = forms[state.formType];
  const key = cfg.key;
  const payload = Object.fromEntries(new FormData(e.target).entries());
  if (payload.seats) payload.seats = Number(payload.seats);
  if (payload.score) payload.score = Number(payload.score);
  if (state.formType === "user" && !payload.password) delete payload.password;
  const path = `/${key}${state.editId ? `/${state.editId}` : ""}`;
  const method = state.editId ? "PUT" : "POST";
  const body = await request(path, { method, body: JSON.stringify(payload) });
  const list = state.data[key];
  if (state.editId) {
    const idx = list.findIndex((row) => row.id === body.item.id);
    if (idx >= 0) list[idx] = body.item;
  } else {
    list.unshift(body.item);
  }
  closeForm();
  renderAll();
}

async function removeItem(type, id) {
  const key = forms[type].key;
  await request(`/${key}/${id}`, { method: "DELETE" });
  state.data[key] = state.data[key].filter((row) => row.id !== id);
  renderAll();
}

function setLoggedIn(user) {
  state.user = user;
  $("#user-chip").textContent = `${user.name} / ${user.role}`;
  $("#login-modal").classList.add("hidden");
  $("#login-modal").setAttribute("aria-hidden", "true");
}

function logout(clearRemote) {
  if (clearRemote && state.token) request("/logout", { method: "POST" }).catch(() => {});
  state.token = "";
  state.user = null;
  localStorage.removeItem(tokenKey);
  $("#user-chip").textContent = "未登录";
  $("#login-modal").classList.remove("hidden");
  $("#login-modal").setAttribute("aria-hidden", "false");
}

async function tryResume() {
  if (!state.token) return;
  const body = await request("/me");
  setLoggedIn(body.user);
  await loadBootstrap();
}

async function login(e) {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  try {
    const body = await request("/login", { method: "POST", headers: {}, body: JSON.stringify(payload) });
    state.token = body.token;
    localStorage.setItem(tokenKey, body.token);
    setLoggedIn(body.user);
    $("#login-tip").textContent = "登录成功，正在加载数据...";
    await loadBootstrap();
    $("#login-tip").textContent = "可用账号：admin、dispatch、safety、maintenance；默认密码均为 admin123";
    e.target.reset();
  } catch (err) {
    $("#login-tip").textContent = err.message;
  }
}

function bindEvents() {
  $("#menu").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-panel]");
    if (btn) switchPanel(btn.dataset.panel);
  });
  $("#search").addEventListener("input", (e) => {
    state.q = e.target.value;
    renderVehicles();
    renderDrivers();
    renderUsers();
    renderDispatch();
    renderSafety();
    renderMaintenance();
    renderEnergy();
  });
  $("#vehicle-filter").addEventListener("change", (e) => {
    state.vehicleStatus = e.target.value;
    renderVehicles();
  });
  $("#alert-btn").addEventListener("click", openAlerts);
  $("#close-modal").addEventListener("click", () => $("#alert-modal").classList.add("hidden"));
  $("#logout-btn").addEventListener("click", () => logout(true));
  $("#login-form").addEventListener("submit", login);
  $("#entity-form").addEventListener("submit", submitForm);
  $("#close-form").addEventListener("click", closeForm);
  $("#alert-modal").addEventListener("click", (e) => {
    if (e.target.id === "alert-modal") $("#alert-modal").classList.add("hidden");
  });
  $("#form-modal").addEventListener("click", (e) => {
    if (e.target.id === "form-modal") closeForm();
  });
  document.addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open]");
    const editBtn = e.target.closest("[data-edit]");
    const delBtn = e.target.closest("[data-del]");
    if (openBtn && canOpen(openBtn.dataset.open)) openForm(openBtn.dataset.open);
    if (editBtn && can(`${forms[editBtn.dataset.edit].key}:write`)) openForm(editBtn.dataset.edit, editBtn.dataset.id);
    if (delBtn && can(`${forms[delBtn.dataset.del].key}:write`)) removeItem(delBtn.dataset.del, delBtn.dataset.id);
    if (e.target.id === "cancel-form") closeForm();
  });
}

function init() {
  renderMenu();
  renderAll();
  switchPanel("dashboard");
  bindEvents();
  tryResume().catch(() => {
    $("#login-tip").textContent = "可用账号：admin、dispatch、safety、maintenance；默认密码均为 admin123";
  });
}

init();

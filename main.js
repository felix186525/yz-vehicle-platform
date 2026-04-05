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
      ["finance", "客户结算"],
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
    customers: [],
    contracts: [],
    settlements: [],
    safety: [],
    maintenance: [],
    energy: [],
    safetyKpis: [],
    financeSummary: [],
    financeInsights: [],
    projectSummary: [],
    projectStats: [],
    reportActions: [],
  },
};

const roleMenus = {
  管理员: ["dashboard", "vehicles", "drivers", "users", "dispatch", "finance", "safety", "maintenance"],
  调度员: ["dashboard", "vehicles", "drivers", "dispatch", "finance"],
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
      ["customer", "所属客户", "text"],
      ["project", "项目名称", "text"],
      ["contractCode", "关联合同", "text"],
      ["priority", "优先级", "select", ["高优", "常规"]],
      ["progress", "派发进度", "text"],
      ["settlementStatus", "结算状态", "select", ["待建账", "待回款", "部分回款", "已回款"]],
      ["owner", "负责人", "text"],
      ["note", "任务说明", "text", [], true],
    ],
  },
  customer: {
    title: "客户档案",
    key: "customers",
    fields: [
      ["name", "客户名称", "text"],
      ["category", "客户类型", "select", ["政府单位", "学校", "景区/酒店", "企业客户", "旅行社"]],
      ["contact", "联系人", "text"],
      ["phone", "联系电话", "text"],
      ["creditLevel", "资信等级", "select", ["A", "B", "C"]],
      ["status", "合作状态", "select", ["合作中", "跟进中", "暂停"]],
      ["note", "备注", "text", [], true],
    ],
  },
  contract: {
    title: "合同台账",
    key: "contracts",
    fields: [
      ["code", "合同编号", "text"],
      ["customerName", "客户名称", "text"],
      ["projectName", "项目名称", "text"],
      ["amount", "合同金额", "number"],
      ["startDate", "起始日期", "date"],
      ["endDate", "结束日期", "date"],
      ["status", "合同状态", "select", ["执行中", "待启动", "已到期", "已完成"]],
      ["owner", "商务负责人", "text"],
      ["note", "合同说明", "text", [], true],
    ],
  },
  settlement: {
    title: "结算单",
    key: "settlements",
    fields: [
      ["code", "结算单号", "text"],
      ["contractCode", "合同编号", "text"],
      ["customerName", "客户名称", "text"],
      ["projectName", "项目名称", "text"],
      ["receivable", "应收金额", "number"],
      ["received", "已收金额", "number"],
      ["dueDate", "到期日期", "date"],
      ["status", "回款状态", "select", ["待开票", "待回款", "部分回款", "已回款"]],
      ["note", "结算说明", "text", [], true],
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

function money(value) {
  return `${Number(value || 0).toFixed(2)} 元`;
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
  const contracts = d.contracts;
  const settlements = d.settlements;
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
  const overdueSettlements = settlements
    .filter((v) => v.dueDate && v.status !== "已回款")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 2)
    .map((v) => [v.code, `${v.customerName} · 应收 ${Number(v.receivable || 0).toFixed(0)} 元，${v.dueDate} 到期`, "danger"]);
  const endingContracts = contracts
    .filter((v) => v.endDate && v.status !== "已完成")
    .sort((a, b) => a.endDate.localeCompare(b.endDate))
    .slice(0, 2)
    .map((v) => [v.code, `${v.customerName} · 合同到期日 ${v.endDate}`, "warn"]);
  d.alerts = [...overdueSettlements, ...openSafety, ...endingContracts, ...soonVehicles, ...soonDrivers].slice(0, 4);
  d.safetyKpis = [
    ["车辆合规率", "100%"],
    ["安全事件总数", String(d.safety.length)],
    ["待整改事件", String(d.safety.filter((v) => v.status === "待整改").length)],
    ["闭环率", d.safety.length ? `${Math.round((d.safety.filter((v) => v.status === "已闭环").length / d.safety.length) * 100)}%` : "100%"],
  ];
  const contractAmount = contracts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const receivable = settlements.reduce((sum, item) => sum + Number(item.receivable || 0), 0);
  const received = settlements.reduce((sum, item) => sum + Number(item.received || 0), 0);
  d.financeSummary = [
    ["合作客户", String(d.customers.length), "有效客户档案数"],
    ["合同总额", `${contractAmount.toFixed(0)} 元`, "累计合同台账"],
    ["应收金额", `${receivable.toFixed(0)} 元`, "结算单累计"],
    ["已回款", `${received.toFixed(0)} 元`, "已到账金额"],
  ];
  const customerMap = {};
  contracts.forEach((item) => {
    customerMap[item.customerName] = (customerMap[item.customerName] || 0) + Number(item.amount || 0);
  });
  const projectMap = {};
  settlements.forEach((item) => {
    projectMap[item.projectName] = (projectMap[item.projectName] || 0) + Number(item.receivable || 0);
  });
  const topCustomers = Object.keys(customerMap)
    .sort((a, b) => customerMap[b] - customerMap[a])
    .slice(0, 3)
    .map((name) => [`客户 ${name}`, `${customerMap[name].toFixed(0)} 元`, "badge"]);
  const topProjects = Object.keys(projectMap)
    .sort((a, b) => projectMap[b] - projectMap[a])
    .slice(0, 3)
    .map((name) => [`项目 ${name}`, `${projectMap[name].toFixed(0)} 元`, "badge warn"]);
  d.financeInsights = [...topCustomers, ...topProjects];
  const projects = {};
  d.dispatch.forEach((item) => {
    const key = item.project || item.name;
    if (!projects[key]) {
      projects[key] = {
        projectName: key,
        customerName: item.customer || "未绑定客户",
        orderCount: 0,
        contractAmount: 0,
        receivable: 0,
        received: 0,
      };
    }
    projects[key].orderCount += 1;
  });
  contracts.forEach((item) => {
    const key = item.projectName || item.code;
    if (!projects[key]) {
      projects[key] = {
        projectName: key,
        customerName: item.customerName || "未绑定客户",
        orderCount: 0,
        contractAmount: 0,
        receivable: 0,
        received: 0,
      };
    }
    projects[key].customerName = item.customerName || projects[key].customerName;
    projects[key].contractAmount += Number(item.amount || 0);
  });
  settlements.forEach((item) => {
    const key = item.projectName || item.code;
    if (!projects[key]) {
      projects[key] = {
        projectName: key,
        customerName: item.customerName || "未绑定客户",
        orderCount: 0,
        contractAmount: 0,
        receivable: 0,
        received: 0,
      };
    }
    projects[key].customerName = item.customerName || projects[key].customerName;
    projects[key].receivable += Number(item.receivable || 0);
    projects[key].received += Number(item.received || 0);
  });
  d.projectStats = Object.keys(projects)
    .map((key) => ({
      ...projects[key],
      unreceived: projects[key].receivable - projects[key].received,
    }))
    .sort((a, b) => b.receivable - a.receivable || b.contractAmount - a.contractAmount);
  d.projectSummary = [
    ["经营项目", String(d.projectStats.length), "按项目聚合"],
    ["派车订单", String(d.dispatch.length), "调度任务数量"],
    ["执行中合同", String(contracts.filter((v) => v.status === "执行中").length), "履约中的合同"],
    ["待回款项目", String(d.projectStats.filter((v) => v.unreceived > 0).length), "需持续跟进"],
  ];
  d.reportActions = [
    ["项目经营统计 CSV", "导出项目、订单、收入和回款聚合数据", "project"],
    ["结算回款报表 CSV", "导出结算单与到期回款跟踪数据", "settlement"],
    ["客户合同台账 CSV", "导出客户与合同基础台账", "customer"],
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
    ["待回款", `${(d.settlements.reduce((sum, item) => sum + Number(item.receivable || 0) - Number(item.received || 0), 0)).toFixed(0)}`, "客户结算余额"],
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
  $("#dispatch-cards").innerHTML = state.data.dispatch
    .filter((v) => !q || Object.values(v).join(" ").includes(q))
    .map((v) => `<article class="dispatch-item"><div><div class="list-item"><strong>${v.code}</strong><span class="${badgeClass(v.priority === "高优" ? "danger" : "ok")}">${v.priority}</span></div><p>${v.name}</p><p>${v.customer || "未绑定客户"} / ${v.project || "未命名项目"}</p><p>${v.owner}</p><p>${v.note}</p></div><div><strong>${v.progress}</strong><p>${v.contractCode || "未关联合同"} · ${v.settlementStatus || "待建账"}</p>${rowActions("dispatch", v.id)}</div></article>`)
    .join("") || `<div class="empty">暂无符合条件的派车单</div>`;
}

function renderCustomers() {
  const q = state.q.trim();
  const rows = state.data.customers.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#customer-rows").innerHTML = rows
    .map((v) => `<tr><td><div>${v.name}</div>${rowActions("customer", v.id)}</td><td>${v.category}</td><td>${v.contact}</td><td>${v.phone}</td><td><span class="badge">${v.creditLevel}</span></td><td>${v.status}</td></tr>`)
    .join("") || `<tr><td colspan="6"><div class="empty">暂无客户档案</div></td></tr>`;
}

function renderContracts() {
  const q = state.q.trim();
  const rows = state.data.contracts.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#contract-rows").innerHTML = rows
    .map((v) => `<tr><td><div>${v.code}</div>${rowActions("contract", v.id)}</td><td>${v.customerName}</td><td>${v.projectName}</td><td>${Number(v.amount || 0).toFixed(2)}</td><td><span class="${badgeClass(v.status === "执行中" ? "ok" : v.status === "已完成" ? "ok" : "warn")}">${v.status}</span></td><td>${v.startDate} 至 ${v.endDate}</td></tr>`)
    .join("") || `<tr><td colspan="6"><div class="empty">暂无合同台账</div></td></tr>`;
}

function renderSettlements() {
  const q = state.q.trim();
  const rows = state.data.settlements.filter((v) => !q || Object.values(v).join(" ").includes(q));
  $("#settlement-rows").innerHTML = rows
    .map((v) => `<tr><td><div>${v.code}</div>${rowActions("settlement", v.id)}</td><td>${v.contractCode}</td><td>${v.customerName}</td><td>${v.projectName}</td><td>${Number(v.receivable || 0).toFixed(2)}</td><td>${Number(v.received || 0).toFixed(2)}</td><td><span class="${badgeClass(v.status === "已回款" ? "ok" : "warn")}">${v.status}</span></td><td>${v.dueDate}</td></tr>`)
    .join("") || `<tr><td colspan="8"><div class="empty">暂无结算单</div></td></tr>`;
}

function renderFinance() {
  $("#finance-summary").innerHTML = state.data.financeSummary
    .map(([label, value, tip]) => `<article class="metric"><span class="muted">${label}</span><strong>${value}</strong><small class="muted">${tip}</small></article>`)
    .join("");
  $("#project-summary").innerHTML = state.data.projectSummary
    .map(([label, value, tip]) => `<article class="metric"><span class="muted">${label}</span><strong>${value}</strong><small class="muted">${tip}</small></article>`)
    .join("");
  renderList("#finance-insights", state.data.financeInsights, (v) => `<div class="list-item"><strong>${v[0]}</strong><span class="${v[2]}">${v[1]}</span></div>`);
  $("#project-rows").innerHTML = state.data.projectStats
    .filter((v) => !state.q.trim() || Object.values(v).join(" ").includes(state.q.trim()))
    .map((v) => `<tr><td>${v.projectName}</td><td>${v.customerName}</td><td>${v.orderCount}</td><td>${money(v.contractAmount)}</td><td>${money(v.receivable)}</td><td>${money(v.received)}</td><td><span class="${badgeClass(v.unreceived > 0 ? "warn" : "ok")}">${money(v.unreceived)}</span></td></tr>`)
    .join("") || `<tr><td colspan="7"><div class="empty">暂无项目经营数据</div></td></tr>`;
  renderList("#report-actions", state.data.reportActions, (v) => `<div class="list-item"><div><strong>${v[0]}</strong><p>${v[1]}</p></div><button class="ghost mini" type="button" data-export="${v[2]}">导出</button></div>`);
  renderCustomers();
  renderContracts();
  renderSettlements();
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
      const extraAttr = kind === "number" ? 'step="0.01"' : "";
      const control = kind === "select"
        ? `<select name="${name}" ${reqAttr}>${options.map((opt) => `<option value="${opt}" ${opt === value ? "selected" : ""}>${opt}</option>`).join("")}</select>`
        : `<input name="${name}" type="${kind}" value="${name === "password" ? "" : value}" ${reqAttr} ${extraAttr} />`;
      return `<div class="field ${full ? "full" : ""}"><label>${label}</label>${control}</div>`;
    })
    .join("") + `<div class="form-actions"><button class="ghost" id="cancel-form" type="button">取消</button><button type="submit">${id ? "保存修改" : "确认新增"}</button></div>`;
  $("#form-modal").classList.remove("hidden");
  bindFormAssist(type);
}

function closeForm() {
  $("#form-modal").classList.add("hidden");
}

function bindFormAssist(type) {
  const form = $("#entity-form");
  if (!form) return;
  const calcAmount = () => {
    if (type === "energy") {
      const volume = Number(form.elements.volume && form.elements.volume.value || 0);
      const unitPrice = Number(form.elements.unitPrice && form.elements.unitPrice.value || 0);
      if (form.elements.amount) form.elements.amount.value = volume && unitPrice ? (volume * unitPrice).toFixed(2) : "";
    }
    if (type === "settlement") {
      const receivable = Number(form.elements.receivable && form.elements.receivable.value || 0);
      const received = Number(form.elements.received && form.elements.received.value || 0);
      const statusEl = form.elements.status;
      if (!statusEl) return;
      if (!received) statusEl.value = receivable ? "待回款" : statusEl.value;
      else if (received >= receivable && receivable > 0) statusEl.value = "已回款";
      else if (received > 0 && received < receivable) statusEl.value = "部分回款";
    }
  };
  form.addEventListener("input", calcAmount);
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
  renderFinance();
}

async function loadBootstrap() {
  const body = await request("/bootstrap");
  state.data.vehicles = body.vehicles || [];
  state.data.drivers = body.drivers || [];
  state.data.users = body.users || [];
  state.data.dispatch = body.dispatch || [];
  state.data.customers = body.customers || [];
  state.data.contracts = body.contracts || [];
  state.data.settlements = body.settlements || [];
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
  if (payload.amount) payload.amount = Number(payload.amount);
  if (payload.receivable) payload.receivable = Number(payload.receivable);
  if (payload.received) payload.received = Number(payload.received);
  if (payload.volume) payload.volume = Number(payload.volume);
  if (payload.unitPrice) payload.unitPrice = Number(payload.unitPrice);
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

async function exportReport(kind) {
  const resp = await fetch(`${apiBase}/reports/export?kind=${encodeURIComponent(kind)}`, {
    headers: {
      ...authHeaders(),
    },
  });
  if (resp.status === 401) {
    logout(false);
    throw new Error("登录已失效，请重新登录");
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || "导出失败");
  }
  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const disposition = resp.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  link.href = url;
  link.download = match ? decodeURIComponent(match[1]) : `${kind}-report.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
    $("#login-tip").textContent = "可用账号：admin、dispatch、safety、maintenance；默认密码均为 admin123，测试账号 opsdemo / demo123";
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
    renderFinance();
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
  $("#export-project-report").addEventListener("click", () => exportReport("project").catch((err) => alert(err.message)));
  $("#export-settlement-report").addEventListener("click", () => exportReport("settlement").catch((err) => alert(err.message)));
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
    const exportBtn = e.target.closest("[data-export]");
    if (openBtn && canOpen(openBtn.dataset.open)) openForm(openBtn.dataset.open);
    if (editBtn && can(`${forms[editBtn.dataset.edit].key}:write`)) openForm(editBtn.dataset.edit, editBtn.dataset.id);
    if (delBtn && can(`${forms[delBtn.dataset.del].key}:write`)) removeItem(delBtn.dataset.del, delBtn.dataset.id);
    if (exportBtn) exportReport(exportBtn.dataset.export).catch((err) => alert(err.message));
    if (e.target.id === "cancel-form") closeForm();
  });
}

function init() {
  renderMenu();
  renderAll();
  switchPanel("dashboard");
  bindEvents();
  tryResume().catch(() => {
    $("#login-tip").textContent = "可用账号：admin、dispatch、safety、maintenance；默认密码均为 admin123，测试账号 opsdemo / demo123";
  });
}

init();

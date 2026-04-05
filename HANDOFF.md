# 扬州外事旅游车辆管理平台交接说明

## 项目主仓库

- GitHub: https://github.com/felix186525/yz-vehicle-platform
- 当前主分支: `master`

## 项目目标

这是一个面向扬州市外事旅游汽车有限公司的车辆管理平台，目标是做成一套完整的前后端管理系统，覆盖：

- 登录认证
- 多角色权限
- 账号管理
- 车辆档案
- 驾驶员管理
- 调度派车
- 安全事件
- 维保工单
- 能耗与成本管理

后续继续补齐：

- 客户合同与结算管理
- 项目/订单经营统计
- 报表导出
- 更完整的管理驾驶舱

## 当前已完成内容

已经完成并部署：

- 登录认证
- 多角色权限
- 账号管理
- 车辆档案管理
- 驾驶员管理
- 调度派车管理
- 安全事件管理
- 维保工单管理
- 能耗记录与能源成本管理
- 首页驾驶舱联动指标

## 技术架构

请延续现有技术栈，不要随意重构成新框架：

- 前端：纯 `HTML + CSS + JS` 单页
- 后端：Python 原生 `http.server` 风格 REST API
- 数据库：SQLite
- 部署：nginx + systemd
- 不依赖第三方 Python 包
- 需要兼容服务器上的 Python 3.6/3.7 级别环境

## 代码结构

关键文件：

- `index.html`：前端页面入口
- `main.js`：前端逻辑
- `style.css`：前端样式
- `backend/app.py`：后端 API
- `backend/nginx.conf`：nginx 反向代理配置
- `backend/yz-fleet.service`：systemd 服务配置

## 线上环境

演示地址：

- http://139.224.225.188/yz-vehicle-platform/

服务器：

- `root@139.224.225.188`

部署方式：

- 前端静态文件目录：`/usr/share/nginx/html/yz-vehicle-platform`
- 后端服务目录：`/opt/yz-vehicle-platform/app.py`
- systemd 服务名：`yz-fleet`
- nginx 通过 `/etc/nginx/default.d/yz-vehicle-platform.conf` 反代 `/yz-vehicle-platform/api/`

## 当前账号与角色

已有账号：

- `admin / admin123`
- `dispatch / admin123`
- `safety / admin123`
- `maintenance / admin123`
- `opsdemo / demo123`（测试账号）

权限规则：

- 管理员：全部可写
- 调度员：只能写调度
- 安全员：只能写安全事件
- 机务员：可写车辆、维保、能耗

权限已做成前后端双重控制，继续开发时必须保持这一模型。

## 后端资源现状

目前后端已有这些资源：

- `users`
- `vehicles`
- `drivers`
- `dispatch`
- `maintenance`
- `safety`
- `energy`

接口现状：

- `/api/login`
- `/api/logout`
- `/api/me`
- `/api/bootstrap`
- 各资源支持 `POST / PUT / DELETE`

## 已知重要修复

`energy` 模块曾有 bug：

- `volume / unitPrice / amount` 最初按整数解析，导致 `7.25` 这种值会引起后端崩溃和 nginx `50x`
- 已修复为浮点数解析

后续不要回退这个修复。

## 当前仓库状态

最新已推送提交：

- `2a3c56f feat: add energy and cost management`

## 可能存在的测试数据

线上可能留有测试数据，后续可以视情况清理：

- 测试安全事件：`测试安全事件`
- 测试维保工单：`WBTEST001`、`WBROLE001`
- 测试能耗记录：`苏ENG01`
- 测试账号：`opsdemo`

## 建议下一步开发顺序

请优先继续开发“客户合同与结算管理”模块，建议包括：

- 客户档案
- 合同管理
- 项目/订单归属客户
- 结算单
- 回款状态
- 按客户/项目统计收入
- 与调度/车辆任务形成经营闭环

## 开发要求

- 不要推倒重来
- 保持当前 UI 风格连续
- 保持后端零第三方依赖
- 保持可直接部署到当前服务器
- 每完成一块就本地检查、部署验证、必要时推送 GitHub
- 如果修改了线上服务，记得重启 `yz-fleet`，并验证接口与页面都正常
- 优先做“能用的完整模块”，不要只做静态占位

## Git 要求

- 继续在这个仓库开发：
  - `git@github.com:felix186525/yz-vehicle-platform.git`
- 当前默认远程已经是这个仓库
- 开发完成后提交到 `master` 并推送

## 给下一台 Codex 的一句话

请先拉取当前仓库代码，阅读 `index.html`、`main.js`、`backend/app.py`，然后直接开始实现“客户合同与结算管理”模块。

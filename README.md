# 扬州外事旅游车辆管理平台

轻量前后端一体化原型，已包含：

- 登录认证与多角色权限
- 车辆档案管理
- 驾驶员管理
- 调度派车管理
- 客户合同与结算管理
- 安全事件管理
- 维保工单管理
- 能耗与成本管理
- 账号管理

## 本地结构

- `index.html` 前端入口
- `main.js` 前端逻辑
- `style.css` 前端样式
- `backend/app.py` Python API 服务
- `backend/yz-fleet.service` systemd 服务配置
- `backend/nginx.conf` nginx 反向代理配置

## 新增业务模块

- 客户档案
- 合同台账
- 结算单与回款状态
- 按客户 / 项目汇总收入
- 调度单关联客户、项目、合同与结算状态

## 默认账号

- `admin / admin123`
- `dispatch / admin123`
- `safety / admin123`
- `maintenance / admin123`
- `opsdemo / demo123`

## 本地启动

1. 启动后端 API：

```bash
cd /Users/apple/codex/yz-vehicle-platform/backend
python3 app.py
```

2. 单独提供静态页面时，需要保证前端请求的 `/yz-vehicle-platform/api` 能反向代理到本地 `9001`。

3. 如果只做接口验证，可直接访问：

```bash
curl http://127.0.0.1:9001/health
```

## 注意事项

- 后端仅使用 Python 标准库，兼容 Python 3.6/3.7 风格环境。
- SQLite 数据默认写在项目根目录下的 `data/fleet.db`。
- `energy` 与 `settlement` 金额字段支持小数录入。

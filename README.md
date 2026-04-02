# 扬州外事旅游车辆管理平台

轻量前后端一体化原型，已包含：

- 登录认证与多角色权限
- 车辆档案管理
- 驾驶员管理
- 调度派车管理
- 安全事件管理
- 维保工单管理
- 账号管理

## 本地结构

- `index.html` 前端入口
- `main.js` 前端逻辑
- `style.css` 前端样式
- `backend/app.py` Python API 服务
- `backend/yz-fleet.service` systemd 服务配置
- `backend/nginx.conf` nginx 反向代理配置

## 默认账号

- `admin / admin123`
- `dispatch / admin123`
- `safety / admin123`
- `maintenance / admin123`


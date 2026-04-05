# 发布说明

## 线上环境

- 服务器：`root@139.224.225.188`
- 前端目录：`/usr/share/nginx/html/yz-vehicle-platform`
- 后端目录：`/opt/yz-vehicle-platform`
- systemd 服务：`yz-fleet`
- 线上访问地址：[http://139.224.225.188/yz-vehicle-platform/](http://139.224.225.188/yz-vehicle-platform/)

## 当前检查结果

- SSH 可连接
- `yz-fleet` 当前状态为 `active`
- 线上静态文件和 `app.py` 仍是 2026-04-03 左右的旧版本
- 线上登录返回的管理员权限尚未包含：
  - `customers:write`
  - `contracts:write`
  - `settlements:write`
- 线上新接口 `/yz-vehicle-platform/api/reports/export?kind=project` 当前返回 `404`

这说明线上服务还没有发布本地最新代码。

## 一键发布

在仓库根目录执行：

```bash
cd /Users/apple/codex/yz-vehicle-platform
chmod +x deploy_prod.sh
./deploy_prod.sh
```

## 手工发布步骤

1. 上传前端文件

```bash
scp index.html main.js style.css root@139.224.225.188:/usr/share/nginx/html/yz-vehicle-platform/
```

2. 上传后端文件

```bash
scp backend/app.py root@139.224.225.188:/opt/yz-vehicle-platform/app.py
```

3. 重启后端服务

```bash
ssh root@139.224.225.188 systemctl restart yz-fleet
ssh root@139.224.225.188 systemctl is-active yz-fleet
```

4. 验证页面

```bash
curl -I -s http://139.224.225.188/yz-vehicle-platform/
```

5. 验证登录与新接口

```bash
curl -s -X POST http://139.224.225.188/yz-vehicle-platform/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

拿到 token 后验证：

```bash
curl -i -s 'http://139.224.225.188/yz-vehicle-platform/api/reports/export?kind=project' \
  -H 'Authorization: Bearer <TOKEN>'
```

预期结果：

- 登录返回权限中包含 `customers:write`、`contracts:write`、`settlements:write`
- 导出接口返回 `200 OK`
- 页面中能看到“项目 / 订单经营统计”和导出按钮

## 发布后重点验收

- `admin` 登录后可见“客户结算”中的项目经营统计、导出中心、客户/合同/结算台账
- `dispatch` 登录后可维护调度、客户、合同、结算
- 导出 `project`、`settlement`、`customer` 三类 CSV 正常下载
- 新增或编辑结算单时，回款状态能联动变化

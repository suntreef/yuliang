# 余粮 YULIANG · 个人资产后台

> 家有余粮,心里不慌。

Docker 自托管的多人资产游戏化看板:资产定期总结像"追剧",目标与徽章像"升级打怪",信用卡年费与权益到期像"新剧上线"一样准时提醒。青碧清爽 UI,明暗双主题,手机/平板/桌面同一套单列自适应。

(项目曾用名 AssetFlix,数据结构不变;V1 剧场版界面仍保留在 `/v1`。)

## 快速开始(NAS 直接拉镜像)

镜像发布在 GitHub Container Registry,支持 amd64/arm64,无需本地构建:

```bash
mkdir yuliang && cd yuliang
# 放入 docker-compose.yml(见仓库),然后把其中 OWNER 换成发布者的 GitHub 用户名
docker compose pull
docker compose up -d
```

打开 `http://<NAS_IP>:8080`:

1. 首次进入会要求**创建第一位成员(管理员)** —— 名字必填,密码可选(内网信任环境可免密);
2. 管理员在「设置 → 成员管理」里添加家庭成员,每个成员数据完全隔离;
3. 「财库」添加账户(储蓄/投资/负债等,支持多币种)→ 记录盘点快照;
4. 「财库 → 卡片」添加信用卡(银行、币种、年费、扣费日、免年费条件)与权益(次数/日期/金额型);
5. 每日引擎会自动:抓取汇率、生成提前 30/14/7/1 天的年费与权益提醒、每月 1 日生成上月粮报、评估徽章。

## 在线更新(拉取即升级)

新版本发布后(GitHub Actions 自动构建),NAS 上两条命令:

```bash
docker compose pull && docker compose up -d
```

回滚到指定版本:`docker compose down && docker pull ghcr.io/OWNER/yuliang:sha-xxxxxxx && ...`(镜像带 sha- 短标签)。

数据全部在 `./data/assetflix.db`,升级不动数据;升级前建议用应用内「导出全量备份」兜底一次。

## 本地源码构建(可选)

```bash
docker compose -f docker-compose.dev.yml up -d --build   # 本机构建运行
# 或
server:  cd server && npm install && npm start            # http://localhost:8080
web-v2:  cd web-v2 && npm install && npm run dev          # http://localhost:5173(代理 /api)
```

生产模式:`cd web && npm run build && cd ../web-v2 && npm run build` 后 `npm start`,Fastify 同时托管 `/`(V2)与 `/v1`(V1)。

## 提醒渠道

- **站内**:顶栏 🔔 通知中心(始终可用);
- **Webhook**:设置 → 提醒设置里添加 URL,提醒以 `POST JSON { app, member, source, level, title, body, due_date }` 推送 —— 可直接对接 ntfy / Server酱 / 企业微信 / 钉钉 / 飞书 / Telegram(经网关);
- **Email**:管理员在「设置 → 全局设置」配置 SMTP,成员再添加 Email 渠道。

Webhook 对接示例(以 ntfy 为例):主题 URL `https://ntfy.sh/<你的主题>`,收到的 JSON 可被 ntfy 原生解析标题与正文。

## 数据与备份

- 全部数据在 `./data/assetflix.db`(SQLite,WAL),备份 = 复制文件;
- 设置页「导出全量备份」可导出 JSON(含全部成员,由管理员保管);
- 成员之间数据零互通;管理员只能管理账号,不能查看其他成员的业务数据。

## 本地开发(不用 Docker)

```bash
server:  cd server && npm install && npm start        # http://localhost:8080
web:     cd web && npm install && npm run dev          # http://localhost:5173(代理 /api 到 8080)
```

生产模式:`cd web && npm run build` 后直接 `npm start`,Fastify 会托管 `web/dist`。

## 技术栈

React 18 + Vite + Tailwind CSS v4 · Node.js 22(Fastify,ESM JavaScript)· 内置 `node:sqlite` · 免编译单容器 · amd64/arm64。

需求与设计细节见 [需求文档.md](需求文档.md) 与 [技术方案.md](技术方案.md)。

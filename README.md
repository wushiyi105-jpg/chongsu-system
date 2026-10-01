# 重塑系统 · Chongsu System

> 多维度人生管理系统：把日常碎片（文字 / 链接 / 语音 / 图片）沉淀进「五大支柱」人生目标体系，形成可视化知识脉络。

## ✨ 功能特性

- **五大支柱目标体系**：认知 / 意义 / 能量 / 关系 / 价值，树形层级管理
- **多形态碎片录入**：文字、链接（自动解析）、语音（ASR 转写）、图片（OCR 文字提取）
- **知识图谱可视化**：碎片与目标的关联网络，d3-force 力导向布局
- **标签即目标**：goals 表同时承担标签功能，双向引用
- **存储配额管理**：1GB 图片存储配额，用量实时统计
- **暖纸看板风格 UI**：米白画布 + 白卡发丝边 + 等宽数字 + 极弱阴影
- **移动端优先**：响应式布局，底部 Tab 导航，支持 PWA

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS + d3-force |
| 后端 | NestJS 10 + TypeScript + Drizzle ORM |
| 数据库 | PostgreSQL 15+（JSONB、GIN 索引） |
| 鉴权 | JWT（手机号 + 验证码） |
| 构建 | Vite + Rspack |
| AI 能力 | 语音转写、图片 OCR（基于飞书 / 妙搭插件体系） |
| 三方服务 | TikHub（抖音链接解析，可选） |

## 📁 项目结构

```
chongsu-system/
├── client/                 # 前端 React 应用
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # 通用 / 业务组件
│   │   ├── api/            # 接口请求
│   │   ├── contexts/       # Context 状态
│   │   ├── hooks/          # 自定义 Hooks
│   │   └── utils/          # 工具函数
│   └── public/             # 静态资源
├── server/                 # 后端 NestJS 应用
│   ├── modules/            # 业务模块（auth / goals / fragments / graph ...）
│   ├── common/             # 通用守卫 / 装饰器 / 工具
│   ├── database/           # Drizzle Schema
│   └── capabilities/       # 插件能力配置（需自行配置）
├── shared/                 # 前后端共享类型定义
├── mobile/                 # 移动端 Capacitor 工程（Android 可直接打包，iOS 需 macOS 生成）
├── docs/                   # 文档（含 Android 打包指南）
├── scripts/                # 构建 & 开发脚本
├── package.json
├── .env.example
├── LICENSE
└── README.md
```

## 🚀 本地运行

### 前置要求

- Node.js >= 22.0.0
- PostgreSQL >= 15
- npm 或 pnpm

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入数据库连接、JWT 密钥等
```

### 3. 初始化数据库

```bash
# 建表（推荐使用 drizzle-kit）
npx drizzle-kit push
# 或手动执行 server/database/schema.ts 对应的 DDL
```

### 4. 启动开发服务

```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run dev:client   # 前端: http://localhost:5173
npm run dev:server   # 后端: http://localhost:3000
```

## 🔧 环境变量说明

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | - | ✅ |
| `JWT_SECRET` | JWT 签名密钥（生产环境务必修改） | `chongsu-system-dev-secret-key` | ⚠️ |
| `JWT_EXPIRES_IN` | Token 有效期 | `30d` | - |
| `LOGIN_CODE` | 开发模式万能登录码（留空则关闭） | - | - |
| `TIKHUB_API_KEY` | TikHub API Key（抖音链接解析，可选） | - | - |
| `PORT` | 后端服务端口 | `3000` | - |
| `LOG_DIR` | 日志目录 | `./logs` | - |

> 飞书 / 妙搭插件能力（ASR、OCR）的配置通过平台管理后台完成，不放在环境变量中。参考 `server/capabilities/` 下的配置文件结构，使用时需在平台侧创建对应插件实例。

## 📱 移动端（Android / iOS）

移动端是 Capacitor 套壳工程（`mobile/`）：一个全屏 WebView 加载你自己部署的重塑系统 Web 应用，打包成原生 App。

- **Android**：工程已生成，`cd mobile && npm install && npx cap sync android && cd android && ./gradlew assembleDebug` 即可出包
- **iOS**：需要 macOS + Xcode 生成原生工程（`npx cap add ios`），步骤见 `mobile/README.md`
- **必改配置**：`mobile/capacitor.config.json` 的 `server.url` 和 `www/index.html` 的 `APP_URL` 改成你自己的部署地址，**不要指向他人实例**

## 📦 部署

### 容器化部署

项目基于标准 NestJS + Vite 结构，可直接打包为 Docker 镜像：

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/server/main.js"]
```

### 平台部署

本项目原生支持妙搭（Miaoda）全栈平台一键发布，支持：

- 托管 PostgreSQL 数据库 + 行级权限（RLS）
- 插件能力市场（AI 生文 / 语音转写 / OCR 等）
- 一键发布到线上环境

## 📄 开源协议

MIT License

## 🤝 贡献

欢迎 Issue 和 Pull Request！

## 📮 联系方式

- 项目主页：[GitHub 仓库地址]
- 问题反馈：[Issues]

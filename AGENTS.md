# 重塑系统 · 研发规范

> 多用户人生管理系统：暖纸看板风格

## 产品定位
把日常碎片（文字/链接/语音）沉淀进「五支柱」人生目标体系，形成可视化知识脉络。

## 技术栈
- 前端：React 19 + TypeScript + Tailwind CSS + d3-force
- 后端：NestJS + Drizzle ORM + PostgreSQL
- 鉴权：JWT（手机号+验证码）
- 数据隔离：所有表带 user_id，查询强制过滤

## 视觉系统 · 暖纸看板（Warm Paper Dashboard）

### 设计基调
暖灰白画布托白色圆角面板，发丝级边框 + 近乎不可见投影营造轻盈层次。浅色单主题，信息密度高但留白克制，色彩只做语义信号，点到为止。

### 配色系统
| 角色 | Token | 色值 | 用法 |
|------|-------|------|------|
| 画布 | canvas / bg | #f2f2f0 | 页面最底暖灰白 |
| 面板 | surface | #ffffff | 卡片、侧栏、按钮底 |
| 弱面 | surface-muted | #fafaf9 | KPI 瓦片底、表头、nav hover |
| 边框 | border | #ececea | 发丝级分隔线 |
| 强边框 | border-strong | #e2e2df | 次级按钮描边 |
| 主文字 | text-primary | #0a0a0a | 标题、正文主色 |
| 次文字 | text-secondary | #6b6b6b | 次要信息 |
| 弱文字 | text-tertiary | #9a9a95 | 时间戳、列头、脚注 |
| 健康 | active | #1f8a4c / #e6f4ea | 正常/已完成（绿） |
| 待处理 | pending | #9a7b12 / #fff6d6 | 进行中（琥珀） |
| 特性 | feature | #2f66c9 / #dcebff | 特色/链接（蓝） |
| 缺陷 | danger | #c0392b / #fdecec | 风险/删除（红） |
| 强调 | accent-bg / accent-text | #D8EC9D / #B3D166 | 石灰绿：主按钮底 / KPI数字 |
| 图表绿 | green | #34a853 | 图表主序列 |
| 图表琥珀 | amber | #e8a23a | 图表次序列 |
| 图表红 | red | #d94a3d | 图表风险信号 |

### 五大支柱配色（收敛到语义色）
| 支柱 | key | 对应语义色 |
|------|-----|-----------|
| 认知 | cognition | feature（蓝） |
| 意义 | meaning | amber（琥珀） |
| 能量 | energy | green（绿） |
| 关系 | relation | active（玫红 #d94a3d） |
| 价值 | value | text-primary（靛蓝 #1f3a8a） |

### 字体系统
- **无衬线**：Geist → Inter → system-ui → PingFang SC → Microsoft YaHei → Noto Sans SC
- **等宽**：Geist Mono → JetBrains Mono → ui-monospace
- 所有数字启用 `font-feature-settings: "tnum", "lnum"`（等宽等高）

### 字体层级
| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| h1 | 22px | 600 | 页面主标题 |
| kpi | 28px | 600 | KPI 大数字 |
| cardTitle | 16px | 600 | 卡片标题 |
| brand | 15px | 600 | 品牌名 |
| body | 13px | 400 | 正文/表格 |
| subtitle | 14px | 400 | 副标题 |
| caption | 12px | 400 | 说明/时间 |
| columnLabel | 11px | 500 | 列头（大写+微字距） |

### 形状与圆角
- 卡片/面板：16px (rounded-2xl)
- 瓦片/tab 容器：12px (rounded-xl)
- 控件/按钮/nav：8px (rounded-lg)
- 胶囊/头像：999px (rounded-full)

### 阴影规范
统一极弱投影，禁止加重：
```
box-shadow: 0 1px 2px rgba(10,10,10,.04), 0 1px 1px rgba(10,10,10,.02)
```
浮层/弹窗同档阴影，层次靠 backdrop 遮罩表达。

### 布局规范
- 移动端单列布局，最大宽度 480px 居中
- 画布底 #f2f2f0，内容卡片为白底发丝边
- 底部 TabBar 高度 60px，5 个 Tab：首页/录入/图谱/标签/我的
- 内容区水平间距 16px
- KPI 瓦片：surface-muted 底 + 1px 边 + 12px 圆角
- 状态胶囊：低饱和四色对，前置圆点

### 交互规范
- hover/active：底转 surface-muted，文字转 text-primary
- 过渡时长 0.15s–0.2s
- 主操作按钮石灰绿底深色字，每区至多一个
- 次级按钮白底 + border-strong 描边

### 硬规则
1. 浅色单主题，不输出深色模式
2. 数字必须等宽等高（tnum + lnum）
3. 状态一律低饱和胶囊，禁止高饱和实心徽章
4. 红色仅用于缺陷/风险信号，不作装饰
5. 禁止渐变（图表柱体、tick-rule 虚线纹理除外）
6. 面板阴影统一强度，浮层不得加重投影

## 数据模型

### users
- id (uuid, PK)
- phone (varchar, unique)
- nickname (varchar, nullable)
- _created_at, _updated_at

### goals（目标即标签）
- id (uuid, PK)
- user_id (user_profile, 索引)
- parent_id (uuid, nullable, 自引用)
- pillar (varchar: cognition/meaning/energy/relation/value, 顶层目标必填)
- name (varchar)
- description (text, nullable)
- color (varchar, nullable)
- archived (boolean, default false)
- _created_at, _updated_at

### fragments
- id (uuid, PK)
- user_id (user_profile, 索引)
- type (varchar: text/link/voice)
- content (text)
- raw_url (varchar, nullable)
- title (varchar, nullable)
- summary (text, nullable)
- cover (varchar, nullable)
- _created_at

### fragment_tag_links
- fragment_id (uuid, FK)
- goal_id (uuid, FK)
- PK(fragment_id, goal_id)

## API 设计（核心）

### 公开接口
- POST /api/auth/send-code — 发送验证码（开发模式mock）
- POST /api/auth/login — 验证码登录/注册

### 鉴权接口
- GET /api/me — 当前用户信息
- PATCH /api/me — 更新昵称
- GET /api/goals — 目标树（当前用户）
- POST /api/goals — 创建目标
- GET /api/goals/:id — 目标详情
- PATCH /api/goals/:id — 更新目标
- DELETE /api/goals/:id — 删除目标
- POST /api/goals/merge — 合并标签
- GET /api/fragments — 碎片列表（筛选）
- POST /api/fragments — 创建碎片
- GET /api/fragments/:id — 碎片详情
- PATCH /api/fragments/:id — 更新碎片
- DELETE /api/fragments/:id — 删除碎片
- POST /api/fragments/:id/tags — 批量绑定标签
- DELETE /api/fragments/:id/tags/:goalId — 解绑标签
- POST /api/fragments/parse-link — 解析链接
- GET /api/graph — 图谱数据
- POST /api/export — 导出
- GET /api/dashboard — 首页统计

## 核心约束
1. **数据隔离**：所有 goals/fragments 查询必须带 user_id 过滤，越权返回 404
2. **登录态**：JWT + localStorage 持久化，刷新不丢
3. **标签即目标**：goals 表同时承担标签功能，不单独建 tag 表
4. **开发模式**：验证码由 LOGIN_CODE 环境变量配置（示例 changeme），生产必须改为强密码
5. **视觉风格**：暖纸看板——米白画布 + 白卡发丝边 + 等宽数字 + 极弱阴影

# excalidraw-plus

Excalidraw 增强版 - 在开源白板工具 [Excalidraw](https://excalidraw.com) 基础上，深度集成 **AI 智能绘图助手**、**选区生成代码**、**1:N 会话管理**、**MinIO 多用户存储隔离**、**两级项目分组管理**、**RBAC 权限体系** 及 **只读外链公开分享** 等能力。

---

## ✨ 功能特性

### 1. 🤖 AI 智能绘图与画布上下文感知

* **自然语言绘图**：支持通过自然语言一键生成 Excalidraw 原生矢量图元（矩形、圆形、菱形、文字、线条、箭头），还原经典 Virgil 手绘字体与笔触质感，默认 80% 视野缩放。
* **画布上下文感知与增量编辑**：AI 自动提取当前画板图元快照，智能决策**局部微调（`replace`，如仅缩小时间字体）**或**并排追加（`append`，如右侧追加设置页）**，杜绝误覆盖全图。
* **选区生成前端代码**：圈选画布图元，一键生成高质量 Vue 3 / React (Tailwind CSS) 组件代码并提供弹窗实时预览。
* **多模型与生成控制**：动态拉取 OpenCode 官方模型列表，兼容 OpenAI / Anthropic / Responses 协议；支持思考过程折叠、Token 耗时统计与一键中止（Abort）生成。

### 2. 💬 1:N 会话架构与 Token 隔离

* **草图与对话 1:N 绑定**：每个草图可拥有多个独立对话流，随草图切换自动还原专属历史记录。
* **新建会话重置上下文**：支持在当前草图下一键开启「新会话」，清空历史上下文以从零计算 Token，避免长会话产生冗余费用。

### 3. 👥 RBAC 权限体系与全局路由保护

* **强制登录守卫**：基于 Next.js Middleware 全局拦截未认证请求，未登录强制重定向至 `/login`，支持无状态 HttpOnly JWT 会话。
* **角色与权限控制**：
* **超级管理员 (`admin`)**：拥有系统全部权限，配备专属「成员管理」弹窗，可添加/删除普通成员账号。
* **普通成员 (`user`)**：仅拥有个人项目与草图的增删改查权限，无用户管理权限。
* **安全约束**：系统白名单管控登录；严禁修改或删除 `admin` 账号，禁止新增 `admin` 角色。



### 4. 🗂 两级项目分组与跨项目移动

* **双层折叠抽屉 (`ProjectDrawer`)**：采用「项目分组 (Accordion) $\rightarrow$ 草图 (Item)」扁平结构，支持独立折叠/展开与即时模糊搜索。
* **默认项目初始化**：用户建号后自动分配「默认项目」，新建草图默认归属。
* **草图跨项目移动**：支持在抽屉操作栏将草图秒级转移（Move）至其他项目分组。

### 5. 🔗 只读外链公开分享

* **免登评审视图 (`/share/[boardId]`)**：生成独立只读外链，强制开启 `viewModeEnabled={true}`，隐藏全部编辑与 AI 工具栏，专供外部团队或客户查看与缩放。
* **公共镜像自动同步**：保存草图时自动双写 MinIO 用户私有目录与公共分享镜像。

---

## 🛠 技术栈

| 类别 | 技术选型 |
| --- | --- |
| **前端框架** | [Next.js 14](https://nextjs.org) (App Router, React 18) |
| **白板引擎** | [Excalidraw](https://excalidraw.com) (`@excalidraw/excalidraw`) |
| **AI 驱动** | OpenCode API (DeepSeek-V4, Claude, Qwen, Responses 多端点适配) |
| **对象存储** | [MinIO](https://min.io) / S3 兼容协议 (`minio` SDK) |
| **鉴权与安全** | 原生 Web Crypto JWT + Next.js Middleware + RBAC 角色权限模型 |
| **UI 与样式** | [Tailwind CSS 3](https://tailwindcss.com) + [lucide-react](https://lucide.dev) |
| **开发语言** | [TypeScript 5](https://www.typescriptlang.org) |
| **容器化** | Docker (多阶段轻量构建) + Docker Compose (App + MinIO) |

---

## 📋 环境要求

* [Node.js](https://nodejs.org) ≥ 18.x（推荐 20.x）
* [npm](https://www.npmjs.com) ≥ 9
* [Docker](https://www.docker.com) + [Docker Compose](https://docs.docker.com/compose/)（推荐）
* 有效的 **OpenCode API Key**

---

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install

```

### 2. 配置环境变量

复制配置模板并修改 `.env`：

```bash
cp .env.example .env

```

核心环境变量说明：

| 变量名 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `AI_API_KEY` | ✅ | - | OpenCode API 密钥 |
| `AI_BASE_URL` | ❌ | `[https://opencode.ai/zen/go/v1](https://opencode.ai/zen/go/v1)` | AI 接口端点 |
| `MINIO_ENDPOINT` | ❌ | `minio` (容器内部) / `127.0.0.1` | MinIO 纯域名或 IP（禁止带 `http://`） |
| `MINIO_PORT` | ❌ | `9000` | MinIO S3 API 端口 |
| `MINIO_USE_SSL` | ❌ | `false` | 是否开启 SSL |
| `MINIO_ROOT_USER` | ❌ | `admin_user` | MinIO 管理员账号 |
| `MINIO_ROOT_PASSWORD` | ❌ | `StrongPassword123` | MinIO 管理员密码 |
| `MINIO_BUCKET` | ❌ | `excalidraw-scenes` | 存储桶名称 |
| `ADMIN_USERNAME` | ❌ | `admin` | 系统初始超级管理员账号 |
| `ADMIN_PASSWORD` | ❌ | `admin123` | 系统初始超级管理员密码 |
| `JWT_SECRET` | ❌ | `idle-cat-excalidraw-secret-key-2026` | JWT 签名密钥 |

---

## 🐳 Docker 部署 (推荐)

使用 Docker Compose 一键构建并启动应用与 MinIO 实例：

```bash
docker compose up -d --build

```

### 默认访问入口与凭证

* **Web 工作台**：[http://localhost:3000](http://localhost:3000)
* **初始管理员账号**：`admin`
* **初始管理员密码**：`admin123`


* **MinIO 控制台**：[http://localhost:9001](http://localhost:9001)
* **账号**：`admin_user`
* **密码**：`StrongPassword123`



### 常用容器维护命令

| 命令 | 说明 |
| --- | --- |
| `docker compose up -d` | 后台启动所有服务 |
| `docker compose up -d --build` | 代码变更后重新构建并启动 |
| `docker compose logs -f app` | 跟踪应用服务日志 |
| `docker compose logs -f minio` | 跟踪 MinIO 服务日志 |
| `docker compose down` | 停止并移除容器 |
| `docker compose down -v` | 停止并清空数据卷（**警告：会清除所有 MinIO 数据**） |

---

## 📁 项目结构

```
├── app/
│   ├── api/
│   │   ├── auth/              # 登录鉴权、退出与会话接口
│   │   ├── chat/              # AI 对话、画布快照注入与绘图接口
│   │   ├── generate-code/     # 选区草图转 Vue/React 前端代码
│   │   ├── models/            # 动态拉取可用大模型列表
│   │   ├── projects/          # 用户项目分组 CRUD 接口
│   │   ├── scenes/            # 画板 CRUD 与跨项目移动 (PATCH)
│   │   ├── share/[boardId]/   # 公开只读分享元数据接口
│   │   └── users/             # Admin 专属团队成员管理接口
│   ├── login/                 # 登录页面 (含 Suspense 边界)
│   ├── share/[boardId]/       # 独立只读白板查看端 (viewModeEnabled)
│   ├── globals.css            # 全局样式
│   ├── layout.tsx             # 根布局
│   └── page.tsx               # 主工作区与顶部工具栏
├── components/
│   ├── AiSidebar.tsx          # AI 侧边栏 (1:N 会话、拖拽调宽、生成控制)
│   ├── CodePreviewModal.tsx   # 前端代码生成与实时预览弹窗
│   ├── ExcalidrawWrapper.tsx  # Excalidraw 白板封装 (手绘质感、80% 缩放)
│   ├── ProjectDrawer.tsx      # 双层项目与草图管理抽屉 (分组/搜索/移动)
│   └── UserManagementModal.tsx# Admin 专属团队成员管理弹窗
├── lib/
│   ├── auth.ts                # JWT 编解码与无状态 Cookie 鉴权
│   └── rbac.ts                # 资源权限定义与角色权限映射表
├── middleware.ts              # 全局路由守卫 (未登录拦截与白名单放行)
├── public/                    # 静态资源
├── .env.example               # 环境变量模板
├── Dockerfile                 # 多阶段生产构建 Dockerfile
├── docker-compose.yml         # App + MinIO 编排配置
├── next.config.mjs            # Next.js 配置 (output: standalone)
├── tailwind.config.ts         # Tailwind CSS 配置
└── tsconfig.json              # TypeScript 配置

```

---

## 🔒 存储与多用户架构设计

```text
excalidraw-scenes/ (MinIO Bucket)
├── system/
│   └── users.json                  # 全局团队用户白名单字典
├── users/
│   └── {userId}/                   # 各用户独立隔离空间
│       ├── projects.json           # 个人项目分组列表
│       └── scenes/
│           └── {boardId}.json      # 草图元数据、图元数据与 1:N 会话历史
└── public_shares/
    └── {boardId}.json              # /share/[boardId] 公开只读镜像索引

```

---

## 📝 免责声明

本项目为开源学习与实验性质，请合理使用 AI 能力，遵守各模型服务商的服务条款及相关法律法规。
# excalidraw-plus

Excalidraw 增强版 - 在开源白板工具 [Excalidraw](https://excalidraw.com) 基础上加入 **AI 智能绘图助手**、**MinIO/S3 云端场景存储** 等能力。

## ✨ 功能特性

- **AI 绘图助手**：侧边栏输入自然语言，AI 自动生成 Excalidraw 矢量图形（矩形、椭圆、菱形、文字、线条、箭头），支持聊天与绘图双模式
- **多模型支持**：动态拉取 OpenCode 官方可用模型列表，自动适配 OpenAI / Anthropic / Responses 等不同协议端点
- **云端场景存储**：通过 MinIO (S3 兼容) 保存/加载画布场景数据
- **可拖拽侧边框**：AI 助手侧边栏支持宽度自由调节，并持久化到 localStorage
- **流式生成控制**：支持中止 (Abort) 正在进行的 AI 生成请求

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| **前端框架** | [Next.js 14](https://nextjs.org) (App Router, React 18) |
| **白板引擎** | [Excalidraw](https://excalidraw.com) (`@excalidraw/excalidraw`) |
| **AI 集成** | OpenCode API (OpenAI / Anthropic / Responses 多协议适配) |
| **存储** | MinIO / AWS S3 (`@aws-sdk/client-s3`) |
| **样式** | [Tailwind CSS 3](https://tailwindcss.com) + `clsx` / `tailwind-merge` |
| **UI 图标** | [lucide-react](https://lucide.dev) |
| **语言** | [TypeScript 5](https://www.typescriptlang.org) |
| **容器化** | Docker (多阶段构建) + docker-compose (App + MinIO 编排) |

## 📋 环境要求

- [Node.js](https://nodejs.org) ≥ 18.x（推荐 20.x）
- [npm](https://www.npmjs.com) ≥ 9
- [Docker](https://www.docker.com) + [Docker Compose](https://docs.docker.com/compose/)（可选，用于容器化部署）
- 有效的 **OpenCode API Key**

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制环境变量模板并填入实际值：

```bash
cp .env.example .env.local
```

主要配置项说明：

| 变量 | 必填 | 说明 |
|------|------|------|
| `AI_API_KEY` | ✅ | OpenCode API 密钥 |
| `AI_BASE_URL` | ❌ | OpenCode API 端点（默认 `https://opencode.ai/zen/go/v1`） |
| `MINIO_ENDPOINT` | ❌ | MinIO 服务地址（默认 `http://127.0.0.1:9000`） |
| `MINIO_ACCESS_KEY` | ❌ | MinIO 访问密钥（默认 `admin_user`） |
| `MINIO_SECRET_KEY` | ❌ | MinIO 密钥（默认 `StrongPassword123`） |
| `MINIO_BUCKET` | ❌ | 场景存储桶（默认 `excalidraw-scenes`） |

> **注意**：MinIO 相关配置仅在保存场景到云端时需要。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 即可使用。

## 🐳 Docker 部署

### 使用 Docker Compose（推荐，包含 MinIO）

一条命令启动 App + MinIO 全部服务：

```bash
docker compose up -d
```

- **Web 应用**：http://localhost:3000
- **MinIO 控制台**：http://localhost:9001（默认账号密码见 `.env`）

停止服务：

```bash
docker compose down
```

停止并清除数据卷：

```bash
docker compose down -v
```

查看实时日志：

```bash
docker compose logs -f
```

### 仅构建应用镜像

```bash
docker build -t excalidraw-plus .
```

### 单独运行容器

```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name excalidraw-plus \
  excalidraw-plus
```

## 📦 常用命令

### 本地开发

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run build` | 构建生产版本产物 |
| `npm run start` | 启动生产服务器（需先 build） |

### Docker / Compose

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 后台启动全部服务 |
| `docker compose up -d --build` | 重新构建镜像并启动 |
| `docker compose down` | 停止并移除容器 |
| `docker compose down -v` | 停止并同时清除数据卷（会删除 MinIO 数据） |
| `docker compose logs -f` | 跟踪全部服务日志 |
| `docker compose logs -f app` | 仅跟踪应用日志 |
| `docker compose logs -f minio` | 仅跟踪 MinIO 日志 |
| `docker compose ps` | 查看服务运行状态 |
| `docker compose exec app sh` | 进入应用容器终端 |
| `docker compose exec minio sh` | 进入 MinIO 容器终端 |

## 📁 项目结构

```
├── app/
│   ├── api/
│   │   ├── chat/        # AI 对话/绘图接口（多协议适配）
│   │   ├── models/      # 拉取 OpenCode 可用模型列表
│   │   └── scenes/      # 场景保存到 MinIO/S3
│   ├── globals.css      # 全局样式
│   ├── layout.tsx       # 根布局
│   └── page.tsx         # 主工作区页面
├── components/
│   ├── AiSidebar.tsx        # AI 助手侧边栏（可拖拽宽度）
│   └── ExcalidrawWrapper.tsx # Excalidraw 白板封装
├── public/              # 静态资源
├── .env.example         # 环境变量模板
├── Dockerfile           # 多阶段构建（deps → builder → runner）
├── docker-compose.yml   # App + MinIO + 初始化任务编排
├── next.config.mjs      # Next.js 配置（output: standalone）
├── tailwind.config.ts   # Tailwind CSS 配置
└── tsconfig.json        # TypeScript 配置
```

## 🔒 安全与最佳实践

- `.env` / `.env.local` 等环境变量文件已被 `.gitignore` 忽略，请勿提交到版本库
- Docker 镜像以 **非 root 用户 (nextjs)** 运行生产服务
- `minio_data/` 数据目录已被 `.gitignore` 忽略，需自行做好数据备份
- 生产环境建议通过反向代理 (如 Nginx) 配置 HTTPS

## 📝 免责声明

本项目为学习/实验性质，请合理使用 AI 能力，遵守 [OpenCode](https://opencode.ai) 服务条款及各地区法律法规。
# McD Mate｜麦门宇宙

**今天，你想怎么玩转麦门？**

麦门寻宝局是为预算有限、想省一点决策精力的麦当劳爱好者设计的开源探索体验。保留最初的创意：理解预算、心情和用餐场景，通过官方 MCP 获取真实可用信息，再生成个性化路线、预算挑战和可分享的结果卡。

输入「20 元以内，今天有点累，午餐想吃鸡肉」，确认提取的线索，开启三条路线：稳妥之选、新鲜尝试、预算挑战。网页采用确定性关键词解析和规则推荐，无需额外大模型 API；配套 Agent Skill 由宿主 AI 理解更自由的用户表达、执行 MCP 查询。

独立开发的参赛作品，**非麦当劳官方产品**。称号仅为趣味测试，非官方人格评估。

## 目标用户

适合希望按预算探索餐品的学生和上班族、想减少点餐选择负担的麦当劳爱好者，以及希望在 Codex 等 AI Agent 中使用真实 MCP 数据的 Skill 用户。评审和首次体验者可直接走无需 Token 的演示路径。

## 本地运行

要求 Node.js **20.19+**，推荐当前维护的 Node.js LTS；使用 npm 和仓库锁文件。

```bash
npm ci
npm run dev
```

打开 http://localhost:3000。默认演示模式不需要 Token：选择预算、场景、心情和偏好 → 开始寻宝 → 查看预算进度 → 下载 PNG 或分享卡片。

演示菜单使用虚构名称和固定模拟金额，页面、餐品和图片均标记来源。预算过低会返回空状态，餐品价格不会为了凑预算被修改。每种餐品最多一份、每组最多三件，预算挑战限定当前候选，避免鼓励重复购买。

生产启动：

```bash
npm run build
npm run start
```

## 安全配置官方 MCP

1. 在 [麦当劳 MCP 开放平台](https://open.mcd.cn/mcp) 登录，在控制台激活 Token。
2. 本地复制 `.env.example` 为 `.env.local`。PowerShell：`Copy-Item .env.example .env.local`。
3. 只在本地编辑器里填写 `MCD_MCP_TOKEN`；`MCD_MCP_TIMEOUT_MS` 可留空，默认 15000 毫秒。`MCD_MCP_MAPPING` 也可留空，项目会使用已核对的官方默认适配。重启服务。
4. 选择「使用官方 MCP」，先填写城市和附近地点，选择「到店自取」或「得来速」，点击查询门店并选择一家营业门店。
5. 点击开始寻宝。默认流程按真实 schema 调用 `query-meals`、`query-meal-detail` 和 `calculate-price`；只有官方计价成功且预算内的路线会显示已核验。`MCD_MCP_MAPPING` 仅供未来接口变体的高级覆盖，规则见 [MCP_INTEGRATION.md](./MCP_INTEGRATION.md)。

Token 仅供服务端使用，`.env.local` 已被忽略。不要使用 `NEXT_PUBLIC_` 保存 Token，不要把 Token 粘贴到聊天、代码、日志或 Git 中。网页没有 Token 输入框。此版本的真实查询使用配置者的门店/账号上下文，面向公众部署时需限制真实查询入口访问；演示路径不使用账号数据。

**当前限制：**默认适配已用本地 Token 实际完成 `tools/list`、门店、菜单、餐品详情和计价验证。复杂套餐轮次会跳过，默认特制选项按详情传递；优惠券、外送、团餐和未来预约仍需对应门店上下文。官方 schema 变化时会回退为明确错误，不猜参数。

真实模式失败时显示原因、重试及主动切换演示模式的入口；不会在同一结果里混入模拟餐品。连接成功与价格核验是两个独立状态。真实菜单只代表查询时门店可售情况，不能承诺未来早餐或夜宵时段库存。

## Agent Skill

交付目录为 [skills/mcd-mate/](./skills/mcd-mate/SKILL.md)，包含 YAML frontmatter 的 `SKILL.md` 和 `agents/openai.yaml`，已通过 skill-creator 的 `quick_validate.py`。

按 [Codex 官方 Skills 文档](https://developers.openai.com/codex/skills/)，将整个 `skills/mcd-mate` 目录复制到用户目录 `~/.agents/skills/mcd-mate/`，或项目 `.agents/skills/mcd-mate/`。本仓库的 `skills/` 是分发源目录，安装后由 Codex 发现；若未刷新可重启，随后使用 `$mcd-mate`。先在宿主 Agent 中配置官方 MCP 连接器；[mcp-config.example.json](./mcp-config.example.json) 提供脱敏形状示例，宿主若不支持环境变量插值，应使用它自己的秘密管理方式，不能提交填入 Token 的配置。

使用示例：

```text
使用 $mcd-mate：20 元以内，今天有点累，午餐想吃得满足，喜欢鸡肉。
先查询真实菜单，给我稳妥之选、新鲜尝试、预算挑战，并核验总价。
```

Skill 规定缺失门店上下文先询问、按实际 schema 校验、商品编码来自查询、总价来自 `calculate-price`，并明确处理无 Token、超时和工具缺失。完整示例和娱乐内容标识见 Skill 文件。

## 检查与项目结构

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:mcp
```

浏览器测试使用本机 Chrome，针对生产构建在 3100 端口启动服务，覆盖 1280px 桌面和 390px 手机。需先构建；测试启动的服务使用空 Token。已有 3100 服务时会复用，请确保其处于无 Token 演示环境。格式化：`npm run format`。

当前检查：类型检查与生产构建通过；25 项 Vitest 测试通过，覆盖 JSON/SSE、schema 拒绝、Token 缺失、超时、认证、官方菜单映射、默认特制和计价超预算过滤；4 项浏览器检查通过，包括 PNG 文件签名、空状态与无 Token 状态。另使用本地 Token 实测门店、菜单、详情和 20/30 元组合计价，并在 390px 手机浏览器完成门店选择、三条真实核验路线和 PNG 下载；协议单元测试使用夹具，不混记为线上验证。`npm run test:mcp` 安全读取本地环境，检查官方工具发现与无参数营养列表，不输出 Token 或账号数据。

- `app/`：页面、全局样式、服务端推荐与 MCP API。
- `components/`：手机分享卡和开发者接口核对入口。
- `lib/`：参数校验、线索提取、推荐组合、SDK 适配及返回字段映射。
- `tests/`、`e2e/`：业务、协议及浏览器检查。
- `skills/mcd-mate/`：可分发的 Agent Skill。

## 赛事文件与许可

已核实 [官方赛事 README](https://github.com/M-China/mcd-developer-innovation-challenge) 及 `activityGuidelines.md`。完整规则另外要求 `mcp-config.example.json`，已提供。项目包含 README、原版声明、MCP_INTEGRATION、脱敏配置和源码；GitHub 仓库地址为 https://github.com/rikkely/mcd-mate 。报名 Issue 需由参赛者另行提交；本项目尚未提供 WorkBuddy 上下文材料。

声明来自官方仓库提交 `495df4c681f3e91ef7cf3aab7db734dc88e4097f`，原字节复制，并用 `.gitattributes` 禁用该文件换行转换：

```text
CONTEST_DECLARATION.md SHA-256
CD28101BCB29CC8FB24B372FE91CE6B42C4A1487A54E01F7ADE0C8C6A84241B7
```

项目原创代码采用 [MIT License](./LICENSE)。官方原版参赛声明、麦当劳商标与 MCP 服务权益不属于本项目的许可授权；使用 MCP 遵循其官方服务规则。当前已完成带本地 Token 的 MCP 业务调用核验，发布检查已确认源码和已有 Git 历史不含所配置 Token，`.env.local` 不参与提交。

# GitHub Pages 部署与定时更新

当前网站为纯静态 HTML/CSS/JavaScript，`dist/` 约 328 MiB，包含 8,079 部影片和 8,076 张本地海报，可部署到 GitHub Pages。相对路径支持 `https://用户名.github.io/film-atlas/` 这样的仓库子路径。

## 登录与仓库

1. 在 [GitHub 官方登录页](https://github.com/login)登录，或通过 Codex 的 GitHub 集成完成授权。网页登录本身不会给本地命令行或 Codex 集成授权。
2. 在 [创建仓库页面](https://github.com/new)创建 `film-atlas`。使用 GitHub Free 时选择 **Public**；网站和发布的数据会公开。若要使用私有仓库，请先确认你的 GitHub 套餐支持 Pages。
3. 已创建 `deployment.local.json`，可以填写用户名、仓库地址与可见性；它只是给后续协作使用的目标信息，已被 Git 忽略。无需填写密码、Token 或验证码。文件丢失时可从 `deployment.example.json` 重新复制。
4. 目标仓库为 `https://github.com/linkboyx/film-atlas`。上传的是 `film-atlas/` 这个目录本身，仓库根目录应直接包含 `.github/`、`dist/`、`scripts/` 和 `verify-catalog.mjs`，不要多套一层 `film-atlas/`。

推荐通过 GitHub 集成或 GitHub CLI 的浏览器授权上传。若自行使用已安装的 GitHub CLI，可在此目录运行：

```powershell
.\.tools\github-cli\bin\gh.exe auth login --hostname github.com --web --git-protocol https --scopes workflow
git add .
git commit -m "Prepare Film Atlas for GitHub Pages"
.\.tools\github-cli\bin\gh.exe repo create film-atlas --public --source . --remote origin --push
```

已下载 GitHub 官方 CLI 便携版并核验官方 SHA256，位于 `.tools/github-cli/bin/gh.exe`；不修改全局 PATH。GitHub 集成与本地 CLI 授权相互独立，首次上传还需完成 CLI 的官方设备授权。`workflow` 权限用于上传 `.github/workflows/`。已有仓库则应使用该仓库地址，不要再次创建。同目录的 `.openai/` 为原 Sites 本地配置，不需要上传到 GitHub；`.gitignore` 已排除未跟踪内容。

## 启用 Pages

1. 打开仓库 **Settings → Pages → Build and deployment → Source**，选择 **GitHub Actions**。
2. 确认默认分支为 `main`。如果不同，修改 `.github/workflows/pages.yml` 的 `push.branches`。定时任务只运行默认分支，首次发布也应从默认分支手动启动。
3. 打开 **Actions → Update data and deploy Pages → Run workflow**，选择默认分支并运行。
4. 工作流先测试更新器，下载 IMDb 官方评分，校验完整片库与本地海报，然后只发布 `dist/`。成功后可在 Pages 设置或 deploy 任务中看到实际网站地址。

正常推送到 `main` 也会触发同一流程。若首次运行早于启用 Pages，启用后重新运行即可。手动运行时可以取消 `Refresh IMDb ratings before publishing`，直接发布仓库内已有的数据快照。

## 定时更新的实际范围

默认 `23 14 * * *`：每天 UTC 14:23，即 Phoenix 时间 07:23、北京时间 22:23。在 GitHub 云端运行，无需保持电脑开机。

每次更新读取 IMDb 官方 `title.ratings.tsv.gz`，按 IMDb ID 更新**现有影片**的分数、评价人数和核对日期。IMDb 数据集每日更新，适用其个人及非商业使用条款；部署本身无需 API Key。

- 不自动新增影片，不扩展 1988—2026 年份范围。
- 豆瓣、票房、奖项、人物和海报保持原核对快照；这些内容需要另接可靠数据源及相应更新脚本。若后续数据服务要求密钥，应放在仓库 **Settings → Secrets and variables → Actions**，不能写入网页。
- 初次整理日期保持原值；IMDb 更新日期单独展示，避免把其他资料误标为最新。
- 已入库影片即使最新评分跌破门槛也保留，保存更新前达标的评分和日期作为历史入选依据；当前高分筛选使用最新分数。
- 匹配率低于此前已评分影片的 95%、文件损坏或数据校验失败时停止发布，线上继续保留上一次成功版本。少量未匹配影片保留旧评分及旧日期。
- 云端更新直接进入 Pages 发布产物，**不会回写 Git 仓库**。Git 中的 `catalog.json` 仍为你提交的基准快照；如需将最新结果下载留档，可在本地运行同一更新脚本。
- GitHub 定时任务可能延迟或丢弃，不能用于精确到分钟的保证；公共仓库连续 60 天无活动可能自动停用定时任务，可在 Actions 中重新启用。若长期无人维护并要求稳定准点，应改接独立调度服务。

## 本地检查和更新

需要 Node.js 24 或更高，无第三方依赖。GitHub 工作流会自动配置 Node.js 24。

```powershell
node --test scripts/update-imdb.test.mjs
node verify-catalog.mjs --site-only
node scripts/update-imdb.mjs
node verify-catalog.mjs --site-only
```

也可使用已下载的 IMDb 官方 TSV 文件验证更新：

```powershell
node scripts/update-imdb.mjs --ratings ..\research\imdb-ratings.tsv
```

旧的 `build-expanded-catalog.mjs` 依赖仓库外的研究缓存，**不应在 GitHub 的定时任务里直接运行**。工作流中的 `--site-only` 跳过仓库外研究候选完整性检查，仍检查影片身份、入选依据、评分范围、海报内容、JSON/JS/coverage 三份快照一致性。

## 官方资料

- [使用自定义工作流部署 Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Pages 限制与套餐](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub Actions 定时触发规则](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [IMDb 官方非商业数据集](https://data.imdb.com/non-commercial-datasets/)

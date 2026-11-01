# 上游同步

TGFlow 保留 Telegram Files 的完整提交历史。`upstream` 指向官方，`origin` 指向独立仓库；不能用 force push 覆盖任何长期分支。

```bash
git remote add upstream https://github.com/jarvis2f/telegram-files.git
git remote -v
git fetch upstream
```

已有 upstream 时不重复添加。请在官方 Releases 中确认稳定版本，不直接把未验证的 dev 或任意新提交合并进稳定版。

## main 的同步 PR

在工作区干净时运行：

```bash
./scripts/sync-upstream.sh <稳定版本号>
```

脚本获取指定标签的实际 Commit，从 `origin/main` 建立临时 `sync/upstream-版本号` 分支，以非快进合并保留上游历史，并更新 `UPSTREAM.json`。如果版本已包含在 main 中则退出。如果合并冲突则停在冲突状态，先手动解决，再更新来源记录。

审查顺序：

1. 阅读上游变更及迁移说明，确认数据库、API、会话和 TDLib 兼容性。
2. 保留 TGFlow 品牌、`web/src/locales/`、默认中文与语言入口。
3. 为新增界面文字补充两套资源，检查动态提示及移动端。
4. 保留分支到镜像标签的固定对应关系；不要恢复上游 GHCR 发布流程覆盖 TGFlow 工作流。
5. 运行 `web` 下的 `npm run check`、`npm run test:e2e`、`npm run build`，以及 API 测试和 Docker 检查。
6. 更新 README 基线及 `UPSTREAM.json`，提交并推送临时分支，再向 main 创建 PR。

```bash
git add <本次同步的文件>
git commit -m "chore: sync Telegram Files <版本号>"
git push -u origin HEAD
gh pr create --base main --fill
```

PR 验证通过后再合并 main。发布工作流复用同一组通过验证的构建产物，推送 latest。不要通过自动定时同步直接改动 main。

## main 到 dev

main 验证及发布正常后：

```bash
git fetch origin
git switch dev
git merge --ff-only origin/dev
git merge --no-ff origin/main
# 检查冲突、完成验证后：
git push origin dev
```

dev 的定制功能保留在 dev。合并冲突应逐项处理，不使用整目录覆盖；也不通过 `reset --hard` 和强推替换历史。临时同步分支合并后可删除，长期只维护 main/dev。

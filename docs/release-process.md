# Dayflow 发布与版本管理

## 版本规则

使用语义化版本：`主版本.次版本.修订版本`。

- 修订版本：问题修复，例如 `0.1.1`
- 次版本：向后兼容的新功能，例如 `0.2.0`
- 主版本：不兼容的重大调整，例如 `1.0.0`

`package.json` 和 `src-tauri/tauri.conf.json` 的版本必须保持一致。

## Git 工作流

- `main`：稳定、可发布版本。
- `codex/feature-*`：单项功能开发。
- 每个功能完成后通过 Pull Request 合并到 `main`。
- 为每次可发布构建创建 Git 标签，例如 `v0.1.0`。

## GitHub Releases 与自动更新

Tauri 的更新器需要一个签名公钥、私钥环境变量，以及 GitHub Release 中的签名安装包和 `latest.json`。

1. 生成并妥善保存 Tauri 签名密钥；私钥只保存到 GitHub Actions Secret `TAURI_SIGNING_PRIVATE_KEY`。
2. 将公钥写入 Tauri updater 插件配置。
3. 推送 `v*` 标签时，由 GitHub Actions 构建 NSIS `.exe`，上传安装包、签名和 `latest.json`。
4. 应用设置页显示当前版本；检查更新时读取 GitHub Releases 的更新元数据。

发布前需在真实 Windows 环境执行 `npm run tauri build`，并验证安装、升级、卸载和本地 SQLite 数据保留。


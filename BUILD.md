# 构建和打包指南

## 快速开始

使用 Makefile 命令轻松构建和打包扩展：

```bash
# 查看所有可用命令
make help

# 创建 VSIX 包（一键完成所有步骤）
make vsix
```

## 详细命令说明

### 1. 安装依赖
```bash
make install
```
- 安装 npm 依赖
- 自动检查并安装 `vsce` (Visual Studio Code Extension CLI)

### 2. 开发构建
```bash
make build
```
- 编译 TypeScript 代码
- 生成开发版本（包含 source maps）

### 3. 生产构建
```bash
make package
```
- 使用 webpack 打包
- 代码压缩和优化
- 生成生产版本

### 4. 创建 VSIX 包 ⭐
```bash
make vsix
```
这是**推荐的打包命令**，会自动执行以下步骤：
1. 清理之前的构建文件
2. 安装依赖（如需要）
3. 生产构建
4. 创建 VSIX 包文件

VSIX 文件将保存在 `./dist/` 目录下，文件名格式：
```
behave-vsc-<version>.vsix
```

### 5. 运行测试
```bash
make test
```
- 运行所有集成测试
- 验证扩展功能

### 6. 清理构建
```bash
make clean
```
- 删除 `out/` 和 `dist/` 目录
- 删除所有 VSIX 文件

## 安装 VSIX 包

创建 VSIX 包后，有两种安装方式：

### 方式 1: 通过命令行安装
```bash
code --install-extension ./dist/behave-vsc-<version>.vsix
```

### 方式 2: 通过 VS Code 界面安装
1. 打开 VS Code
2. 进入扩展视图 (Cmd/Ctrl+Shift+X)
3. 点击 "..." 菜单
4. 选择 "Install from VSIX..."
5. 选择 `./dist/` 目录下的 VSIX 文件

## 前置要求

- **Node.js**: >= 17.x
- **npm**: 最新版本
- **vsce**: 会自动安装（如果缺失）

检查版本：
```bash
node --version
npm --version
```

## 开发工作流

### 日常开发
```bash
# 启动监听模式，文件改动时自动编译
npm run watch
```

### 测试前
```bash
# 编译代码和测试
npm run pretest

# 运行测试
make test
```

### 发布前
```bash
# 1. 更新版本号（在 package.json 中）
# 2. 更新 CHANGELOG.md
# 3. 提交所有更改
git add .
git commit -m "Release v<version>"

# 4. 创建 VSIX 包
make vsix

# 5. 测试 VSIX 包
code --install-extension ./dist/behave-vsc-<version>.vsix

# 6. 如果一切正常，打标签并推送
git tag v<version>
git push origin main --tags
```

## 常见问题

### Q: vsce 命令未找到
A: 运行 `make install` 会自动安装 vsce。或手动安装：
```bash
npm install -g @vscode/vsce
```

### Q: 构建失败
A: 尝试清理并重新构建：
```bash
make clean
make vsix
```

### Q: VSIX 包太大
A: 确保 `.vscodeignore` 文件正确配置，排除不需要的文件：
- `src/**` (源代码，只需要编译后的 dist/)
- `node_modules/**` (会自动处理依赖)
- `.git/**`
- 测试文件

### Q: 如何修改版本号
A: 编辑 `package.json` 中的 `version` 字段：
```json
{
  "version": "0.6.5"
}
```

## 最新修改内容

本次修改解决了 print() 输出不显示的问题：

1. **添加 PYTHONUNBUFFERED 环境变量** - 禁用 Python 输出缓冲
2. **改进 ANSI 转义序列清理** - 正确清理所有颜色代码
3. **设置流编码** - 确保 UTF-8 编码处理

详见 `test-print-output.md` 文档。

# 插件设置中心（Plugin settings hub）

把各插件自己的设置页集中到 **设置 → 内置插件** 里，左侧设置导航只保留一个插件入口。

## 做了什么

- 在「内置插件」页新增 **插件设置** 标签页，并且是打开该页时的默认标签页（排在「全部」之前），列出当前已安装、且带设置页的插件卡片：
  - 养鱼（dsh-bili-whale）
  - QQ 机器人（@tencent-connect/dsh-qqbot）
  - Our Free Model（dsh-our-free-model）
- 点一张卡片，就切到该插件自己的设置页（内容仍由插件提供，本插件不复制任何插件的界面）。
- 这些插件原来在设置导航里各占一行；现在从导航里隐藏，统一从「内置插件 → 插件设置」进入。停留在某个插件设置页时，导航里的「内置插件」保持选中样式。
- 进入某个插件设置页时，设置面板右上角会出现 **← 返回插件设置**，回到插件列表。
- 插件市场不单独占设置导航：它的独立入口会被隐藏，页面仍是「内置插件」页里的「插件市场」标签页。

## 使用

1. 打开 设置 → 内置插件（默认落在「插件设置」标签页）。
2. 点要配置的插件，改完设置后点右上角「返回插件设置」，或直接再点导航里的「内置插件」。

## 实现说明与限制

设置导航和各个设置页由平台的槽位系统渲染，平台没有「注销其他插件设置页」的 API，本插件因此按平台的渲染约定处理导航：

- 平台把设置导航渲染成 `div[data-shortcut-modal="settings"] > nav` 下的一排 `<button>`，当前页的按钮带 `aria-current="true"`（`SettingsRoot.tsx`）；
- 本插件按导航文字（养鱼 / QQ 机器人 / Our Free Model / 插件市场）识别这些行，隐藏它们，并用 `aria-current` 跟踪当前页；
- 点卡片时向对应导航按钮派发点击，切到插件自己的设置页，并把焦点移到设置面板；
- 只读写导航文字与点击事件，不读取、不修改其他插件页面的内容。

因此：

- 只对上面列出的插件生效。**新装带设置页的第三方插件后，需要在 `client.js` 的 `CARD_PAGES` 里补一条映射**（导航文字 + 卡片文案），它才会出现在这里并被折叠；否则仍显示在左侧导航。
- 插件若改了导航文字，映射需要同步更新。
- 设置面板关闭时「插件设置」列表为空，这是预期状态。
- 如果「插件设置」页渲染失败，保护逻辑会立刻恢复被隐藏的导航行并暂停折叠，避免入口一起消失。
- 本插件的宿主侧文件（`index.js` / `cordis.patch.yml`）改动后要重启 DSH 或禁用再启用一次插件；`client.js` 的改动会被 client-hmr 热应用。

## 安装 / Installation

这是一个 DeepSeek Harness（DSH）Web 插件 bundle，两种装法都行。

### 方式一：下载 Release 安装包（推荐）

1. 打开 [Releases](https://github.com/peter9130/dsh-plugin-settings-hub/releases/latest)，下载 `dsh-plugin-settings-hub-1.0.0.tgz`。
2. 在 DSH 里把 tgz 的绝对路径交给插件管理器安装：

   ```text
   用 plugin_manager 的 install_bundle，安装 /绝对路径/dsh-plugin-settings-hub-1.0.0.tgz
   ```

   或者把 tgz 放进任意目录，在 DSH 里说「安装 /path/to/dsh-plugin-settings-hub-1.0.0.tgz」，由 Agent 调用 `plugin_manager` 完成。

3. 按提示重启 DSH（或到「设置 → 插件」里对 `dsh-plugin-settings-hub` 禁用再启用）。
   浏览器端（`client.js`）由 client-hmr 热加载，约 10 秒生效；宿主端（`index.js` /
   `cordis.patch.yml`）需要重启或重新启用。

### 方式二：从源码目录安装

```bash
git clone https://github.com/peter9130/dsh-plugin-settings-hub.git
```

然后在 DSH 里用 `plugin_manager install_bundle` 指向克隆下来的目录（或把目录放进
`~/.dsh/profiles/<profile>/vendor/` 后安装），开发时也可以直接 `link:` 到该目录。

### 方式三：从 GitHub 源码安装

```text
用 plugin_manager 安装 github:peter9130/dsh-plugin-settings-hub
```

GitHub 源码安装走 pnpm 的 git 拉取，国内网络可能很慢；优先用方式一的 tarball。

## 卸载 / Uninstall

在「设置 → 插件」里禁用并删除该 bundle，或从 profile 的 `package.json`
（`dependencies` 与 `dsh.profile.bundles`）里去掉 `dsh-plugin-settings-hub` 后重新安装依赖。

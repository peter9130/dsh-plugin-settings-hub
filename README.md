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

这是一个 DeepSeek Harness（DSH）Web 插件 bundle，三种装法任选。

### 方式一：npm 安装（推荐）

在 DSH 里直接让插件管理器按包名安装：

```text
用 plugin_manager 安装 dsh-plugin-settings-hub@1.0.1
```

国内网络访问 npm 源通常比 GitHub 快；也可以先 `npm view dsh-plugin-settings-hub version` 确认版本。

### 方式二：下载 Release 安装包（离线）

1. 打开 [Releases](https://github.com/peter9130/dsh-plugin-settings-hub/releases/latest)，下载 `dsh-plugin-settings-hub-1.0.1.tgz`。
2. 把它交给 DSH 的插件管理器：

   ```text
   用 plugin_manager 的 install_bundle 安装 /绝对路径/dsh-plugin-settings-hub-1.0.1.tgz
   ```

### 方式三：从源码目录安装（开发）

```bash
git clone https://github.com/peter9130/dsh-plugin-settings-hub.git
```

然后在 DSH 里用 `plugin_manager install_bundle` 指向该目录，或把目录放进
`~/.dsh/profiles/<profile>/vendor/` 后安装；开发时也可以直接 `link:` 到该目录。

## 升级 / Upgrade

```text
用 plugin_manager 把 dsh-plugin-settings-hub 升级到最新版本
```

或重新执行一次安装并指定新版本号（如 `dsh-plugin-settings-hub@1.0.2`）。

## 卸载 / Uninstall

在「设置 → 插件」里禁用并删除该 bundle，或从 profile 的 `package.json`
（`dependencies` 与 `dsh.profile.bundles`）里去掉 `dsh-plugin-settings-hub` 后重新安装依赖。

宿主端（`index.js` / `cordis.patch.yml`）改动需要重启或禁用再启用；浏览器端
（`client.js`）由 client-hmr 热加载，约 10 秒生效。

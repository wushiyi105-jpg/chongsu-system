# mobile · 重塑系统移动端工程（Capacitor）

移动端用 [Capacitor](https://capacitorjs.com/) 6 套壳：一个全屏 WebView 加载你部署的重塑系统 Web 应用，打包成 Android / iOS 原生 App。

## 目录结构

```
mobile/
├── capacitor.config.json   # 核心配置（必改：appId / server.url）
├── www/                    # 加载页（启动后跳转到你的部署地址）
├── icons/                  # 应用图标源图
├── android/                # Android 原生工程（已生成，可直接打包）
└── package.json
```

## ⚠️ 必改配置（部署前）

编辑 `capacitor.config.json`：

```json
{
  "appId": "com.yourcompany.chongsu",          // 改成你自己的包名
  "server": {
    "url": "https://your-app.example.com/",   // 改成你部署的重塑系统地址
    "allowNavigation": ["*.your-app.com"]
  }
}
```

同时把 `www/index.html` 里 `APP_URL` 改成同一个地址。

> 重要：**不要指向他人的实例**。你自己部署、自己使用，数据都在你自己的服务器上。

## Android 打包

环境要求：JDK 17、Android SDK（platform 34 / build-tools 34）。

```bash
cd mobile
npm install
npx cap sync android     # 同步前端资源到 android 工程

# Debug 包（可直接安装测试）
cd android
./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk

# Release 包（需要签名，见 docs/android-capacitor-build-guide.md）
./gradlew assembleRelease
```

同一台机器打的 debug 包可以覆盖安装；换机器打包签名不同，需先卸载旧版。

## iOS 打包（需要 macOS）

iOS 原生工程必须用 macOS + Xcode 生成（Linux / Windows 无法生成）：

```bash
cd mobile
npm install
npx cap add ios        # 首次生成 ios/ 原生工程
npx cap sync ios       # 同步前端资源
open ios/App/App.xcworkspace   # 用 Xcode 打开
```

在 Xcode 里：选择你的签名 Team → 选择目标设备 → Run 或 Archive 打包。

## 替换应用图标

- 源图：`icons/icon-192.png`、`icons/icon-512.png`（替换为你自己的图标后重新 sync）
- Android：`npx cap sync android` 后，`android/app/src/main/res/` 下各密度 mipmap 会自动更新

## 说明

- 移动端只是"壳"，所有功能（五支柱、碎片、语音、图片 OCR、图谱）都在 Web 端，部署好 Web 应用后移动端自动生效
- 语音转写、图片 OCR 需要你在部署环境配置对应的语音/视觉能力凭证（见根 README 环境变量表）

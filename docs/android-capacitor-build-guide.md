# 重塑系统 · Android 打包指南（Capacitor Web 套壳）

> 适用场景：妙搭托管环境下 PWA 无法生成桌面图标/无法 WebAPK 安装时，用 Capacitor 打一个原生 APK 壳，内嵌 WebView 加载线上应用。

---

## 一、为什么 PWA 安装在当前环境不生效

### 结论：**doubaoapps / miaoda 托管域名下，WebAPK 安装永久受限**

| 问题 | 原因 | 影响 |
|------|------|------|
| 「安装应用」不出现 | WebAPK 需要 Chrome 与托管平台之间完成签名验证（Digital Asset Links / `/.well-known/assetlinks.json`），妙搭平台未对每个子应用独立配置 assetlinks | 菜单只有「安装并创建快捷方式」 |
| 快捷方式也不生成 | 部分定制 ROM（含 Android 16 部分机型）默认禁止 Chrome 创建桌面快捷方式，或「安装并创建快捷方式」在跨子路径应用上因 scope/图标校验失败而静默失败 | 桌面无图标 |
| 全屏体验受影响 | 即使快捷方式成功，display: standalone 也依赖 manifest 校验通过 | 可能仍在浏览器中打开 |

**这不是配置问题，是平台客观限制。** 不需要再反复调 manifest/SW/图标——它们本身已达标。

---

## 二、替代方案：Capacitor 打原生 APK

### 原理
用 Capacitor 生成一个 Android 原生工程，里面只有一个全屏 WebView，打开应用即加载线上地址 `https://your-app.example.com/app/`。用户安装 APK 后：
- 桌面有原生图标（应用级，非快捷方式）
- 启动是全屏原生 App，无浏览器 UI
- 应用列表里能找到，可设为默认应用
- 推送、分享、离线能力可后续用原生插件扩展

### 技术可行性
- ✅ 当前应用：React + Vite + TypeScript（标准 Web 技术栈）
- ✅ 构建输出：Vite 默认输出到 `dist/client/`（但本方案**不需要本地构建**——直接加载线上 URL）
- ✅ Capacitor 5/6 支持直接加载远程 URL（`server.url` 配置）
- ⚠️ 沙箱无法产出可构建 Android 工程（无 Android SDK / JDK），需在本机执行

---

## 三、打包准备包（本机执行，约 15 分钟）

### 前置依赖（本机安装）
1. **Node.js 20+**：https://nodejs.org/
2. **JDK 17**：Android Studio 自带，或 `brew install openjdk@17`
3. **Android Studio**：https://developer.android.com/studio（内含 Android SDK）
4. 安装 Android Studio 后，打开一次 → More Actions → SDK Manager → 安装 **Android 14 (API 34)** 或最新版

### 步骤一：创建打包工程目录

在你本机任意目录执行：

```bash
mkdir chongsuxi-app && cd chongsuxi-app

# 初始化 npm 项目
npm init -y

# 安装 Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/splash-screen @capacitor/status-bar
```

### 步骤二：创建配置文件

把下面两个文件放到 `chongsuxi-app/` 目录下（沙箱已生成同内容的模板，可直接复制）：

**`capacitor.config.json`**
```json
{
  "appId": "com.chongsuxi.app",
  "appName": "重塑系统",
  "webDir": "www",
  "server": {
    "url": "https://your-app.example.com/app/",
    "cleartext": false,
    "androidScheme": "https"
  },
  "backgroundColor": "#f2f2f0",
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true,
      "backgroundColor": "#f2f2f0",
      "androidSplashResourceName": "splash",
      "androidScaleType": "CENTER_CROP",
      "showSpinner": false,
      "splashFullScreen": true,
      "splashImmersive": true
    },
    "StatusBar": {
      "style": "LIGHT",
      "backgroundColor": "#f2f2f0",
      "overlaysWebView": true
    }
  }
}
```

> **重要**：`server.url` 直接指向线上应用地址。APK 启动后 WebView 加载该 URL，用户交互与浏览器一致，但外观是原生 App。

### 步骤三：准备 www 目录（index.html 占位）

Capacitor 要求 `webDir` 存在，哪怕加载远程 URL 也需要一个空壳：

```bash
mkdir -p www
cat > www/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>重塑系统</title>
  <meta http-equiv="refresh" content="0;url=https://your-app.example.com/app/">
</head>
<body>
  <p>加载中...</p>
  <script>
    window.location.href = 'https://your-app.example.com/app/';
  </script>
</body>
</html>
EOF
```

### 步骤四：添加 Android 平台

```bash
npx cap add android
```

### 步骤五：配置 WebView 全屏与沉浸式

打开 `android/app/src/main/java/com/chongsuxi/app/MainActivity.java`，替换为：

```java
package com.chongsuxi.app;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 全屏 + 沉浸式
        Window window = getWindow();
        window.setStatusBarColor(0xFFF2F2F0);  // 暖纸色 #f2f2f0
        window.setNavigationBarColor(0xFFF2F2F0);
        
        // 浅色状态栏文字
        View decorView = window.getDecorView();
        int flags = decorView.getSystemUiVisibility();
        flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        decorView.setSystemUiVisibility(flags);
    }
}
```

### 步骤六：配置网络权限与混合内容

打开 `android/app/src/main/AndroidManifest.xml`，确认 `<manifest>` 标签内有：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

在 `<application>` 标签里加：

```xml
<application
    ...
    android:usesCleartextTraffic="false"
    android:networkSecurityConfig="@xml/network_security_config">
```

创建 `android/app/src/main/res/xml/network_security_config.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">your-app.example.com</domain>
    </domain-config>
</network-security-config>
```

### 步骤七：替换应用图标

1. 用图标生成工具（如 https://www.pwabuilder.com/imageGenerator 或 Android Studio 的 Image Asset Studio）生成适配各尺寸的图标
2. 生成 mipmap 资源：右键 `android/app/src/main/res` → New → Image Asset → 选图标源文件 → 一路 Next
3. 图标源用：`client/public/icons/icon-512.png`（已在仓库中）

### 步骤八：同步并构建

```bash
npx cap sync

# 用 Android Studio 打开（推荐）
npx cap open android
# 在 Android Studio 中：Build → Build Bundle(s) / APK(s) → Build APK(s)
# APK 输出路径：android/app/build/outputs/apk/debug/app-debug.apk
```

### 命令行构建（可选，不需要 Android Studio UI）

```bash
cd android
./gradlew assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

---

## 四、签名与发布（正式版）

### 生成签名密钥
```bash
keytool -genkey -v -keystore chongsuxi-release.keystore \
  -alias chongsuxi -keyalg RSA -keysize 2048 -validity 10000
```

### 配置签名
在 `android/app/build.gradle` 的 `android {}` 块中加：

```groovy
signingConfigs {
    release {
        storeFile file("chongsuxi-release.keystore")
        storePassword "你的密钥库密码"
        keyAlias "chongsuxi"
        keyPassword "你的密钥密码"
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 打 Release 包
```bash
cd android
./gradlew assembleRelease
# 产物：app/build/outputs/apk/release/app-release.apk
```

---

## 五、产出与限制说明

| 项目 | 说明 |
|------|------|
| **沙箱产出物** | `capacitor.config.json`（已生成在项目根目录）+ 本打包指南 |
| **为什么沙箱不直接产 APK** | 沙箱无 Android SDK / JDK / Gradle，无法完成原生构建 |
| **打包后的体验** | 原生 App 图标 + 全屏 WebView 加载线上应用，体验等同于 PWA 的「安装应用」形态 |
| **数据一致性** | WebView 加载线上地址，数据实时同步，无需独立后端 |
| **推送/离线** | 当前方案走纯 WebView，推送和离线走 Web 侧能力；如需要原生推送可后续加 `@capacitor/push-notifications` 插件 |
| **应用商店上架** | Release 签名后的 APK/AAB 可上传 Google Play / 国内应用商店（需对应开发者账号） |
| **iOS** | 同一套 Capacitor 配置，`npx cap add ios` 即可，需 Mac + Xcode |

---

## 六、最简命令速查（本机一次执行）

```bash
# 1. 建项目
mkdir chongsuxi-app && cd chongsuxi-app
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. 建配置
vi capacitor.config.json   # 粘贴上面的配置

# 3. 建空壳 www
mkdir www && echo '<script>location="https://your-app.example.com/app/"</script>' > www/index.html

# 4. 加 Android 平台
npx cap add android

# 5. 同步并打开 Android Studio
npx cap sync
npx cap open android

# 6. Android Studio 里：Build → Build APK
```

---

## 七、后续扩展方向

- 📱 **原生推送**：`@capacitor/push-notifications` + 飞书/个推
- 📤 **分享入站**：`@capacitor/share` + intent filter 接收分享链接
- 🔔 **桌面小组件**：原生 App Widget 展示今日目标
- 🗣️ **语音录入优化**：原生语音识别替代网页录音（体验更好）
- 📴 **离线缓存**：Service Worker 已在，APK 内 WebView 同样生效

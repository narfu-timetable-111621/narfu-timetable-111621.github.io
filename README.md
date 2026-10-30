# NArFU · 111621 中俄双语课表

公开课表网址：https://narfu-timetable-111621.github.io/

GitHub Pages 公开网页，朋友无需登录即可使用。iPhone Safari 可添加主屏幕；包含日期周切换、点击课程展开详情、教师中俄全名、教室和地址、分组筛选及语言设置。

## 自动同步

GitHub Actions 目标每 5 分钟直接抓取学校公开课表，验证后生成网页和课表数据，再发布到 Pages。浏览器每 5 分钟读取最近发布的数据；“获取最新课表”按钮读取 GitHub 上最近发布的数据。GitHub 定时任务和发布可能延迟，不能承诺秒级实时更新。超过 20 分钟没有成功抓取的课表会显示“后台更新延迟”，读取已发布文件失败则单独提示网络读取错误。源站抓取失败时工作流失败并保留上一版网站，不发布空课表。

公开仓库使用 GitHub Free 的标准 GitHub 托管运行器和 Pages。不要启用付费或更大规格运行器。仓库长时间无活动时 GitHub 可能停用定时工作流；脚本保留每天或课程变动时的真实校验快照。若 Actions 显示停用，需要所有者重新启用。

## 日历和提醒

`calendars/all-all.ics` 是双语日历订阅；按分组与语言提供 12 个地址，网站按钮会跟随筛选更新。苹果自行决定日历订阅刷新时间。下载导入是一次性快照。学校官方俄文订阅保留。

GitHub Pages 不能保存设备推送订阅或运行 Web Push 服务器。GitHub 版目前提供苹果日历订阅入口，不宣称已具备锁屏网页推送。旧 Cloudflare 网站已启用的通知仍由旧后台处理。本仓库不包含任何私钥、访问令牌或推送设备记录。

## 发布

在仓库 Settings → Pages 中将 Source 设为 GitHub Actions，然后运行 `Sync school timetable and publish`。`main` 分支需要允许此工作流使用仓库内容写入权限，以保留学校快照；Pages 发布使用当前工作流短期令牌，不需要个人访问令牌。

本地检查：Node.js 22 或更新版，运行 `npm run build && npm run validate`。构建时需要连接学校，不需要安装第三方依赖。

网页和自动同步迁出 Cloudflare 后，俄罗斯网络仍需在使用者的实际运营商下测试。未进行俄罗斯本地网络实测前，不保证免 VPN 可用性。

## 来源

学校课表：https://ruz.narfu.ru/?timetable&group=20991

官方日历：https://ruz.narfu.ru/?icalendar&oid=20991&cod=111621

教师全名结合学校官方日历和使用者提供的双语日历；中文为参考音译。校徽来自 NArFU 官网公开 SVG，保留图形与颜色：https://narfu.ru/university/about/symbols/logo.php

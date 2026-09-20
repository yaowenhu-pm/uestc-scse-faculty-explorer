# UESTC SCSE Faculty Explorer

电子科技大学计算机科学与工程学院教师研究方向与官网证据导航。

本项目将学院官网公开的教师目录、研究方向、项目、成果和荣誉整理为可搜索、可筛选的静态网站。S/A/B/C/D/E 是“官网证据强度等级”，不是教师能力、人格或教学质量排名。

界面采用三列教师目录，支持搜索、院系/职称/等级组合筛选和教师证据详情。默认按等级排序，同等级按证据分降序。设计依据与完整实施步骤见 [界面实现方案](./docs/implementation-plan.md)。

## 本地运行

需要 Node.js 22+：

```powershell
npm run check
npm run serve
```

打开 `http://127.0.0.1:4173`。

## 数据更新

公开数据由白名单导出器生成：

```powershell
npm run data
npm run validate
```

默认读取同一工作区下 `tools/uestc-faculty/data/normalized/faculty.json`。也可以通过 `FACULTY_SOURCE` 指定规范化数据文件。

公开导出不包含邮箱、电话、办公地点、照片、完整履历、原始 HTML、哈希、抓取日志或浏览器状态。CI 会再次扫描敏感字段。

## 发布

`main` 分支通过 GitHub Actions 校验并部署到 GitHub Pages。工作流只发布以下白名单内容：

- `index.html`
- `methodology.html`
- `404.html`
- `styles.css`
- `app.js`、`faculty.js`
- `data/*.json`
- `DATA_NOTICE.md`

GitHub Actions 不直接访问学院官网；官网刷新在本地可见浏览器环境中完成，复核后再生成公开数据。

## 许可与数据说明

原创代码采用 MIT License。学院官网数据、教师资料和证据摘录不属于 MIT 授权范围，详见 [DATA_NOTICE.md](./DATA_NOTICE.md)。

# Reddit Hourly Job —— 运行逻辑与停电恢复机制(完整记录)

> 最后更新:2026-06-08。这台机器是放在家里、无人值守的 **Mac Mini M4**,
> 当作小服务器跑定时抓取任务。本文档记录这套服务的**全部细节**,
> 目的是:服务稳定后长期不动,过段时间回来也能迅速回忆起「这里都做了什么、怎么测、怎么修」。

---

## 0. 一句话概览

每个整点(`:00`,Halifax 本地时间)由 macOS 的 **launchd** 自动跑一次脚本:
**抓取 r/halifax 的热帖与评论 → 用 Gemini 生成中英文摘要和 TTS → 写入 Supabase 数据库**。
停电后机器能**自己开机、自己登录、自己把这个任务重新跑起来**,全程无需人工。

---

## 1. 涉及的所有文件(组件清单)

| 文件 | 作用 |
|---|---|
| `~/Library/LaunchAgents/com.karlfi.reddit-hourly.plist` | **launchd 任务定义**。决定「何时跑、跑什么、日志写哪」。 |
| `scripts/run-reddit-hourly.sh` | **wrapper 脚本**(真正被 launchd 调用)。负责加锁、冷却、等网络、依次跑两步、失败通知。 |
| `scripts/fetch-reddit-to-db.mjs` | **第 1 步**:用 Playwright 抓 r/halifax 热帖 + 评论,写入数据库。 |
| `scripts/summarize-reddit-mac-mini.mjs` | **第 2 步**:调 Gemini 生成中英文摘要 + edge-tts 语音,写库。 |
| `.briefing.env` | 环境变量(数据库连接、API key、`NTFY_TOPIC` 等)。被 wrapper `source` 进来。 |
| `~/.reddit-hourly-last-run` | **状态文件**:存上一次成功跑完的 Unix 时间戳,用于冷却判断。 |
| `/tmp/reddit-hourly.lock` | **锁文件**:存当前运行进程的 PID,防止并发重复运行。 |
| `logs/reddit-hourly.log` | 标准输出日志(正常流程,`[hourly] ... all done` 等)。 |
| `logs/reddit-hourly-error.log` | 标准错误日志(异常堆栈、Gemini/抓取报错)。 |

> 注:`scripts/` 下还有 `fetch-reddit.mjs`、`generate-reddit-briefing.mjs` 等,
> **不在这个 hourly job 的链路里**,是其他用途的脚本,别混淆。

---

## 2. 定时机制(plist / launchd)

任务类型是 **LaunchAgent**(放在用户的 `~/Library/LaunchAgents/`),
意味着它**绑定到图形登录会话(Aqua)** —— 必须有人登录进桌面,任务才会被加载运行。

`com.karlfi.reddit-hourly.plist` 关键字段:

```xml
<key>ProgramArguments</key>      <!-- 跑什么 -->
<array>
  <string>/bin/bash</string>
  <string>/Users/karl_li/halifax-civic-dashboard/scripts/run-reddit-hourly.sh</string>
</array>

<key>StartCalendarInterval</key>  <!-- 每个整点 :00 跑一次 -->
<array><dict><key>Minute</key><integer>0</integer></dict></array>

<key>RunAtLoad</key><true/>       <!-- 任务一被加载(=登录那一刻)就立即补跑一次 -->

<key>StandardOutPath</key>  <string>.../logs/reddit-hourly.log</string>
<key>StandardErrorPath</key><string>.../logs/reddit-hourly-error.log</string>
```

两个触发键的分工:
- **`StartCalendarInterval { Minute: 0 }`** —— 日常:每小时整点跑。
- **`RunAtLoad = true`** —— 重启/登录后:不用等到下个整点,登录那一刻立即先跑一次。

---

## 3. wrapper 脚本逻辑(`run-reddit-hourly.sh` 逐步拆解)

脚本按顺序做这几件事,任何一关不满足就**安静退出**(`exit 0`,不算失败):

1. **设 PATH + 切目录 + `source .briefing.env`** —— 保证 launchd 环境下也能找到 node/homebrew 和环境变量。
2. **加锁(防并发)** —— 检查 `/tmp/reddit-hourly.lock`;若锁里的 PID 还活着 → 说明上一轮还没跑完,`skipping` 退出。否则写入自己的 PID,退出时自动删锁。
3. **冷却(防重复)** —— 读 `~/.reddit-hourly-last-run`;若距上次成功跑完 **< 1800 秒(30 分钟)** → `ran Ns ago (cooldown 1800s), skipping` 退出。
   - ⚠️ **这是重启测试时最容易误判的点**:重启后 `RunAtLoad` 会触发,但若上次成功运行还在 30 分钟内,wrapper 会跳过实际抓取。看到 `skipping` 不是坏事,是设计如此。
4. **等网络** —— `ping 8.8.8.8`,最多等 600 秒(每 30 秒重试);停电恢复后网络/路由器可能比电脑起得慢,这一步专门兜住这种情况。超时仍无网 → 安静退出。
5. **Step 1/2 —— fetch**:`node scripts/fetch-reddit-to-db.mjs`。失败则发通知 + `exit 1`(**fetch 失败就不跑 summarize**)。
6. **Step 2/2 —— summarize**:`node scripts/summarize-reddit-mac-mini.mjs`。失败则发通知 + `exit 1`。
7. **全部成功**:把当前时间戳写进 `~/.reddit-hourly-last-run`,打印 `all done`。

**失败通知**(`notify_failure`):弹 macOS 桌面通知(声音 Basso);若 `.briefing.env` 里设了 `NTFY_TOPIC`,还会推送到 `https://ntfy.sh/<topic>`(可在手机收到)。

**关键常量**(在脚本顶部,需要时改这里):
- `COOLDOWN_SECS=1800` —— 冷却 30 分钟
- `NETWORK_WAIT_SECS=600` —— 等网最多 10 分钟
- `NETWORK_POLL_INTERVAL=30` —— 每 30 秒探测一次网络

---

## 4. 停电 → 自动恢复的完整链路(三层机制)

停电后要做到「全程无人值守、自己跑起来」,靠的是**三个独立机制叠在一起**,缺一不可:

```
停电 → 来电
  │
  ├─[第①层] autorestart=1 → 电源恢复后 Mac Mini 自动开机(无需按电源键)
  │
  ├─[第②层] FileVault 关闭 + 自动登录 → 开机后自动进入 karl_li 桌面(无需输密码)
  │
  └─[第③层] launchd 加载 LaunchAgent → RunAtLoad=true → 立即补跑一次
              └→ 之后由 StartCalendarInterval 接管,每整点继续跑
```

| 层 | 解决什么 | 靠什么实现 | 不做会怎样 |
|---|---|---|---|
| ① 自动开机 | 来电后自己开机 | `sudo pmset -a autorestart 1` | 停在关机状态,要人按电源键 |
| ② 自动登录 | 开机后自己进桌面 | 关闭 FileVault + 系统设置里设自动登录用户 | 停在登录界面等输密码 |
| ③ 自动跑任务 | 进桌面后跑抓取 | LaunchAgent + `RunAtLoad` | 要等下个整点 / 或手动触发 |

**重要前提说明:**
- 第②层为什么要关 FileVault:FileVault 磁盘加密会在开机最早期要求**手动输密码解锁磁盘**,只要它开着,macOS 就**禁用自动登录**(设置项变灰)。这是用「磁盘不加密」换「无人值守」的**安全权衡** —— 机器若被偷/拆盘,数据可直接读取。对一台放家里的服务器是常见取舍。
- 第①层 `autorestart` **只在真实断电时触发**,软重启(`sudo reboot`)测不到它。

---

## 5. 当前配置状态(2026-06-08 实测,全部就位 ✅)

| 检查项 | 命令 | 当前值 |
|---|---|---|
| ① 来电自动开机 | `pmset -g \| grep autorestart` | `autorestart 1` ✅ |
| ② FileVault | `fdesetup status` | `FileVault is Off.` ✅ |
| ② 自动登录用户 | `defaults read /Library/Preferences/com.apple.loginwindow autoLoginUser` | `karl_li` ✅ |
| ③ job 已加载 | `launchctl list com.karlfi.reddit-hourly` | 已加载,`LastExitStatus = 0` ✅ |
| ③ RunAtLoad + 定时 | 见 plist | 都在 ✅ |

> 即:停电恢复闭环配置**已完整成立**。

---

## 6. 如何测试

### 第 1 层:不重启,验证脚本能跑通(最快)
```bash
launchctl start com.karlfi.reddit-hourly      # 手动触发,等同登录后 RunAtLoad
sleep 8
launchctl list com.karlfi.reddit-hourly        # 有 PID = 正在跑
tail -15 logs/reddit-hourly.log                 # 看流程
```
注意:若距上次成功 < 30 分钟,会看到 `cooldown ... skipping` —— 这说明触发链路是通的,只是冷却跳过了实际抓取,**属正常**。

### 第 2 层:真实重启测试(两种,测的东西不同)

| 方式 | 验证 | 验证不了 |
|---|---|---|
| `sudo reboot`(软重启) | 自动登录 + RunAtLoad 自动跑 | **测不到 autorestart** |
| **拔电源线 / 关插排再通电**(模拟停电) | 全链路含「来电自动开机」 | —— |

**推荐演练流程(测全链路):**
1. 等过了某个整点、日志出现新的 `all done`,**再等 ≥ 30 分钟**(避开冷却窗口)。
2. **直接拔掉电源线** → 等几秒 → 插回去。**不要按电源键。**
3. 机器应自己亮起 → 自动进桌面 → job 自动跑。
4. 登录后验证:
```bash
uptime                                          # 开机时间应很短
launchctl list com.karlfi.reddit-hourly
tail -15 logs/reddit-hourly.log                 # 看到重启之后时间戳的新 all done = 全通过
```

---

## 7. 常用运维命令(速查)

```bash
# 状态 / 上次退出码
launchctl list com.karlfi.reddit-hourly

# 手动跑一次
launchctl start com.karlfi.reddit-hourly

# 改了 plist 后重新加载
launchctl unload ~/Library/LaunchAgents/com.karlfi.reddit-hourly.plist
launchctl load   ~/Library/LaunchAgents/com.karlfi.reddit-hourly.plist

# 看日志
tail -f logs/reddit-hourly.log                  # 正常输出
tail -30 logs/reddit-hourly-error.log           # 报错

# 强制绕过冷却跑一次(删掉 last-run 记录)
rm ~/.reddit-hourly-last-run && launchctl start com.karlfi.reddit-hourly

# 卡死时清锁
rm -f /tmp/reddit-hourly.lock

# 电源 / 登录相关
pmset -g | grep autorestart                     # 来电自动开机
fdesetup status                                 # FileVault
```

---

## 8. 已知问题与历史修改

- **`fetchComments` HTTP 503(2026-06-08 已修)**:Reddit 偶发返回 503,原来会让整轮 run 中断。
  已在 `fetch-reddit-to-db.mjs` 的 `fetchComments` 加上**最多 3 次重试 + 退避(1.5/3/4.5s)**;
  重试用尽后**只跳过该帖**(打印 `[reddit-db] skip <postId>`)而非中断整轮。
- **Gemini 摘要相关报错**(error log 里偶见,属 `summarize-reddit-mac-mini.mjs`,与抓取无关):
  - `Gemini session not found ... run setup-gemini-session.mjs first` —— Gemini 会话失效,需重跑 setup。
  - `Unbalanced braces in Gemini response` / `no summary_zh ... Gemini omitted Chinese` —— 模型输出不规范/漏中文,通常下一轮自愈。
  - `post_id ... not found in selected posts, skipping` —— 模型返回了占位/多余 id,被安全跳过。

---

## 9. 维护提示

改动任何机制后,请回来更新本文档对应章节(尤其第 5 节「当前配置状态」和第 8 节「历史修改」),
让它始终是这套服务的**唯一可信记录**。

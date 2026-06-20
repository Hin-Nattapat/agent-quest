# Agent Quest — Design Document

ระบบ gamify การใช้งาน **AI coding agent** ให้เป็นเกม RPG: เก็บ XP, อัป level, เลือกสาย (class), หาของ (loot) — ยิ่งใช้/prompt เยอะ ตัวละครยิ่งโต โดยไม่แตะการทำงานจริงของ agent

ออกแบบให้ **ไม่ผูกกับ agent ตัวใดตัวหนึ่ง** — Claude Code เป็นแค่ adapter ตัวแรก ต่อ Codex CLI, Cursor, Gemini CLI หรือ tool ใด ๆ ผ่าน generic emit ได้ภายหลัง

เวอร์ชัน: 0.5 (draft) · สถานะ: decisions ล็อกแล้ว (§14) พร้อมเริ่ม Phase 0

---

## 1. หลักการออกแบบ (design principles)

1. **แยก logic ออกจากหน้าตา** — ตรรกะเกมทั้งหมดอยู่ที่ event log + state เดียว ส่วน HUD/แอปเป็นแค่ "ตัวอ่าน" พังหน้าตาไม่กระทบ agent
2. **Agent-agnostic ที่ event boundary** — ทุกอย่างหลัง journal รู้จักแค่ "normalized event" ไม่รู้จัก agent ตัวไหน การรองรับ agent ใหม่ = เขียน adapter ตัวใหม่ ไม่แตะ game logic (ดู §2.1)
3. **ห้ามรบกวน agent** — ตัวรับ event ต้องเบา เร็ว และไม่ขัดการทำงานจริง (สำหรับ CC: ห้าม print ลง stdout ใน event ที่ inject context — ดู §8)
4. **Append-only ก่อน, aggregate ทีหลัง** — แต่ละ session เขียน event ของตัวเองแบบต่อท้ายไฟล์ (ไม่ต้อง lock) แล้วค่อยมี reducer พับรวมเป็น state — กันปัญหาหลาย instance/หลาย agent แย่งเขียน
5. **ไม่ over-engineer** — เริ่มจาก MVP ที่เล่นได้จริง (CC adapter ตัวเดียว) แล้วค่อยต่อชั้น (loot, class, adapter อื่น, แอป) ทีหลัง

---

## 2. สถาปัตยกรรมรวม

```
[ AI coding agents ]                  ── adapters แปลงเป็น normalized event ──►  Event journals
  Claude Code ─(hooks/JSONL)─►  CC adapter                                      journal/{session_id}.ndjson
  Codex CLI   ─(logs)────────►  Codex adapter
  tool ใด ๆ   ─(CLI/HTTP)─────►  generic emit
                                                                                       │
                                                                                 (reduce / fold)
                                                                                       ▼
                                                                               state.json (เซฟเกมรวม)
                                                                               level · XP · class · loot · stats
                                                                                 │                       │
                                                                          (อ่าน)│                       │(watch + SSE)
                                                                                 ▼                       ▼
                                                                        Statusline HUD            Companion app
                                                                        (terminal, ANSI)          (pixel office)
```

ส่วนหลัก:

1. **Adapters** — ต่อ agent → แปลงสัญญาณ native เป็น normalized event เขียนลง journal (ส่วนเดียวที่รู้จัก agent นั้น ๆ)
2. **Event journal** — append-only log ต่อ session (เลเยอร์กัน race)
3. **Reducer + state.json** — พับ journal ทั้งหมดเป็นสถานะเกมปัจจุบัน (agent-agnostic)
4. **Statusline HUD** — แถบล่าง terminal โชว์ level/XP/สาย/ของล่าสุด (เฉพาะ agent ที่มี statusline เช่น CC)
5. **Companion app** — pixel office โชว์ตัวละคร, skill tree, inventory (agent-agnostic)

### 2.1 Adapter layer (หัวใจของการ decouple)

adapter มีหน้าที่เดียว: **อ่านสัญญาณจาก agent หนึ่ง ๆ → แปลงเป็น normalized event → append ลง journal** เพิ่ม agent ใหม่ = เขียน adapter ใหม่ ไม่แตะ reducer/game logic เลย

- **Claude Code adapter** — ใช้ hooks (real-time) + JSONL transcript (backfill) ดู §8
- **Codex / Cursor / Gemini CLI adapter** — อ่าน log/session ของแต่ละตัว (เขียนเพิ่มภายหลัง)
- **Generic emit** — adapter สากล: tool/script/CI/git-hook ใด ๆ ยิง event เข้ามาได้ผ่าน CLI หรือ HTTP (ดู §2.4)

### 2.2 Normalized event taxonomy

reducer คิดแต้มจาก **action ที่ abstract** ไม่ใช่ชื่อ tool ของ agent ใด adapter เป็นคน map native → abstract:

| action | ความหมาย | ตัวอย่าง native (Claude Code) |
|---|---|---|
| `prompt` | ผู้ใช้ส่ง prompt | UserPromptSubmit |
| `read` | อ่านไฟล์ | Read |
| `search` | ค้นหา | Grep, Glob |
| `edit` | แก้ไฟล์เดิม | Edit |
| `write` | สร้างไฟล์ใหม่ | Write |
| `run` | รันคำสั่ง/เชลล์ | Bash |
| `delegate` | มอบงาน/subagent | Task |
| `test` | รันเทสต์ (ตรวจจากคำสั่ง) | Bash + `go test`/`vitest`… |
| `turn_end` / `session_end` | จบ turn / จบ session | Stop / SessionEnd |

> ทุกที่ในเอกสารที่อ้าง "Bash/Edit/Task" ให้อ่านเป็น action `run`/`edit`/`delegate` ตามตารางนี้ ส่วนสัญญาณที่อิงนามสกุลไฟล์ (`.go`, `.tsx`) เป็น generic อยู่แล้ว ใช้ได้ทุก agent

### 2.3 Capability tiers (รองรับ agent ที่ให้ข้อมูลไม่เท่ากัน)

ไม่ใช่ทุก agent จะให้ข้อมูลละเอียดเท่า CC — reducer ต้องทนต่อ field ที่ขาด:

- **Tier A (รวย):** per-action + tokens + lines — เช่น Claude Code (hooks + JSONL)
- **Tier B (กลาง):** session + prompt + action หยาบ ๆ ไม่มี token
- **Tier C (น้อย):** แค่ session เริ่ม/จบ หรือ "มีอะไรเกิดขึ้น" — เช่น generic emit / git-hook

กฎ: กำหนด event ขั้นต่ำที่ทุก adapter ต้องส่ง (`session_start`/`session_end` + อย่างน้อย `prompt` หรือ `action`) ส่วน tokens/lines/action ละเอียดเป็น optional — ถ้าไม่มี ให้ XP ตกไปใช้เรตต่อ-event แบบ flat แทน

### 2.4 Generic emit (adapter สากล)

ให้อะไรก็ได้ป้อน XP เข้าระบบ — แม้ agent นั้นไม่มี hook:

```bash
# CLI
agentrpg emit --source codex --action edit --file src/x.go

# หรือ HTTP (ยิงเข้า daemon §10.2)
curl -XPOST localhost:7333/event -d '{"source":"codex","action":"run"}'
```

ทั้งคู่แค่ append normalized event ลง journal เหมือน adapter อื่น git post-commit hook, CI job, หรือ editor extension ก็ยิงเข้ามาได้

---

## 3. โครงไฟล์

```
~/.agentrpg/                          # path กลาง ไม่ผูกกับ agent ใด
├── config.json                       # tuning: XP weights, level curve, drop tables, achievement registry, secret classes, adapter ที่เปิด
├── state.json                        # เซฟเกมรวม (ผลจาก reducer)
├── journal/
│   └── {session_id}.ndjson           # normalized event ต่อ session (append-only)
├── adapters/
│   ├── claude-code/                  # hooks + JSONL reader (adapter ตัวแรก)
│   │   ├── on-prompt.sh
│   │   ├── on-tool.sh
│   │   ├── on-stop.sh
│   │   └── on-session-end.sh
│   └── generic/                      # CLI / HTTP emit (adapter สากล)
├── lib/
│   ├── reduce.mjs                    # journal -> state.json (agent-agnostic)
│   ├── emit.mjs                      # normalized event -> journal (ใช้ร่วมทุก adapter)
│   └── statusline.mjs                # อ่าน state -> เรนเดอร์ HUD
└── importer.mjs                      # backfill (ต่อ adapter)
```

Claude Code adapter ผูกเข้ากับ `~/.claude/settings.json` (hooks/statusLine) และอ่าน transcript จาก `~/.claude/projects/{encoded-cwd}/{session-id}.jsonl` (ดู §8, §12) — adapter อื่นอ่าน path ของตัวเอง แต่ทุกตัวเขียนลง `~/.agentrpg/journal/` เหมือนกัน

---

## 4. Data model

### 4.1 Event (1 บรรทัดใน journal, NDJSON)

```jsonc
{
  "ts": "2026-06-10T08:30:00Z",
  "source": "claude-code",     // adapter ที่ส่ง: claude-code | codex | cursor | generic | ...
  "session_id": "abc123",
  "repo": "RMS_REPO",          // optional · ดึงจาก cwd → XP เป็น global แต่เก็บสถิติแยกต่อ repo
  "type": "action",            // prompt | action | action_fail | turn_end | session_end
  "action": "edit",            // abstract action (§2.2) — มีเฉพาะ type=action/action_fail
  "native": "Edit",            // ชื่อจริงจาก agent นั้น (debug/recompute) — optional
  "file": "src/app/page.tsx",  // optional
  "lines_added": 12,           // optional
  "tokens": 1843,              // optional
  "raw": { }                   // payload ดิบเผื่อ recompute สูตรใหม่ภายหลัง
}
```

> เก็บ event ดิบไว้ ไม่คำนวณ XP ในขั้น adapter — ให้ reducer เป็นคนคิดแต้มจาก `action` (ไม่ใช่ `native`) จะได้ปรับสูตร/import ย้อนหลัง/รองรับ agent ใหม่ได้โดยไม่เสีย data

### 4.2 state.json (เซฟเกมรวม)

```jsonc
{
  "version": 1,
  "updated_at": "2026-06-10T08:30:05Z",
  "xp_total": 14820,
  "level": 12,
  "xp_in_level": 320,            // แต้มในเลเวลปัจจุบัน
  "xp_to_next": 980,             // ที่ต้องการไปเลเวลถัดไป
  "class": {
    "line": "mage",              // สายหลัก (mage|ranger|rogue|sage) · null = ยังเป็น Novice
    "tier": 3,                   // ขั้นปัจจุบัน 1–4
    "active": "infra_archmage",  // ชื่อ form ปัจจุบัน (= path ตัวล่าสุด)
    "path": ["novice", "backend_mage", "server_sorcerer", "infra_archmage"],
    "branch": null,              // เลือกตอน Tier 4 (Lv.50) แล้ว lock
    "next_advancement": { "at_level": 50, "kind": "branch" }, // null = ขั้นสุด
    "affinity": {                // คะแนนสะสมแต่ละสาย (ใช้ auto-suggest ตอนเลือก/แตกสาย)
      "mage": 0.46, "ranger": 0.31, "rogue": 0.18, "sage": 0.05
    }
  },
  "stats": {
    "prompts": 1204,
    "actions": { "edit": 410, "run": 388, "read": 720, "search": 96, "delegate": 31 },
    "lines_added": 18230,
    "lines_removed": 6110,
    "sessions": 96,
    "tests_passed": 142,
    "failures_recovered": 73,
    "by_source": {              // แยกตาม agent — โชว์/leaderboard ต่อ source ได้
      "claude-code": { "xp": 12100, "sessions": 80 },
      "codex":       { "xp": 2720,  "sessions": 16 }
    },
    "by_repo": {                // XP global แต่เก็บสถิติต่อ repo ไว้ leaderboard/สีสัน
      "RMS_REPO": { "xp": 8800, "sessions": 52 },
      "POS_REPO": { "xp": 6020, "sessions": 44 }
    }
  },
  "streak": { "current_days": 5, "best_days": 21, "last_active": "2026-06-09" },
  "inventory": [
    { "id": "double_xp_potion", "rarity": "rare", "count": 2 },
    { "id": "skin_neon_terminal", "rarity": "epic", "count": 1 }
  ],
  "buffs": [
    { "id": "double_xp_potion", "mult": 2.0, "expires_at": "2026-06-10T09:00:00Z" }
  ],
  "titles": ["Refactor Slayer", "Night Owl"],
  "achievements": {
    "earned": [ { "id": "first_blood", "at": "2026-05-01T10:00:00Z", "source": "claude-code" } ],
    "points": 120,
    "progress": { "tooling_1000": 388 },        // ความคืบหน้าของที่ยังไม่ปลด
    "unlocked_secret_classes": ["maestro"]       // สายลับที่ปลดได้ (§6.5)
  }
}
```

---

## 5. ระบบ XP และ level

### 5.1 แหล่งที่มาของ XP (ปรับได้ใน config.json)

| Event (action) | XP พื้นฐาน | หมายเหตุ |
|---|---|---|
| `prompt` | +5 | ต่อ 1 prompt |
| `read` / `search` | +1 | งานสำรวจ |
| `run` | +3 | |
| `edit` / `write` | +4 | ถ่วงเพิ่มถ้าไฟล์ตรงกับสาย |
| `delegate` | +8 | งานใหญ่/subagent |
| `turn_end` | +10 | |
| `session_end` | +20 | + โบนัสตาม lines_added (ถ้ามี) |
| lines added | +0.1/บรรทัด | optional · cap 50 XP/session กัน farm |
| `test` passed (boss kill) | +25 | adapter ตรวจให้ |
| failure recovered | +15 | `action_fail` แล้วตามด้วยสำเร็จ |

ตัวคูณ: buff (เช่น double XP potion) × class passive × streak bonus

> **degrade (Tier B/C):** ถ้า adapter ไม่ให้ action ละเอียด/tokens/lines — XP ตกไปใช้เรตหยาบแทน เช่น `+8` ต่อ "มี action เกิดขึ้น 1 ครั้ง" หรือคิดจาก commit/เวลา session ระบบยังเดินได้ แค่หยาบลง

### 5.2 Level curve (ปรับเป็น config — จูนทีหลัง)

ทุกค่าความยากอยู่ใน `config.json` ใต้คีย์ `difficulty` ปรับได้โดยไม่แตะโค้ด:

```jsonc
"difficulty": {
  "curve_k": 7,            // ค่าคงที่ของ curve
  "curve_exp": 2.5,        // ความชัน
  "level_cap": 50,
  "xp_per_active_hour": 550 // สมมติฐานเริ่มต้น (ใช้ประเมินเวลา/จูน)
}
```

สูตร (สะสม): `cum(L) = curve_k * L^curve_exp` → ค่าเริ่มต้น `cum(50) ≈ 124,000 XP`

ตัวอย่างโค้ง: L5 ≈ 390 · L10 ≈ 2,200 · L20 ≈ 12,500 · L30 ≈ 34,500 · L40 ≈ 70,800 · L50 ≈ 124,000

ช่วงต้นถูก (อัปเร็ว เห็นผล ติด) ปลายแพง (endgame + แตกสาย Lv.50 มีน้ำหนัก)

**สมมติฐานเวลา** (ballpark — อิง ~550 XP ต่อ "active-hour" = ชั่วโมงที่ขับ CC จริงมี prompt/tool วิ่ง ไม่ใช่ชั่วโมงนั่งโต๊ะ):

| active-hour/วัน | นิยาม | ถึง Lv.50 |
|---|---|---|
| ~1 | เล่นเรื่อย ๆ | ~7–8 เดือน |
| ~3–4 | ทำงานปกติ (CC ทำเองเยอะ) | ~2 เดือน |
| ~8 | ปั่นหนักทั้งวัน | ~1 เดือน |

> **แผนจูน:** หลังทำ backfill (§12) เก็บค่าจริง 2 ตัว — `xp_per_active_hour` ของตัวเอง และ active-hour/วันเฉลี่ย — แล้ว back-out `curve_k`/`curve_exp` ให้ "สไตล์เรา" ถึง Lv.50 ในเวลาที่ตั้งใจ ค่าตอนนี้เป็นจุดตั้งต้น
> **ค้างไว้คิด:** Lv.50 = ตันจริง อาจเติม prestige/paragon (เลเวลต่อ ให้ title/cosmetic) หรือ season รีเซ็ตเป็นช่วง ๆ ภายหลัง

---

## 6. ระบบสาย (class) + up-class

แต่ละสายมี **ธีม** (สี/โมทีฟ/บุคลิกตัวละคร) เป็นของตัวเอง และ **วิวัฒนาการเป็น 4 ขั้น (tier)** ตามช่วง level แบบ job advancement — ยิ่งโต ชื่อ/หน้าตา/passive ยิ่งอัป และตอนขั้นสุดยังได้ "แตกสาย" เลือกความเชี่ยวชาญ 1 ใน 2 ทาง

### 6.1 จังหวะ up-class (ใช้กับทุกสาย)

| ขั้น | Level | เหตุการณ์ |
|---|---|---|
| Tier 0 — Novice | 1–4 | ยังไม่มีสาย สะสม affinity |
| Tier 1 | **Lv.5** | เลือกสาย (เสนอสายที่ affinity สูงสุด แต่เลือกเองได้) |
| Tier 2 | **Lv.15** | up-class ครั้งที่ 1 |
| Tier 3 | **Lv.30** | up-class ครั้งที่ 2 |
| Tier 4 | **Lv.50** | แตกสาย — เลือก 1 ใน 2 specialization แล้ว lock |

เวลาถึง checkpoint: reducer ตั้ง flag `advancement_pending` → HUD/แอปเด้งแจ้ง → ผู้เล่นยืนยัน (และเลือก ตอน Lv.5/Lv.50) ผ่านคำสั่ง เช่น `/rpg advance`

### 6.2 ต้นไม้สาย (4 สาย × 4 ขั้น)

โครง passive ใหม่แยก 2 ชั้น (ดูเหตุผลใน §6.4):
- **Base passive** — ติดทั้งสาย ยิงกับ "สัญญาณกว้าง" ของสายนั้น และโตขึ้นทุก tier (`+20 → 30 → 40 → 50%`) นี่คือ XP ก้อนหลักที่ได้ตลอด
- **Specialist** — ของเพิ่ม "บนยอด" ของแต่ละ form (โดยเฉพาะ branch Tier 4) ปรับให้ค่าเฉลี่ยเท่ากันทุก branch

> ชื่อ tool ในตารางสายอ้างเป็น **abstract action (§2.2)**: Bash=`run`, Edit/Write=`edit`/`write`, Task=`delegate`, Grep/Read=`search`/`read` ส่วน `.go`/`.tsx`/`.sql` เป็นนามสกุลไฟล์ generic — ทั้งหมดใช้ได้ทุก agent ผ่าน adapter

**Mage — สายหลังบ้าน** · ธีม: เวทมนตร์/รูน, สีม่วง, โมทีฟไม้เท้า+เซิร์ฟเวอร์
affinity จาก: Bash, ไฟล์ `.go`/`.sql`, migration
**Base:** `+20→50% XP` จาก Bash/Task + Edit `.go`/`.sql`

| Tier | Form | Specialist (เพิ่มจาก base) |
|---|---|---|
| 1 | Backend Mage | — |
| 2 | Server Sorcerer | combo เมื่อรัน Bash ต่อเนื่องใน turn |
| 3 | Infra Archmage | session-end bonus ×2 |
| 4a | Cloud Summoner | +XP ต่อ "infra touch" — docker/kubectl/helm/terraform, ไฟล์ yaml/Dockerfile, CI (บ่อย × ทีละนิด) |
| 4b | Kernel Lich | +XP ก้อนใหญ่ต่องาน optimize/concurrency หรือ diff ใหญ่ในไฟล์ core (นาน ๆ ครั้ง × ก้อนโต) |

**Ranger — สายหน้าบ้าน** · ธีม: ความเร็ว/แม่นยำ, สี teal, โมทีฟธนู+UI
affinity จาก: Edit/Write บน `.tsx`/`.css`/`.html`
**Base:** `+20→50% XP` จาก Edit/Write ไฟล์ UI

| Tier | Form | Specialist |
|---|---|---|
| 1 | Frontend Ranger | — |
| 2 | UI Sharpshooter | combo เมื่อแก้ไฟล์ UI ติดกัน |
| 3 | Pixel Hunter | โบนัสเมื่อแตะหลายไฟล์ใน turn เดียว |
| 4a | Motion Trickster | +XP ต่องาน interaction/state/animation/transition (บ่อย × ทีละนิด) |
| 4b | Design Warden | +XP ต่องาน styling/token/theme/component lib (บ่อย × ทีละนิด) |

**Rogue — สายล่าบั๊ก** · ธีม: ลอบเร้น/ล่า, สี coral, โมทีฟมีด+แว่นขยาย
affinity จาก: Grep/Read, test run, recover fail
**Base:** `+20→50% XP` จาก test passed + failure recovered, และ drop rate +5→15%

| Tier | Form | Specialist |
|---|---|---|
| 1 | Debugger Rogue | — |
| 2 | Bug Assassin | drop rate เพิ่มขึ้น |
| 3 | Stack Stalker | การันตี loot เมื่อ session ไร้ fail |
| 4a | Heisenbug Hunter | +XP ก้อนใหญ่ต่อการแก้ flaky/race/heisenbug (นาน × ก้อนโต) |
| 4b | Forensics Shadow | +XP ต่องาน log/trace/observability/Grep หนัก (บ่อย × ทีละนิด) |

**Sage — สายออกแบบ** · ธีม: ปราชญ์/วางแผน, สี amber, โมทีฟตำรา+พิมพ์เขียว
affinity จาก: prompt ยาว, Task/subagent, ไฟล์ `.md`
**Base:** `+20→50% XP` จาก Task/subagent + prompt แรกของ session + ไฟล์ `.md`/spec

| Tier | Form | Specialist |
|---|---|---|
| 1 | Architect Sage | — |
| 2 | System Oracle | +XP ต่อไฟล์ spec/`.md` ที่แก้ |
| 3 | Pattern Magus | prompt แรกของ session ได้ XP ×3 |
| 4a | Domain Prophet | +XP ก้อนใหญ่ต่องาน modeling/schema/DDD (นาน × ก้อนโต) |
| 4b | Orchestration Master | +XP ต่อ subagent ที่ spawn / งาน agent-team (บ่อย × ทีละนิด) |

### 6.3 กติกา

- **affinity** สะสมต่อเนื่องจากสัดส่วน tool/ไฟล์ ใช้ทั้งตอนเลือกสาย (Lv.5) และตอนเสนอ branch (Lv.50)
- **up-class ไม่บังคับ** — เก็บ flag ไว้จนกว่าผู้เล่นยืนยัน แต่ base/specialist ขั้นถัดไปจะยังไม่ได้จนกว่าจะ advance
- **branch (Tier 4) lock ถาวร** เพื่อให้มีน้ำหนักการตัดสินใจ (replay value) — ปลดได้ผ่าน item หายากเท่านั้น
- **respec** เปลี่ยนสายหลักได้ก่อน Lv.50 ผ่าน `/rpg respec` (cooldown หรือใช้ item) — รีเซ็ต tier ตาม level ปัจจุบัน
- ทุก passive เป็น **บัฟ XP/loot เท่านั้น** ไม่แตะพฤติกรรมจริงของ Claude Code
- **visual evolution**: แต่ละ tier มี sprite/สี/title ของตัวเอง (เก็บ asset key ใน config.json)

### 6.4 Balance ของ passive (กฎไม่ให้ "ตายสนิท")

ปัญหา: ถ้าเป็น full-stack เอียง BE แล้วไป Kernel Lich/Cloud Summoner เงื่อนไข specialist อาจแทบไม่ trigger เลย → up-class แล้วเหมือนแย่ลง 5 กฎที่กันเรื่องนี้:

1. **up-class ไม่มีทางแย่ลง** — base passive ติดทั้งสายและโต `+50%` ที่ Tier 4 ไม่ว่าจะเลือก branch ไหน specialist เป็นแค่ "บนยอด" ไม่เคยตัด base ทิ้ง ฉะนั้น Tier 4 ย่อมดีกว่า Tier 3 เสมอแม้ specialist ไม่ทำงานเลย
2. **EV matching** — ตั้งเป้าให้ specialist ทุก branch จ่าย XP เฉลี่ยใกล้กัน (เช่น ~10% ของ XP/active-hour) โดยคุม `payout × ความถี่ ≈ คงที่` → trigger บ่อยจ่ายทีละนิด, trigger นาน ๆ ครั้งจ่ายก้อนโต ผลรวมเท่ากัน
3. **Floor + pity** — ถ้า specialist ไม่ trigger เกิน N session reducer เติม "rusty bonus" เป็น general XP ส่วนหนึ่งกันตาย และ rare-trigger มี pity counter จ่ายแน่นอนเมื่อครบ
4. **Trigger ต้องกว้างพอ** — scope เงื่อนไข branch ให้ครอบงานที่ทำจริงบ่อย (เช่น Cloud Summoner นับ infra/CI/yaml ทั้งหมด ไม่ใช่เฉพาะ distributed system แท้ ๆ)
5. **Self-balance จากข้อมูลจริง** — เพราะมี backfill (§12) reducer auto-tune ค่า `xp` ต่อ trigger ให้ชน `ev_target_pct` ตามความถี่จริงของเราเอง → balance อัตโนมัติตาม playstyle (เอียง BE ก็ปรับให้ branch สาย FE ไม่ขาดทุน)

ตัวอย่าง config (reducer คำนวณ `xp` ให้เองจากความถี่ที่ observe ได้):

```jsonc
"specialists": {
  "cloud_summoner": { "trigger": "infra_touch",     "ev_target_pct": 10, "floor_after_sessions": 3 },
  "kernel_lich":    { "trigger": "perf_or_big_diff", "ev_target_pct": 10, "pity": 5 }
}
```

> ตัดสินใจที่ต้องเคาะ: (ก) branch lock ถาวรจริงไหม? (ข) checkpoint Lv.5/15/30/50 โอเคไหม? (ค) `ev_target_pct` เริ่มที่เท่าไร (10% สมเหตุผลไหม) และจะให้ reducer auto-tune เลยหรือ fix ค่าเอง?

### 6.5 สายลับ (secret classes) — กิมมิค

สายที่ **ไม่โผล่ในเมนูเลือก/แตกสายปกติ** ปลดผ่าน achievement (ส่วนใหญ่เป็นแบบ hidden §7.5) แล้วค่อยสลับเข้าได้ตอน respec เป็นของให้ค้นหา ไม่ใช่สายหลักที่ต้อง grind

**Flagship — Maestro (วาทยกร)** · ธีม: ควบคุมหลาย agent พร้อมกัน, สีทอง, โมทีฟไม้บาตอง
ปลดเมื่อ: ใช้ agent ต่าง source ≥3 ที่ level สูง (achievement `polyglot`)
กิมมิค passive: XP โบนัสตามจำนวน source/subagent ที่ active พร้อมกันใน session — ยิ่งวงใหญ่ยิ่งได้ (สะท้อนหัวใจ agent-agnostic ของระบบเราเอง §2.1)

| สายลับ | เงื่อนไขปลด (hidden achievement) | กิมมิค |
|---|---|---|
| Maestro | ใช้ ≥3 agent ต่าง source | XP ตามจำนวน agent/subagent ที่รันพร้อมกัน |
| Night Owl | activity ดึกสะสม (เช่น 00:00–04:00 หลาย session) | บัฟ XP ช่วงดึก + costume เรืองแสง |
| The Ascetic | ถึง Lv.20 โดย ratio `run` ต่ำมาก (เน้น read/edit) | loot rate สูงตอนทำงานแบบไม่รันคำสั่ง (สาย minimalist) |
| The Gremlin | `failures_recovered` สูงมาก | XP ก้อนโตทุกครั้งที่กู้จาก fail |
| ??? | easter egg: คำสั่งลับ `/rpg xyzzy` หรือซีเควนซ์ลับ | legendary cosmetic ล้วน (มุก) |

กติกา:
- **โชว์เป็น "???" + ใบ้กว้าง ๆ พร้อมแถบความคืบหน้า** เมื่อเข้าใกล้เงื่อนไข (ตัดสินแล้ว — กระตุ้นให้ลอง) ยกเว้น easter egg บางตัวซ่อนสนิทไว้ให้เซอร์ไพรส์
- ปลดแล้วสลับเข้าได้ผ่าน respec เหมือนสายปกติ
- **ใช้กลไก tier เหมือนสายหลัก แต่ content เบา** — base passive ของสายลับไต่ `+20→50%` ตาม Lv.5/15/30/50 เพื่อให้ respec เข้าตอน level สูงไม่ด้อยลง (กฎ §6.4) และ tier คำนวณจาก level ปัจจุบันเหมือน respec ปกติ (§6.3)
- **costume วิวัฒนาการแบบเบา** — เปลี่ยนสี/เอฟเฟกต์ต่อ tier แทนวาด sprite ชุดใหม่ทั้งหมด (ลดงาน art)
- **ไม่มี branch ที่ Tier 4** — signature gimmick คือเอกลักษณ์ของสายลับเอง และ gimmick นั้น scale ขึ้นต่อ tier (เช่น Maestro: ตัวคูณ XP ต่อ agent ที่รันพร้อมกันโตขึ้นทุกขั้น)
- ใช้ schema `class` เดิม (line/tier/path) โดย `branch` คงเป็น null ถาวร
- passive คุมตามกฎ §6.4 ให้เป็น "เฉพาะทาง/สนุก" ไม่ใช่ must-have จะได้ไม่ทำให้สายหลักด้อยลง
- นิยามสายลับ + เงื่อนไขอยู่ใน config.json (เพิ่มสายลับใหม่ได้โดยไม่แตะโค้ด)

---

## 7. ระบบรางวัล — Loot + Achievement

### 7.1 Rarity

`common` → `rare` → `epic` → `legendary`

### 7.2 Trigger การดรอป

| Trigger | ผล |
|---|---|
| session จบแบบ 0 error | roll drop (ส่วนใหญ่ common) |
| refactor ใหญ่ (lines_added > 200) | roll (rare+) |
| test suite ผ่านทั้งชุด | การันตี common ขึ้นไป |
| ปิด streak milestone (7/30/100 วัน) | epic+ |
| PR merged (ตรวจจาก git ใน Bash) | rare+ |
| level up | roll พิเศษตาม level |

### 7.3 ประเภทไอเทม

- **Cosmetic** — title, สกินตัวละคร, ธีมสี statusline/HUD (ปลอดภัยสุด แนะนำเป็นหลัก)
- **Buff** — เช่น `double_xp_potion` ใช้แล้วได้ตัวคูณ XP ชั่วคราว (เก็บใน `buffs[]` มีวันหมดอายุ)

> ตัดสินใจที่ต้องเคาะ: ให้ loot เป็น cosmetic-only หรือมี buff ด้วย? — แนะนำเริ่มจาก cosmetic ก่อน ลดความซับซ้อนของ balance

### 7.4 Achievement — ภาพรวม

เป็นระบบ **เก็บสะสม** (collection): ปลดแล้วได้ points + reward และโชว์ความคืบหน้ารวม (เช่น 23/80 ปลดแล้ว)

- **data-driven** — นิยามทั้งหมดอยู่ใน `config.json` (registry) เพิ่ม/แก้/ปรับเกณฑ์ได้โดยไม่แตะโค้ด ที่ปลดแล้วเก็บใน `state.json`
- **ประเมินโดย reducer** — หลังพับ journal ทุกครั้ง reducer เช็คเงื่อนไขจาก stats/events (idempotent — recompute จาก source ได้เสมอ) ปลดแล้ว set flag + (optional) toast ที่ HUD/แอป
- **reward** — title, cosmetic, loot roll, XP bonus และบางอัน **ปลดสายลับ** (§6.5)

### 7.5 ประเภท achievement

- **Milestone** — สะสมถึงเกณฑ์ (action 1,000 / Lv.25 / 100 sessions)
- **Mastery** — ต่อสาย (ขึ้น Tier 4, ครบทุกสาย)
- **Streak** — ต่อเนื่อง (7/30/100 วัน)
- **Exploration** — กว้าง (ใช้ ≥N source ต่างกัน, แตะ ≥N repo)
- **Secret/Easter-egg** — `hidden` โชว์เป็น "???" จนปลด บางอัน `unlocks_class` (สายลับ)

### 7.6 schema

registry ใน `config.json`:

```jsonc
"achievements": {
  "first_blood":     { "name": "First Blood", "desc": "action แรก", "cond": { "stat": "actions_total", "gte": 1 }, "points": 5, "reward": { "title": "Rookie" } },
  "tooling_1000":    { "name": "Tooling Up", "desc": "ใช้ tool ครบ 1,000", "cond": { "stat": "actions_total", "gte": 1000 }, "points": 10 },
  "flawless":        { "name": "Flawless", "desc": "จบ session ไม่มี fail", "cond": { "event": "session_zero_fail" }, "points": 15, "reward": { "loot_roll": "rare" } },
  "all_tier4":       { "name": "Master of All", "desc": "ขึ้น Tier 4 ครบทุกสาย", "cond": { "all": [/* ... */] }, "points": 50 },
  "polyglot":        { "name": "Polyglot", "desc": "ใช้ 3 agent ต่างกัน", "cond": { "distinct": "source", "gte": 3 }, "points": 25, "hidden": true, "unlocks_class": "maestro" }
}
```

ที่ปลดแล้วใน `state.json` (ดู §4.2):

```jsonc
"achievements": {
  "earned": [ { "id": "first_blood", "at": "2026-05-01T10:00:00Z", "source": "claude-code" } ],
  "points": 120,
  "progress": { "tooling_1000": 388 },        // ความคืบหน้าของที่ยังไม่ปลด (โชว์ bar)
  "unlocked_secret_classes": ["maestro"]
}
```

ชนิดเงื่อนไข (`cond`): `stat`+`gte/lt` (เกณฑ์สะสม), `distinct`+`gte` (นับชนิดไม่ซ้ำ เช่น source/repo), `ratio`+`lt/gt` (สัดส่วน action), `streak`+`gte` (วันต่อเนื่อง), `event` (flag ที่ reducer คำนวณ เช่น session ไร้ fail), และ `all`/`any` (composite)

---

## 8. Claude Code adapter (reference impl, จุดเสี่ยงสูงสุด)

> นี่คือ adapter **ตัวแรก** ตามกรอบ §2.1 — มันแปลงสัญญาณของ Claude Code เป็น normalized event (§2.2) แล้วเขียนลง journal กลาง adapter ของ agent อื่นทำหน้าที่เดียวกันด้วยกลไกของตัวเอง

### 8.1 Event ที่ใช้ (→ map เป็น action)

Claude Code ยิง hook event เป็น 3 จังหวะ:

- **ต่อ session**: `SessionStart`, `SessionEnd`
- **ต่อ turn**: `UserPromptSubmit`, `Stop`, `StopFailure`
- **ต่อ tool call**: `PreToolUse`, `PostToolUse` (และ `PostToolUseFailure`, `SubagentStop`)

แมปกับเกม:

| Event | สคริปต์ | เขียน event (normalized) |
|---|---|---|
| `UserPromptSubmit` | on-prompt.sh | `prompt` |
| `PostToolUse` | on-tool.sh | `action` (map `tool_name` → abstract action §2.2) |
| `PostToolUseFailure` | on-tool.sh | `action_fail` |
| `Stop` | on-stop.sh | `turn_end` |
| `SessionEnd` | on-session-end.sh | `session_end` + อ่าน cost/transcript |

### 8.2 รูปแบบ config ใน settings.json

```jsonc
{
  "hooks": {
    "PostToolUse": [
      { "matcher": "Edit|Write|Bash|Read|Grep|Glob|Task",
        "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-tool.sh" } ] }
    ],
    "UserPromptSubmit": [
      { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-prompt.sh" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-stop.sh" } ] }
    ]
  },
  "statusLine": { "type": "command", "command": "node ~/.agentrpg/lib/statusline.mjs", "padding": 0 }
}
```

`matcher` เป็น regex ที่จับกับชื่อ tool ดิบของ CC — สคริปต์เป็นคน map เป็น abstract action

### 8.3 กฎเหล็กของ hook script

1. **ห้าม print ออก stdout ใน `UserPromptSubmit` / `SessionStart`** — stdout ของสอง event นี้ (รวม `UserPromptExpansion`) จะถูก Claude Code เอาไปเติมเป็น context ให้โมเดลเห็น ตัวนับ XP ต้องเขียนลงไฟล์เงียบ ๆ เท่านั้น
2. **error ส่งไป stderr แล้ว `exit 0`** — exit 0 = ผ่าน, exit 2 = blocking error (จะไปขัดการทำงานจริง — ห้ามเด็ดขาดสำหรับตัวนับแต้ม)
3. **เร็วและเบา** — แค่ append 1 บรรทัดต่อท้าย journal, อย่ายิง network/อย่ารัน reducer ในนี้
4. **resume ระวัง** — `--continue`/`--resume` จะ replay stdout ของ hook กลางทางที่เคยบันทึกไว้ ไม่ได้รันใหม่ ค่าอย่าง timestamp/commit จะ stale — อีกเหตุผลที่ตัวนับไม่ควร print อะไร

> 3 ข้อแรกเป็นข้อจำกัดเฉพาะ Claude Code (เพราะ hook inject context ได้) adapter อื่นมีข้อควรระวังของตัวเอง แต่หลัก "เบา/ไม่ขัดการทำงานจริง/append เท่านั้น" ใช้ร่วมกันทุก adapter

ตัวอย่าง on-tool.sh (map native → action แล้ว emit):

```bash
#!/usr/bin/env bash
input=$(cat)                       # JSON จาก stdin
tool=$(echo "$input" | jq -r '.tool_name // "unknown"')
sid=$(echo "$input"  | jq -r '.session_id // "unknown"')
case "$tool" in                    # native → abstract action (§2.2)
  Edit) action=edit;; Write) action=write;; Bash) action=run;;
  Read) action=read;; Grep|Glob) action=search;; Task) action=delegate;;
  *) action=other;;
esac
mkdir -p ~/.agentrpg/journal
printf '{"ts":"%s","source":"claude-code","session_id":"%s","type":"action","action":"%s","native":"%s"}\n' \
  "$(date -u +%FT%TZ)" "$sid" "$action" "$tool" \
  >> ~/.agentrpg/journal/"$sid".ndjson
exit 0                             # ไม่ print stdout
```

---

## 9. Statusline HUD

### 9.1 ข้อมูลที่ Claude Code ส่งให้ (stdin, JSON)

`session_id`, `transcript_path`, `cwd`, `model.{id,display_name}`, `workspace.{current_dir,project_dir}`, `version`, `cost.{total_cost_usd,total_lines_added,total_lines_removed,...}` และ context window usage (`used_percentage`)

> หมายเหตุ: ฟิลด์ usage บางตัวเป็น null ก่อน API call แรก และหลัง `/compact` จนกว่าจะ call ใหม่ — ต้องใส่ fallback

### 9.2 สิ่งที่ HUD แสดง

```
Lv.12 ⚔ Backend Mage  ███████░░░ 25%  🔥5d  🎒 x3   |  Sonnet 4.6  $0.42
```

- level + ไอคอนสาย
- แถบ XP (filled blocks ▓/█ ตาม xp_in_level/xp_to_next)
- streak, จำนวน item ใน inventory
- ต่อด้วยข้อมูลปกติ (model, cost) ที่ statusline มีอยู่แล้ว

### 9.3 "อนิเมชั่น" ใน terminal

statusline เป็น text/ANSI เท่านั้น ทำได้แค่ pseudo-animation:
- วนเฟรม spinner/ตัวละคร ASCII เล็ก ๆ (statusline re-render บ่อยตอน active)
- ตอน level up: statusline.mjs อ่าน flag `level_up_pending` ใน state แล้วโชว์แถบเด้ง/สี flash ชั่วคราว 1–2 วินาที แล้วเคลียร์ flag
- เอฟเฟกต์ตัวละครเดิน/level-up จริง ๆ ไปอยู่ที่ companion app

---

## 10. Companion app (Next.js)

### 10.1 หน้าที่

โชว์ตัวละครอนิเมชั่น, แถบ XP, skill tree (สาย), inventory/loot, achievement, กราฟสถิติการใช้งาน

### 10.2 สะพานเชื่อม state.json → browser

3 ทางเลือก:

1. **Local daemon + SSE/WebSocket (แนะนำ)** — process เล็ก ๆ (Node/Bun) `fs.watch`/chokidar จับการเปลี่ยนของ `state.json` แล้ว push ผ่าน SSE ให้ client → ได้อนิเมชั่น real-time ตอน XP/level เปลี่ยน
2. **Next.js API route + polling** — client poll ทุก ~2s, API route อ่านไฟล์ ง่ายสุดแต่ไม่เนียนเท่า
3. **Tauri/Electron overlay** — อ่านไฟล์ตรง ทำเป็น desktop pet/overlay ลอยมุมจอ

### 10.3 อนิเมชั่นตัวละคร — โมเดล AFK farming (ปรับ 2026-06-12)

ใช้ **โมเดล idle/AFK แบบเกมมือถือ** ไม่ map ทุก tool เป็นท่าเฉพาะ — แค่ **3 สเตตหลัก**:

| สเตต | trigger | ภาพ |
|---|---|---|
| **farming** | มี activity (agent กำลังทำงาน) | ตัวละครฟาร์มมอนสเตอร์ลูป |
| **idle** | ไม่มี activity | ยืนเฉย |
| **rest** | จบ session | กลับโรงเตี๊ยม/นั่งพัก |

- **ทำไม:** renderer เบา (3 สเตต ไม่ต้องคิวท่า edit→ร่ายเวท/run→ระเบิดแยก), **pacing หายเป็นปัญหา** (ไม่ต้องคิวท่าตาม tool รัว ๆ), เข้ากับ MVP throttle — รู้แค่ "active ไหม" ก็พอ ไม่ต้องรอ daemon push ทีละ event
- **ความลึกไม่หาย — แยกภาพออกจากตัวเลข:** animation เหมารวม แต่ **XP / class affinity (§6.4) / loot ยังคิดจาก event/action จริงใน reducer เหมือนเดิม** ความลึกอยู่ที่ "ตัวเลขที่ไหลเข้า" ไม่ใช่ "ท่าที่ต่างกัน"
- **active signal:** reducer เก็บ `last_event { ts, type }` (event ล่าสุด — deterministic/idempotent) แล้ว **app ตัดสินสเตตเอง** ด้วย pure fn `activityState(lastEvent, now, window≈60s)` + client timer (reducer ไม่ยุ่งกับ wall-clock)

**ฉาก + มอนสเตอร์ = reward ภาพ ผูกกับ tier** (เติม "ของให้รอ" ให้โมเดล AFK) — ผูก **tier ไม่ใช่ทุก level** (level มี 50, tier มี 5):

| tier | ฉาก (ธีม/ความอลัง) | มอนสเตอร์พื้น |
|---|---|---|
| Novice/T1 | ทุ่งหญ้าหน้าเมือง | bug slime ตัวเล็ก |
| T2 | ป่า / ถ้ำ | error wraith |
| T3 | ดันเจียน | มอนสเตอร์ใหญ่ |
| T4a/T4b | แดนลับเฉพาะ branch (Cloud=ลอยฟ้า, Kernel=ถ้ำมืด circuit) | มอนสเตอร์ราชา/บอสประจำแดน |

- **ฉากคุมด้วย tier อย่างเดียว ไม่ผูก repo** — repo คาดเดาไม่ได้ว่าทำอะไร + มักหลาย repo พร้อมกัน เอามากำหนดฉากจะมั่ว. `repo` เก็บเป็น **สถิติ** (`by_repo` §4.2) ได้ แต่ไม่กำหนดภาพ
- **มอนสเตอร์:** tier = ระดับพื้น (สูง = แข็งขึ้น) · **`action_fail` = บอส/มอนพิเศษโผล่แทรก** (bug ที่ต้องแก้) → recover/test ผ่าน = ล้มบอส ได้ XP ก้อน + โอกาส loot (ผูกงานจริงแบบเบา ไม่ต้องมี combat layer เต็ม)
- **up-class = moment ใหญ่ "ย้ายโลก"** — ไม่ใช่แค่เปลี่ยนชุด แต่เปลี่ยนฉาก+มอนทั้งชุด (branch T4 a/b คนละแดน = เหตุผลให้อยากเห็นทั้งคู่, เชื่อม §6.2 branch lock ถาวร)
- stack: **React + Vite + TS** (workspace `app/` แยก, §10.2/Phase 3.1) · sprite จาก PixelLab (`art-prompts.md`) swap หลัง placeholder · roll-out: 3.2a (ฉาก+3 สเตต+tier-swap) → 3.2b (boss/loot-drop/up-class transition) → 3.2c (แดนลับ branch)

### 10.4 ฝังใน VS Code (อยู่ใกล้ที่ทำงาน)

terminal tab ใส่ได้แค่ text/ANSI (TUI) — sprite animation จริงไม่เวิร์ค จึงไม่ใช้ terminal แต่เอาแอปเข้า VS Code ได้ 3 ทาง เรียงตามความง่าย:

1. **Simple Browser (เร็วสุด, ไม่ต้องเขียน extension)** — รัน Next.js บน localhost แล้ว command palette → `Simple Browser` → วาง URL → แอปโผล่เป็น editor tab ใน VS Code ลากแปะคู่โค้ดได้ เหมาะกับ Phase 3 ตอนเริ่ม (ใช้ของเดิมทั้งหมด ไม่ต้องทำเพิ่ม)
2. **VS Code extension + Webview view (เนียนสุด)** — contribute webview view เข้า panel container → โผล่เป็น **tab ข้าง ๆ Terminal/Problems/Output** (หรือจะเป็น sidebar/editor tab ก็ได้) extension อ่าน `state.json` แล้วส่งเข้า webview ด้วย `postMessage`, ตั้ง `retainContextWhenHidden: true` กัน state หายตอนสลับ tab — โครง state.json + daemon/SSE เดิมใช้ต่อได้
3. **Tauri/Electron overlay** — แยกหน้าต่างลอยมุมจอ (ไม่อยู่ใน VS Code)

> แนะนำ: ดู §10.5 — มี extension ที่ทำเลเยอร์ rendering/office เสร็จแล้ว ใช้เป็นเปลือกได้เลย

### 10.5 ทางลัด: fork "Pixel Agents" (แนะนำ)

Pixel Agents (Pablo De Lucca, MIT — `github.com/pablodelucca/pixel-agents`) เป็น VS Code extension ที่ทำเลเยอร์ที่ยากที่สุดเสร็จแล้ว: เปลี่ยน Claude Code แต่ละ terminal เป็นตัวละคร pixel ในออฟฟิศ เดิน/นั่งโต๊ะ/อนิเมชั่นตามกิจกรรม โดย **watch `~/.claude/projects/` JSONL** (ตัวเดียวกับดีไซน์เรา) แบบ observational ไม่แตะ Claude Code — เป็น webview ใน panel ล่างข้าง Terminal พอดี

มี layout editor, furniture catalog, persistent layout, speech bubble, 6 ตัวละคร อยู่แล้ว สิ่งที่ **ยังไม่มี** คือเลเยอร์ RPG ของเรา (XP/level/สาย/loot/streak) = ส่วนที่เราเติม

แมประบบเราเข้าของเขา:

| ดีไซน์เรา | Pixel Agents |
|---|---|
| agent = 1 session (journal ต่อ session, multi-account §11) | หนึ่ง terminal = หนึ่งตัวละคร |
| Costume = class tier (up-class → เปลี่ยนชุด) | ปุ่ม Costume |
| loot = เฟอร์นิเจอร์/ของแต่งห้อง | furniture catalog + layout editor |
| HUD level/XP/usage | ปุ่ม Usage + speech bubble |
| Tasks (ผูก Plane/GitHub) | ปุ่ม Tasks |

2 ทางสร้างต่อ:
1. **Fork extension** (MIT) — ใช้เป็นเปลือก บอลต์ journal→reducer→state.json + progression เข้าไป
2. **Standalone web fork** (`rolandal/pixel-agents-standalone`) — รันเป็น web app (Express + WebSocket, watch `~/.claude/projects/`, ใช้ SessionStart hook) ไม่ต้องมี VS Code → ตรงกับดีไซน์ daemon + SSE ของเรา (§10.2)

ข้อควรรู้: extension เป็น MIT (fork ได้) แต่ furniture catalog เต็มเป็น tileset ซื้อแยก (~$2 itch.io) ของฟรีมีเฟอร์นิเจอร์พื้นฐาน

**ผลต่อ roadmap:** Phase 3 ไม่ต้องเขียน renderer/pathfinding/office เอง เหลือแค่ต่อ data layer (journal + reducer + state.json) ที่ออกแบบไว้แล้ว เข้ากับ rendering/costume/furniture ของ Pixel Agents

---

## 11. Concurrency / หลาย instance / หลาย agent

มีหลายแหล่งเขียนพร้อมกัน: หลาย Claude Code instance (เช่นรันหลาย account ผ่าน `CLAUDE_CONFIG_DIR`), หลาย agent (CC + Codex พร้อมกัน), และ generic emit

วิธีกัน race โดยไม่ต้อง lock:
- ทุกแหล่ง **เขียนแต่ journal ของ session ตัวเอง** (`journal/{session_id}.ndjson`) แบบ append-only — ไม่มีใครเขียนไฟล์เดียวกัน (`source` ใน event บอกว่ามาจาก adapter ไหน)
- `state.json` ถูกสร้างโดย **reducer ตัวเดียว** ที่อ่าน journal ทั้งหมดมาพับรวม (idempotent — รันกี่ครั้งผลเท่ากัน เพราะคำนวณจาก event ดิบ) และแยกสถิติ `by_source` ได้
- reducer รันได้ 2 จังหวะ: (ก) statusline เรียกแบบ throttle (เช่นไม่เกินทุก 2s) หรือ (ข) daemon คอย watch โฟลเดอร์ journal

> append-only + recompute จาก source of truth ทำให้รวม XP ข้าม agent/account เป็นตัวละครเดียว หรือทำ leaderboard ต่อ source ได้ง่าย

---

## 12. Backfill จาก log เก่า (ต่อ adapter)

แต่ละ adapter มี importer ของตัวเองที่อ่าน log เก่าของ agent นั้น แปลงเป็น normalized event แล้วป้อนเข้า reducer → "import การ grind ที่ผ่านมา" ได้ level เริ่มต้นตามการใช้งานจริง (ไม่เริ่มจาก 0 น่าเบื่อ) และใช้เก็บค่าจริง (XP/active-hour) ไปจูน curve (§5.2)

- **Claude Code importer** — อ่าน `~/.claude/projects/{encoded-cwd}/{session-id}.jsonl` (มี message, tool use, token — ตัวเดียวกับที่ ccusage อ่าน)
- **adapter อื่น** — อ่าน log/history ของ agent นั้น ๆ ตามรูปแบบของมัน
- ถ้าไม่มี log ย้อนหลัง — ข้าม backfill เริ่มที่ Lv.1 ได้

---

## 13. Roadmap

| Phase | ขอบเขต | ผลลัพธ์ |
|---|---|---|
| 0 | normalized event schema + journal + **CC adapter** (on-prompt/on-tool) แค่ log event | มี data ไหลเข้า |
| 1 | reducer + statusline HUD (level + XP bar + สาย) | เล่นได้จริงใน terminal |
| 2 | loot + class selection + streak + achievement + secret class | ครบความเป็นเกม |
| 3 | fork Pixel Agents เป็นเปลือก (§10.5) + ต่อ state.json → costume/furniture/HUD | ตัวละครขยับ + โชว์ progression |
| 4 | importer (backfill) + concurrency merge + leaderboard | สมบูรณ์ |
| 5 | **generic emit + adapter ตัวที่ 2** (Codex/Cursor) | agent-agnostic จริง |

แนะนำ Phase 0–1 ทำเป็น MVP รวดเดียว (ภายในวันเดียว) — ทำ CC adapter ตัวเดียวก่อน อย่าเพิ่งทำหลาย adapter ความ agent-agnostic อยู่ที่ "ออกแบบ event ให้ถูก" ตั้งแต่ Phase 0 ส่วน adapter ตัวที่ 2 ค่อยมาทีหลัง (Phase 5) โดยไม่ต้องแก้ game logic

---

## 14. Decision log

**ล็อกแล้ว (กระทบโค้ด Phase 0):**

1. **ภาษา** — hook = bash+jq (hot path, startup ~0), ส่วนที่เหลือ (reducer/statusline/importer/bridge) = **Bun**
2. **ขอบเขต XP** — **global หนึ่งตัวละคร** + เก็บสถิติแยกต่อ repo (`repo` ใน event §4.1, `by_repo` ใน stats §4.2)

**รับ default ไปก่อน (config — จูน/เปลี่ยนทีหลังได้):**

3. **loot** — cosmetic-only ตอนเปิด (เติม buff ทีหลัง)
4. **ตรวจ test/PR** — match คำสั่ง (`go test`/`vitest`/`jest`/`pytest`/`gh pr merge`) แล้วค่อยขัดความแม่น
5. **reducer** — MVP เรียกจาก statusline แบบ throttle; เพิ่ม daemon ตอน Phase 3
6. **branch Tier 4** — lock ถาวร, ปลดด้วย item หายาก
7. **checkpoint** — Lv.5/15/30/50
8. **curve** — `7·L^2.5` (ใช้หนัก ~1 เดือน)
9. **ev_target_pct** — 10% fix ก่อน, เปิด auto-tune หลัง backfill
10. **prestige/season** — พัก post-launch

**ยังเปิด (ไม่ blocking):**

11. **adapter ตัวที่ 2** — Codex / Cursor / Gemini CLI / generic emit (ตัดสินตอน Phase 5)

---

## อ้างอิง (official docs ที่ควรเปิดควบ)

- Claude Code — Hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code — Statusline: https://code.claude.com/docs/en/statusline
- Claude Code — Overview/docs: https://docs.claude.com/en/docs/claude-code/overview

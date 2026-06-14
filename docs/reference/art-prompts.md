# Commit Quest — Art & Image-Gen Prompt Pack

*เครื่องมือหลัก: PixelLab Character Creator · sprite ฐาน 48×48 · workflow = gen ตัวฐานครั้งเดียวแล้ว derive ที่เหลือ (ไม่ regen)*

---

## 1. ตั้งค่า + palette

ตั้งค่าฟอร์ม Character Creator **เหมือนกันทุกตัว** (นี่คือกุญแจความสม่ำเสมอ — px คุมที่ช่อง ไม่ใช่ข้อความ):

- Camera View: **Low Top-Down**
- Sprite Size: **48×48** (Width/Height = 48)
- Detail: **Highly detailed**
- Outline: **Black outline**
- ถ้ามีช่อง negative ("what should not be in the image"): `blurry, 3d, realistic, extra limbs, text, watermark` — ถ้าไม่มี (อย่าง Character Creator) ก็ข้ามได้

**palette ต่อสาย:** Mage ม่วง(+ทอง) · Ranger เขียวอมฟ้า(teal) · Rogue ส้มแดง(coral) · Sage เหลืองอำพัน(amber) · สายลับ: Maestro ทอง / Night Owl คราม / Ascetic ขาวหิน / Gremlin เขียว glitch

---

## 2. Workflow — gen ครั้งเดียว แล้ว derive

PixelLab เซฟตัวละครไว้ ฉะนั้น **ไม่ต้อง regen** (regen = สุ่ม ไม่เหมือนเดิม) — สร้างตัวฐานครั้งเดียวแล้วต่อยอด:

1. **gen ตัวฐาน (T1) 1 ครั้ง** จาก prompt เต็มในข้อ 4 → ได้ south-facing + rotate 8 ทิศ → เซฟ
2. **tier ถัดไป = Create State** วางเฉพาะส่วน `dressed as...` ของ tier นั้นลงช่อง "Describe the new state" → คนเดิม เปลี่ยนชุด ใช้เหมือนกันทั้ง 8 ทิศ
   - checkbox "Use color palette from reference": **อย่าติ๊ก** ถ้าเพิ่มสีใหม่ (ทอง/ไซแอน); ติ๊กถ้าแค่เปลี่ยนท่าไม่เพิ่มสี
3. **idle/walk/work = Add Animation** (Idle, Walking; งานพิมพ์ใช้ Custom Animation)
4. clean ใน Pixelorama (ฟรี) หรือ Aseprite

> credit: Create State 20–40/ครั้ง + Add Animation กินแยก → ทำ **Mage สายเดียวให้ครบ loop ก่อน** วัด credit จริง แล้วค่อยตัดสินใจลุยสายอื่น

---

## 3. Animation states ที่ต้องมี (Add Animation)

| state | Add Animation type | ใช้ตอน |
|---|---|---|
| idle | Idle | ยืนเฉย |
| walk | Walking | เดินในออฟฟิศ |
| work / type | Custom (typing) | edit / write |
| read | Custom / Idle variant | read / search |
| level-up | Custom (one-shot) | อัปเลเวล |
| celebrate | Custom (one-shot) | ปลด achievement / up-class |

เริ่มแค่ **idle + walk + work** ก็พอเอาตัวละครเข้า Pixel Agents ได้ ที่เหลือเติมทีหลัง

### 3.1 Combat animations (Phase 3.5 — required for the AFK combat loop)

The companion's combat choreography (`app/src/use-combat.ts`) cycles these states. Until real
sheets land they are CSS/emoji placeholders; swap by editing `styles.css` (`.hero-*` / `.m-*`
keyframes and the `.sprite` `background-image`).

| Character | Animation | Type | Frames | Used when |
|---|---|---|---|---|
| Hero | idle | loop | 2–4 | default / farming between beats |
| Hero | attack (cast) | one-shot | 4–6 | each real XP gain |
| Hero | hurt | one-shot | 2–3 | on a real failure (`action_fail`) |
| Hero | celebrate | one-shot | 6–8 | level-up |
| Hero | walk | loop | 4–6 | *deferred:* monster-approach / world-transition |
| Monster | idle / float | loop | 2–4 | default |
| Monster | hurt | one-shot | 2–3 | hit by an XP beat |
| Monster | attack | one-shot | 4 | bites back on a failure |
| Monster | die | one-shot | 4–6 | cosmetic HP empty → respawn |
| Monster | spawn / approach | one-shot | 4 | *deferred* |

(Boss already has hit + flee from 3.2b.)

---

## 4. ตัวละคร — ทุกสาย ทุก tier

### 4.A constants + identity ต่อสาย

**constants** (เหมือนกันหมดทุกตัว — อยู่ในครึ่งหน้าของทุก prompt):
`adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline`

**identity ต่อสาย** (ต่างกัน = คนละคน · คงที่ภายในสายนั้นทุก tier):

| สาย | identity |
|---|---|
| Mage | a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes |
| Ranger | an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair |
| Rogue | a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow |
| Sage | a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses |

**วิธีใช้:** T1 = prompt เต็ม (gen ตัวฐาน) · T2–T4 = วางเฉพาะครึ่งหลัง `dressed as...` ลง Create State (ข้อ 2)
ตั้งค่าฟอร์มทุกตัว: **Low Top-Down · 48×48 · Highly detailed · Black outline**

---

### 4.1 Mage — Backend · purple · ไม้เท้า + server-crystal
arc: เด็กฝึก → พ่อมดเซิร์ฟเวอร์ → อัครมหาเวท → (สายเมฆ / สายเนโครเคอร์เนล)

**T1 — Backend Mage**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an apprentice backend wizard: muted purple hooded robe with thin gold trim, holding a plain wooden staff topped with a small glowing teal terminal-crystal, limited purple palette
```
**T2 — Server Sorcerer**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a backend sorcerer: deeper purple robe with gold rune-embroidered hem, a taller staff topped with a small floating server node, a faint glowing rune circle at the feet, limited purple palette
```
**T3 — Infra Archmage**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a backend archmage: rich purple robe with a shoulder mantle and gold rune trim, several small server-crystals orbiting overhead, a glowing rune halo behind the head, staff crowned with a bright teal data-orb, deep purple and gold palette
```
**T4a — Cloud Summoner** (สายเมฆ / distributed)
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a cloud-summoner archmage: airy sky-violet robes with a wispy cape, standing on swirling cloud mist, glowing teal hexagonal container glyphs floating and orbiting around, light sky-violet palette
```
**T4b — Kernel Lich** (สาย performance / low-level)
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a kernel-lich archmage: dark hood shadowing the face, deep black-purple robe with cold cyan circuit-veins glowing across it, holding a dense black core-orb, dark purple and cyan palette
```

---

### 4.2 Ranger — Frontend · teal · ธนูสาย-slider
arc: นักธนูฝึก → มือแม่นปืน → นักล่าพิกเซล → (สายโมชั่น / สายผู้คุมดีไซน์)

**T1 — Frontend Ranger**
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a frontend ranger: light teal tunic and hooded scarf, holding a short bow whose string glows like a UI slider, a small quiver, limited teal palette
```
**T2 — UI Sharpshooter**
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a UI sharpshooter: fitted teal outfit with a targeting visor, a refined longbow, a quiver of glowing UI-component arrows, a faint targeting reticle, teal and white palette
```
**T3 — Pixel Hunter**
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a pixel hunter: layered teal cloak, a glowing bow in one hand and a light-stylus in the other, a HUD-like glowing crosshair framing the character, full quiver, teal and cyan palette
```
**T4a — Motion Trickster** (สาย interaction / animation)
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a motion trickster: sleek teal-cyan outfit caught mid-motion, trailing afterimage blur and streaking motion particles, bright teal-cyan palette
```
**T4b — Design Warden** (สาย design system / token)
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a design warden: stately teal robes, carrying a shield made of a UI grid of color swatches, a belt of design-token color chips, teal with controlled swatch accents
```

---

### 4.3 Rogue — Debugger · coral · มีด + แว่นขยาย
arc: โรกฝึก → นักลอบสังหารบั๊ก → นักสะกดรอยสแต็ก → (สายล่าไฮเซนบั๊ก / สายนิติเวช)

**T1 — Debugger Rogue**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a debugger rogue: dark hooded cloak with coral-red accents, a small dagger in one hand and a magnifying glass in the other, a tiny cartoon bug nearby, dark with coral palette
```
**T2 — Bug Assassin**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a bug assassin: sleek dark gear with a coral mask over the lower face, twin daggers, a small captured-bug jar on the belt, dark coral palette
```
**T3 — Stack Stalker**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a stack stalker: cloaked in layered shadow, a glowing coral stack-trace thread trailing from one hand, a scanning visor, several bug-jars on the belt, dark coral palette
```
**T4a — Heisenbug Hunter** (สาย flaky / race)
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a heisenbug hunter: rogue gear flickering half-translucent and glitching in places, coral and glitch-cyan distortion particles, coral and cyan palette
```
**T4b — Forensics Shadow** (สาย log / observability)
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a forensics shadow: a long investigator coat, a glowing magnifier, floating log-scroll and timeline ribbons orbiting, small evidence tags, coral and amber palette
```

---

### 4.4 Sage — Architect · amber · ตำรา + พิมพ์เขียว
arc: ปราชญ์ → ผู้หยั่งรู้ระบบ → เมไจแห่งแพตเทิร์น → (สายผู้พยากรณ์โดเมน / สายผู้บัญชาการ)

**T1 — Architect Sage**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an architect sage: amber-trimmed robe, holding an open glowing tome and blueprint scroll, limited amber palette
```
**T2 — System Oracle**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a system oracle: grander amber robe, a glowing forehead gem like a third eye, a floating constellation diagram hovering above an open tome, amber palette
```
**T3 — Pattern Magus**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a pattern magus: robe with geometric pattern embroidery, floating sacred-geometry pattern glyphs orbiting, a quill-staff of light, amber and gold palette
```
**T4a — Domain Prophet** (สาย modeling / DDD)
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a domain prophet: flowing robes, a constellation of linked entity-relation nodes forming a halo around the head, amber and soft white palette
```
**T4b — Orchestration Master** (สาย agent-teams)
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an orchestration master: amber robes, glowing amber threads connecting from the hands to small floating familiar-sprites arranged around, amber with multi-color thread accents
```

---

### 4.5 สายลับ (secret) — 1 ตัวฐานต่อสาย, tier = เพิ่ม glow/สีเข้มผ่าน Create State

แต่ละสายลับเป็นคนละคน (identity เฉพาะ) gen ตัวฐาน 1 ครั้ง แล้ว tier สูงขึ้น = ใช้ Create State เพิ่มแสง/อนุภาค/สีเข้มขึ้น (ไม่ทำ 4-tier เต็มเหมือนสายหลัก — ดู design §6.5)

**Maestro** (gold · flagship)
```
an elegant senior engineer around 35, commanding graceful presence, refined build, deep brown skin, neat dark hair, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a maestro: a gold tailcoat, holding a glowing baton, small floating agent-orbs orbiting like an orchestra, gold palette
```
**Night Owl** (indigo)
```
a calm night-shift coder around 29, sleepy focused expression, slender build, fair skin, dark hair with a single pale streak, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a night owl: an indigo cloak, a small glowing owl familiar on the shoulder, a crescent-moon motif and faint starlight glow, indigo palette
```
**The Ascetic** (off-white / stone)
```
a serene minimalist coder, adult, calm meditative expression, lean build, medium skin, shaved head, slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an ascetic: plain undyed robes, barefoot, prayer beads, a single floating glyph above an open palm, off-white and stone palette
```
**The Gremlin** (glitch-green)
```
a mischievous tiny imp-like coder (not human), wide grin, small chaotic build, green-tinted skin, slightly stylized proportions, full body head-to-toe, centered, clean 1px black outline —
dressed as a gremlin: patched-up gear, electric sparks and glitch artifacts around it, glitch-green palette
```
**??? — Sir Quacks-a-lot** (easter egg)
```
a heroic rubber duck (not human) wearing tiny knight armor and a small cape, holding a toothpick sword, standing proud, full body head-to-toe, centered, clean 1px black outline, legendary joke cosmetic
```

---

## 5. Asset อื่น (ทำทีหลัง)

- **ฉาก / แดนลับ + มอนสเตอร์**: ดู **§7** (theme = MMORPG fantasy — เลิก office ของ Pixel Agents แล้ว). พื้นหลังฉากเป็น track แยก (tileset/gen ทีหลัง); 3.2a ใช้ CSS placeholder ไปก่อน. มอนสเตอร์/บอส gen ผ่าน PixelLab ตาม §7
- **loot / ของแต่งแดน**: gen เดี่ยว พื้นโปร่ง — `single isolated pixel art {ITEM}, top-down, transparent background, limited palette, clean outline` · {ITEM} = ถ้วยรางวัล, โล่, ดาบปัก, คบเพลิง, ธงกิลด์, หีบสมบัติ, แท่นรูน, ต้นไม้แฟนตาซี · rarity = สีขอบ (common เทา / rare ฟ้า / epic ม่วง / legendary ทอง)
- **UI / FX**: XP bar, level-up burst (สีตามคลาส), "???" tile สายลับ, "!" bubble ตอนรอ input

---

## 6. ลำดับทำจริง

1. ตั้งค่าฟอร์ม (ข้อ 1) ให้เหมือนกันทุกตัว
2. gen **Mage T1** → ทำครบ loop (Create State T2–T4 → Add Animation idle/walk/work → 8 ทิศ) → วัด credit
3. ทำ **Ranger / Rogue / Sage** T1 + loop เดียวกัน
4. **สายลับ + item/FX** ทยอยเติมทีหลัง

---

## 7. ฉาก + มอนสเตอร์ (AFK scene · §10.3)

ฉากผูก **tier ไม่ใช่ level/repo**. T1–T3 ใช้ร่วมทุกสาย; **T4 = แดนลับเฉพาะ branch** (สาย×a/b = 8 แดน) — moment "ย้ายโลก" ตอน up-class. มอนสเตอร์ gen ผ่าน **PixelLab Character Creator** (โหมด creature) ตั้งค่าเหมือน §1 (Low Top-Down, Black outline, Highly detailed).

**constants ของมอนสเตอร์** (ครึ่งหน้าของทุก prompt):
`(not human), full body head-to-toe, centered, slightly stylized, clean 1px black outline` · negative: `blurry, 3d, realistic, text, watermark, human`
**ขนาด:** mob 48×48 · บอสแดน 64×64

### 7.1 ฉากพื้น T1–T3 (ใช้ร่วม) + มอนสเตอร์พื้น

| tier | ฉาก (ธีม/palette) | มอนสเตอร์ |
|---|---|---|
| 1 | **ทุ่งหญ้าหน้าเมือง** — เขียวสด ฟ้าใส กำแพงเมืองไกลๆ | Bug Slime |
| 2 | **ป่ากระซิบ / ถ้ำ** — เขียวเข้ม หมอก แสงลอด | Error Wraith |
| 3 | **ดันเจียนลึก** — หินเทา คบเพลิง เงาทึบ | Dungeon Brute |

```
Bug Slime (T1):     a small round slime creature, translucent sickly-green jelly speckled with tiny glitch pixels, two big round cartoon eyes, tiny and slightly menacing
Error Wraith (T2):  a floating ghostly wraith, tattered cloak woven from fragmented red error-glyphs, hollow glowing red eyes, wispy crimson smoke trail, eerie
Dungeon Brute (T3): a hulking armored troll brute, cracked iron-grey stone skin, heavy spiked club, glowing orange eyes, imposing dungeon mini-boss
```

### 7.2 แดนลับ T4 — 4 สายหลัก × branch a/b (8 แดน + บอสประจำแดน)

palette ยึดตามสาย (§1): Mage ม่วง+ทอง · Ranger teal · Rogue coral · Sage amber.

**Mage ⚔ (ม่วง+ทอง)**
| branch | แดน (ธีม) | บอส |
|---|---|---|
| a · Cloud Summoner | **Skyforge Aether** — เกาะลอยฟ้า เมฆพายุ แสงทอง ท้องฟ้าม่วง | Storm Archon |
| b · Kernel Lich | **Circuit Catacombs** — สุสานใต้ดิน เส้นวงจรเรืองเขียวพิษในหิน เงาม่วง | The Kernel Lich |
```
Storm Archon:    a towering storm elemental archon, body of swirling cloud and crackling golden lightning, ornate floating gold armor plates, glowing violet core, majestic — purple-and-gold electric palette
The Kernel Lich: an undead lich sorcerer fused with glowing circuit-board veins, tattered royal robes, exposed ribcage with a pulsing toxic-green core, floating, necromantic-tech — deep-purple + toxic-green palette
```

**Ranger 🏹 (teal)**
| branch | แดน | บอส |
|---|---|---|
| a · Motion Trickster | **Aurora Flux** — แสงออโรราไหลพลิ้ว motion trail ไร้น้ำหนัก | Prism Wisp |
| b · Design Warden | **Geometric Sanctum** — สวนเรขาคณิต เส้นพิมพ์เขียว สถาปัตย์ขาวสะอาด | The Grid Warden |
```
Prism Wisp:      a shimmering wisp tyrant made of refracted rainbow light and motion-blur trails, semi-transparent shifting form, teal core, graceful and elusive — teal with rainbow shimmer
The Grid Warden: a stoic golem guardian built from perfect geometric panels and glowing blueprint grid-lines, crisp angular form, orderly and imposing — teal + blueprint-blue + white
```

**Rogue 🗡 (coral)**
| branch | แดน | บอส |
|---|---|---|
| a · Heisenbug Hunter | **Quantum Rift** — ห้วงกระตุก phase double-exposed ไม่แน่นอน | The Heisenbug |
| b · Forensics Shadow | **Noir Crime Scene** — ตรอกฝนตก เส้นชอล์ก สปอตไลต์เดียว noir | The Phantom Culprit |
```
The Heisenbug:        an elusive glitch-creature that phases in and out, double-exposed flickering body, fragmented half-transparent form, unsettling — coral + glitch-magenta
The Phantom Culprit:  a shadowy noir culprit in a long trench coat and hat, body of living shadow, only two glowing coral eyes visible, mysterious — black-grey noir with coral accent
```

**Sage 📖 (amber)**
| branch | แดน | บอส |
|---|---|---|
| a · Domain Prophet | **Oracle's Athenaeum** — หอสมุดโบราณลอยฟ้า รูนเรืองอำพัน ม้วนคัมภีร์ | The Domain Sphinx |
| b · Orchestration Master | **Conductor's Nexus** — โถงควบคุม เส้นแสงทองโยงหุ่นมากมาย ไม้บาตอง | The Orchestration Construct |
```
The Domain Sphinx:           a winged sphinx oracle carved from amber stone, body etched with glowing runes, wise all-seeing eyes, regal — amber gold + parchment
The Orchestration Construct: a multi-armed conductor golem of gilded clockwork, each hand a glowing light-baton, golden threads radiating to unseen puppets, commanding — amber + gold + multicolored threads
```

### 7.3 แดนลับสายลับ (secret class — ไม่มี branch, 1 แดน/บอส ต่อสาย)

| สาย (palette) | แดน | บอส |
|---|---|---|
| Maestro 🎼 (ทอง) | **Grand Concert Vault** — โถงอุปรากรทอง เครื่องดนตรีลอย | The Living Symphony |
| Night Owl 🦉 (คราม) | **Midnight Roost** — ราตรีนิรันดร์ หอคอยมืด แสงจันทร์ ดาว | The Eclipse Owl |
| The Ascetic 🧘 (ขาวหิน) | **Silent Summit** — อารามภูเขา minimalist หมอกบาง | The Stone Guardian |
| The Gremlin 👺 (เขียว glitch) | **The Glitch Pit** — แดนพังทลาย เศษ hardware ลอย pixel เพี้ยน | The Chaos Gremlin King |
| The Trickster ✦ (legendary มุก) | **Fool's Mirage** — คาร์นิวัลลวงตา กระจก คอนเฟตตี | The Jester Mirage |
```
The Living Symphony:    a conductor-spirit formed from a swirling orchestra of golden instruments and music notes, baton raised, grand — radiant gold
The Eclipse Owl:        a giant spectral owl with glowing crescent-moon eyes, indigo feathers trailing stardust, perched and watchful — deep-indigo + moonlight-silver
The Stone Guardian:     a serene stone meditation guardian, simple monk-like rock form sitting cross-legged, faint white aura, minimalist and calm — pale stone-white
The Chaos Gremlin King: a cackling gremlin king on a throne of broken hardware, oversized grin, electric sparks and glitch artifacts, chaotic — glitch-green
The Jester Mirage:      a mischievous illusion jester splitting into mirror-image duplicates, harlequin pattern, playing-card confetti, whimsical (จับคู่กับ Sir Quacks-a-lot §4.5 — จะให้เป็ดยักษ์ลวงตาก็ได้) — rainbow harlequin
```

### 7.4 หมายเหตุ implementation

- **3.7 ✅** map `sceneFor(tier=4, line, branch)` → theme key ของแดน (เช่น `skyforge_aether`) ครบ 13 แดน — โค้ดอ้าง theme key, art เสียบหลัง CSS seam (ตอนนี้เป็น gradient + emoji placeholder)
- พื้นหลังแดน = tileset/gen แยก (PixelLab map หรือ free fantasy tileset) — มอนสเตอร์/บอสมาก่อน, ฉากตามทีหลัง
- gen ตามลำดับ: base mob (slime/wraith/brute) → บอสสายที่เล่นอยู่ (Mage ก่อน) → ที่เหลือทยอย

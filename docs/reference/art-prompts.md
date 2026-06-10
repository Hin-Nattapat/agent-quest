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

- **ฉาก / ออฟฟิศ**: ใช้ tileset ของ **Pixel Agents** (ตัวที่จะ fork) เป็นหลัก — มีออฟฟิศอยู่แล้ว; ทำ custom เพิ่มผ่าน Map Workshop (ล็อก/เสียเงิน) ภายหลัง
- **loot / เฟอร์นิเจอร์**: gen เดี่ยว พื้นโปร่ง — `single isolated pixel art {ITEM}, top-down, transparent background, limited palette, clean outline` · {ITEM} = desk, server rack, bookshelf, potted plant, coffee machine, golden trophy, neon sign, rug · rarity = สีขอบ (common เทา / rare ฟ้า / epic ม่วง / legendary ทอง)
- **UI / FX**: XP bar, level-up burst (สีตามคลาส), "???" tile สายลับ, "!" bubble ตอนรอ input

---

## 6. ลำดับทำจริง

1. ตั้งค่าฟอร์ม (ข้อ 1) ให้เหมือนกันทุกตัว
2. gen **Mage T1** → ทำครบ loop (Create State T2–T4 → Add Animation idle/walk/work → 8 ทิศ) → วัด credit
3. ทำ **Ranger / Rogue / Sage** T1 + loop เดียวกัน
4. **สายลับ + item/FX** ทยอยเติมทีหลัง

# Commit Quest — Art & Image-Gen Prompt Pack

> Importing exports into the game: see `art-import.md`.

*เครื่องมือหลัก: PixelLab Character Creator · sprite ฐาน 56×56 · workflow = gen ตัวฐานครั้งเดียวแล้ว derive ที่เหลือ (ไม่ regen)*

**สารบัญ**

| § | หมวด |
|---|---|
| 1 | ตั้งค่าฟอร์ม + palette |
| 2 | Workflow (gen ครั้งเดียว → derive) + กันดริฟต์ |
| 3 | Animation states (combat loop) |
| 4 | **ตัวละครฮีโร่** — Novice + 4 สายหลัก (T1–T4) + สายลับ · costume + idle/walk/attack |
| 5 | Item / UI / FX |
| 6 | ลำดับทำจริง |
| 7 | ฉาก + มอนสเตอร์ + บอส + กิลด์/NPC |

> **สถานะ pipeline (อัปเดต):** importer รองรับ `hero` · `monster` · `boss` · `bg` · `map` · `npc` · `item` ครบแล้ว (ดู `art-import.md`). ของที่ยังเป็น emoji/gradient placeholder = **Novice (ตัวเริ่มต้น)** + **5 แดนลับ secret-class** (hero/monster/boss/scene). สายหลัก mage/ranger/rogue/sage + 11 ฉาก/มอน/บอส (starter + T4 สายหลัก) + guild map + NPC = **ทำแล้ว**.

---

## 1. ตั้งค่า + palette

ตั้งค่าฟอร์ม Character Creator **เหมือนกันทุกตัว** (นี่คือกุญแจความสม่ำเสมอ — px คุมที่ช่อง ไม่ใช่ข้อความ):

- Camera View: **Low Top-Down**
- Sprite Size: **56×56** (Width/Height = 48)
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

> โมเดล "ออฟฟิศ" เดิม (work/type/read แบบ Pixel Agents) **เลิกแล้ว** — ตอนนี้เป็น **AFK MMORPG**: ฮีโร่
> เดินใน overworld (กิลด์) ตอน Idle/Rest แล้วสู้ FF-style ตอน Farming. anim ฮีโร่ที่ใช้จริง = **idle ·
> walk · attack(cast)** (hurt/celebrate เป็น CSS keyframes). Action Description ต่อสาย = **§3.2**.

### 3.1 Combat animations (the AFK combat loop)

The companion's combat choreography (`app/src/use-scene-director.ts` + `combat.ts`) cycles these
states. Hero idle/walk/attack use real sprite frames for the four main lines; hurt/celebrate stay
CSS keyframes (`styles.css` `.hero-*` / `.m-*`).

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

### 3.2 Action Description ต่อสาย — idle · walk · attack (อาวุธคนละแบบ)

**หลัก:** ยืน = idle ผ่อน · เดิน = พกอาวุธ**ผ่อน** (สะพายหลัง / ตั้งไม้เท้า / เก็บฝัก) · โจมตี = **ดึง/ยก/เล็ง** · gen ทิศ **east** (battle side-view) · **keep-first-frame ✓** · ~8 เฟรม · ต้องย้ำ "keeping … unchanged" กันชุด/ฮู้ดดริฟต์ทุกครั้ง

**idle (ใช้ร่วมทุกสาย — ยืนเฉยหายใจเบา):** `standing idle in place, almost motionless, a slow gentle breathing loop, weapon held at ease, facing east, keeping the outfit and colors unchanged` (สลับ "weapon held at ease" ตามอาวุธ: ไม้เท้าตั้งพื้น / ธนูสะพายหลัง / มีดในฝัก / ตำราหนีบแขน)

**Mage ⚔ — ไม้เท้า + คริสตัล teal**
- walk: `walking forward with a steady natural gait, the wooden staff held upright in one hand like a walking stick, the free arm swinging slightly, keeping the purple hood drawn up over the head, the muted-purple robe and gold trim unchanged`
- attack (ร่ายเวท, ยืน): `casting a spell in place, raising the staff and thrusting it forward, glowing teal energy bursting from the crystal tip, keeping the purple hood up and the robe unchanged`

**Ranger 🏹 — ธนู (เดิน=สะพายหลัง / ยิง=ดึงออก)**
- walk: `walking forward with a light agile gait, the short bow and quiver slung together on the back, both hands free and the arms swinging naturally at the sides, keeping the teal tunic and hooded scarf unchanged`
- attack (ยิง, ยืน): `a side-on archer's stance, the front bow-arm fully extended straight ahead in the direction the character is facing, the rear hand drawing the glowing bowstring back to the cheek, then loosing the arrow straight ahead — the arrow points the same way the character looks, keeping the teal tunic and hooded scarf unchanged`

**Rogue 🗡 — มีด + แว่นขยาย (เดิน=เก็บฝัก / ฟัน=ชัก)**
- walk: `walking forward in a low wary prowl, the dagger sheathed at the belt and the magnifying glass clipped at the side, both hands free and ready, keeping the dark hooded cloak with coral accents unchanged`
- attack (melee, พุ่งสั้น): `drawing the dagger and lunging a short step forward in a swift downward slash, keeping the dark hooded cloak and coral accents unchanged`

**Sage 📖 — ตำรา (เดิน=หนีบใต้แขน / เสก=เปิดยก)**
- walk: `walking forward with a slow measured gait, the glowing tome closed and carried under one arm, the other arm swinging gently, keeping the amber-trimmed robe and round glasses unchanged`
- attack (เสกรูน, ยืน): `standing and raising the open glowing tome, projecting a bright amber rune-glyph forward, keeping the amber robe and round glasses unchanged`

**สายลับ (attack — walk = พกของผ่อนข้างตัวแบบเดียวกัน):**
| สาย | attack |
|---|---|
| Maestro | `a sweeping conductor's baton flourish releasing a burst of light forward` |
| Night Owl | `casting a glowing crescent-moon bolt forward` |
| Ascetic | `a calm forward palm-strike releasing a ring of light` |
| Gremlin | `a chaotic forward glitch-zap, electric sparks bursting` |
| Trickster | `flinging a fan of playing cards forward` |

> **โพรเจกไทล์** (ลูกเวท/ธนู/รูน) ที่วิ่งไปหามอน = **VFX ฝั่งเกม** (CSS/sprite) anim ทำแค่ "ท่าตัวละคร" (+ แสงปลายอาวุธ) · Mage/Ranger/Sage = ยืนยิง · **Rogue = melee** (พุ่งสั้นเข้าฟัน)

**เสริมกันดริฟต์ (สำคัญ):**
1. **Start Frame = idle** + ติ๊ก **"Keep first frame (idle pose)"** → anchor หน้าตา/ทรงจากเฟรมแรก
2. ใช้ **positive phrasing เป๊ะ** บอกท่าที่ "ต้องการ" ตรงๆ — **negatives ("not across the body") โมเดลภาพมักเมิน**
3. ⚠️ **pose อาวุธ anchor มาจาก base/idle** — ถ้าฐานถืออาวุธผิดท่า แก้คำบรรยาย anim อย่างเดียวไม่พอ ต้อง **regen base/idle**: archer ให้ `bow slung on the back, hands free`; rogue ให้ `dagger sheathed at the belt`; sage ให้ `tome carried under one arm` — แล้ว anim ค่อย "ดึง/ชัก/เปิด" ตอน attack
4. อย่าใส่ของใหม่ที่ base ไม่มี — แค่ `keeping` ของเดิม
5. **ทิศโจมตี/เล็ง อย่าใช้แค่ `forward`** — AI สับสนทิศ (ธนูยิงย้อนหลังได้) ระบุ `straight ahead in the direction the character is facing` / `the arrow points the same way the character looks` · ระบุกลไก: archer = **แขนถือธนูเหยียดไปหน้า + มือดึงสายไปหลัง** (ไม่งั้นกลับด้าน)

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
ตั้งค่าฟอร์มทุกตัว: **Low Top-Down · 56×56 · Highly detailed · Black outline**

---

### 4.0 Novice — ตัวเริ่มต้น (pre-class · ภาพแรกที่ผู้เล่นทุกคนเห็น)

ทุกคนเริ่มที่ **Novice Lv.1** ก่อนเลเวลถึง T1 แล้วเลือกสาย → ตัวนี้คือภาพแรกหลัง install. ยังเป็น emoji
🧙 fallback อยู่ (ไม่มี `sprites/novice/`). เรียบ ไม่มีสี class · attack ใช้ melee dash ฝั่งเกม (ไม่ต้อง gen
attack frames) · ทำแค่ **idle + walk** พอ.

ตั้งค่า: **Humanoid · 56×56 · Low Top-Down · Highly detailed · Black outline** (เหมือน hero อื่น)

**costume (T0 base):**
```
a fresh-faced novice adventurer around 20, eager nervous expression, average build, light-tan skin, short brown hair, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a plain starting adventurer: a simple undyed linen tunic with a brown leather belt and worn boots, holding a plain wooden stick, no class markings, muted earthy beige-and-brown palette
```
**idle:** `standing idle in place, almost motionless, a slow gentle breathing loop, the wooden stick held at ease, facing east, keeping the tunic and earthy colors unchanged`
**walk:** `walking forward with an unsure eager gait, the plain wooden stick carried in one hand, the other arm swinging, keeping the simple linen tunic and earthy colors unchanged`

**import + wire (พอ gen เสร็จ):**
1. `bun tools/import-art.ts <export> --as hero:novice:t0` → `sprites/novice/t0/`
2. manifest: `"novice-t0": buildSet("novice/t0", 9)` ใน `app/src/sprites.ts` (ไม่มี attack frames → melee fallback)
3. test: `app/src/sprites.test.ts` เปลี่ยน `heroSpriteSet("novice", 0)` จาก `.toBeUndefined()` → `.toBeDefined()`

---

### 4.1 Mage — Backend · purple · ไม้เท้า + server-crystal
arc: เด็กฝึก → พ่อมดเซิร์ฟเวอร์ → อัครมหาเวท → (สายเมฆ / สายเนโครเคอร์เนล)
palette arc: T1 ม่วงหม่น+ทองบาง → T2 ม่วงเข้ม+รูนทอง → **T3 ม่วงเข้ม+ทอง+teal เรือง (archmage)** → T4a sky-violet+teal สว่าง (ลอยบนเมฆ) · T4b ดำม่วง+cyan necrotic (lich)
silhouette ยกระดับ: T1 robe+ไม้เท้าเรียบ → T2 robe เข้ม+rune-circle ที่เท้า → T3 mantle+crystal โคจร+rune halo → T4a ลอยตัว+cape+container-glyph รอบตัว · T4b ฮู้ดเงา+circuit-veins+core-orb ดำ

**T1 — Backend Mage**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an apprentice backend wizard: muted purple hooded robe with thin gold trim, holding a plain wooden staff topped with a small glowing teal terminal-crystal, limited purple palette
```
**T2 — Server Sorcerer**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a server sorcerer, a rising spellcaster: a deeper royal-purple hooded robe worn with the pointed hood drawn up over the head, gold rune-embroidered hem and trim, a taller staff topped with a small floating glowing server-node, a faint rotating rune-circle of light at the feet, wisps of arcane energy, a confident stance, deep purple with gold rune accents
```
**T3 — Infra Archmage**
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an infra archmage, a commanding master of the backend: a rich purple robe with an ornate shoulder mantle and gold rune trim flowing behind, several glowing server-crystals orbiting overhead, a radiant rune halo behind the head, a tall staff crowned with a bright teal data-orb crackling with power, an imposing arcane stance, deep purple and gold with teal energy
```
**T4a — Cloud Summoner** (สายเมฆ / distributed)
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a cloud-summoner archmage, a master of the distributed skies: airy sky-violet robes with a long wispy cape billowing, levitating atop swirling luminous cloud-mist, a constellation of glowing teal hexagonal container-glyphs floating and orbiting around the body, arms raised summoning, ethereal and radiant, light sky-violet with bright teal glow
```
**T4b — Kernel Lich** (สาย performance / low-level)
```
a focused backend developer around 30, intellectual calm expression, lean build, medium-tan skin, dark hair, light stubble, thoughtful eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a kernel-lich archmage, a dread necromancer of the low level: a deep black-purple robe with a shadowed hood concealing glowing eyes, cold cyan circuit-veins pulsing across the fabric and skeletal hands, clutching a dense black core-orb radiating dark energy, a sinister looming presence, dark purple and necrotic cyan
```

---

### 4.2 Ranger — Frontend · teal · ธนูสาย-slider
arc: นักธนูฝึก → มือแม่นปืน → นักล่าพิกเซล → (สายโมชั่น / สายผู้คุมดีไซน์)
palette arc (ให้แต่ละ tier ต่างชัด ไม่ใช่ teal ซ้ำ): T1 teal เรียบ → T2 teal+white (visor) → **T3 teal เข้ม+ไซแอนเรือง+ทองelite (มาสเตอร์คลุมฮู้ด, energy-bow ใหญ่)** → T4a อิเล็กทริกไซแอน+ชมพูม่วง (afterimage) · T4b teal+ขาว+rainbow swatch (การ์เดียนถือโล่)
silhouette ต้องยกระดับ: T3 = คลุมยาว+ธนูพลังงาน+glyph ลอยรอบหัว · T4a = เบลอหลายร่าง (เร็ว) · T4b = จอมเวทเสกโครงสร้างเรขาคณิตลอย+รัศมี prismatic (อลังแบบ archmage ไม่ใช่ถือโล่)

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
dressed as a pixel hunter, an elite master archer: a long hooded ranger cloak with a high collar billowing behind, drawing a large radiant energy-bow with a bright white-cyan light arrow nocked, a sleek HUD targeting visor over one eye, twin quivers crossed on the back, small glowing crosshair glyphs orbiting overhead, deep teal cloak with bright cyan energy glow and thin gold elite trim
```
**T4a — Motion Trickster** (สาย interaction / animation)
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a motion trickster, caught mid-dash between frames: several translucent afterimage duplicates trailing behind the body, streaking neon motion-lines and dissolving light particles, a light-bow blurring into motion streaks, weightless dynamic pose, electric cyan body with vivid magenta-pink motion trails
```
**T4b — Design Warden** (สาย design system / token)
```
an energetic frontend developer around 24, lively alert expression, agile slim build, light skin with freckles, bright copper-ginger hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a design warden, a regal master of order: flowing structured teal-and-white robes traced with luminous blueprint grid-lines, summoning large floating holographic geometric constructs and glowing wireframe shapes that orbit the body, a radiant halo of prismatic design-token color swatches arranged like a constellation behind the head, one gauntleted hand raised projecting a lattice of light, an imposing commanding stance, teal and crisp white with iridescent prismatic accents
```

---

### 4.3 Rogue — Debugger · coral · มีด + แว่นขยาย
arc: โรกฝึก → นักลอบสังหารบั๊ก → นักสะกดรอยสแต็ก → (สายล่าไฮเซนบั๊ก / สายนิติเวช)
palette arc: T1 ดำ+coral เรียบ → T2 ดำสนิท+coral คม (assassin) → **T3 เงาดำ+coral พิษเรือง (predator)** → T4a coral+glitch-magenta/cyan (พังๆ) · T4b นัวร์ดำ+coral+amber spotlight (นักสืบ)
silhouette ยกระดับ: T1 มีดเล็ก → T2 ทวินแด็กเกอร์+หน้ากาก → T3 คลุมเงาขาด+เส้น stack-trace เรือง → T4a ร่างพังครึ่งโปร่ง · T4b เทรนช์โค้ตยาว+หมวกปีก (นักสืบนัวร์)

**T1 — Debugger Rogue**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a debugger rogue: dark hooded cloak with coral-red accents, a small dagger in one hand and a magnifying glass in the other, a tiny cartoon bug nearby, dark with coral palette
```
**T2 — Bug Assassin**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a bug assassin, a sleek deadly killer: matte-black assassin gear with a hooded cowl and a sharp coral mask over the lower face, dual curved coral-glowing daggers in a reverse grip, a bandolier of captured-bug vials across the chest, a low crouched ready stance, deep black with vivid coral accents
```
**T3 — Stack Stalker**
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a stack stalker, a shadow-cloaked predator: a tattered layered shadow-cloak fraying into wisps, a glowing coral stack-trace thread coiling from one raised hand like a whip, a single coral scanning eye-visor, rows of bug-vials on the belt, an ominous looming silhouette, near-black with toxic coral glow
```
**T4a — Heisenbug Hunter** (สาย flaky / race)
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a heisenbug hunter, phasing in and out of reality: the body flickering half-translucent and double-exposed, fragments of the silhouette glitching and displacing sideways, swirling coral-and-magenta distortion particles and scan-lines, daggers leaving uncertain after-trails, coral with glitch-magenta and cyan distortion
```
**T4b — Forensics Shadow** (สาย log / observability)
```
a sharp debugger around 27, wary keen expression, wiry build, pale cool skin, messy black hair, a small scar over one eyebrow, narrow eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a forensics shadow, a noir investigator: a long flowing trench coat with an upturned collar and a wide-brim hat shadowing the face, a glowing amber magnifier raised, floating translucent log-scrolls, evidence tags and timeline ribbons orbiting, a single spotlight beam cutting across, moody black-and-coral noir with warm amber light
```

---

### 4.4 Sage — Architect · amber · ตำรา + พิมพ์เขียว
arc: ปราชญ์ → ผู้หยั่งรู้ระบบ → เมไจแห่งแพตเทิร์น → (สายผู้พยากรณ์โดเมน / สายผู้บัญชาการ)
palette arc: T1 amber เรียบ → T2 amber+ทอง (third eye) → **T3 amber เข้ม+ทองสว่าง+เส้นแพตเทิร์นเรือง** → T4a amber+ขาว celestial (พยากรณ์) · T4b amber+ทอง+เส้นด้ายหลากสี (วาทยกร)
silhouette ยกระดับ: T1 ตำรา → T2 robe ใหญ่+third eye+ไดอะแกรมลอย → T3 mandala+glyph หมุนรอบ+quill-staff → T4a ร่างลอย+halo โหนดดาว · T4b mantle บาน+ด้ายแสงโยงหุ่นรอบตัว

**T1 — Architect Sage**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an architect sage: amber-trimmed robe, holding an open glowing tome and blueprint scroll, limited amber palette
```
**T2 — System Oracle**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a system oracle, a far-seeing mystic: a grander layered amber-and-gold robe with a high mantle, a glowing third-eye gem on the forehead, a floating constellation system-diagram hovering above an open levitating tome, faint golden runes circling, a serene knowing pose, amber with radiant gold
```
**T3 — Pattern Magus**
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a pattern magus, a sorcerer of sacred patterns: an ornate robe embroidered with glowing geometric patterns, intricate sacred-geometry glyph-rings rotating and orbiting around the body, a tall quill-staff crowned with crystallizing light, a faint mandala halo behind the head, an arcane commanding stance, deep amber and bright gold with luminous pattern-lines
```
**T4a — Domain Prophet** (สาย modeling / DDD)
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as a domain prophet, an ascended seer: flowing celestial robes lifting weightlessly, a vast halo-constellation of linked glowing entity nodes and relation-lines forming a crown around the head, eyes alight, hands cupping a small radiant world-model, ethereal and serene, amber and soft luminous white with celestial highlights
```
**T4b — Orchestration Master** (สาย agent-teams)
```
a wise architect around 45, composed calm expression, average build, warm brown skin, gray-streaked hair and short beard, round glasses, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline —
dressed as an orchestration master, a grand conductor of many: regal amber-and-gold robes with a flared mantle, glowing multi-colored thread-strands streaming from each raised hand to a ring of small floating familiar-sprites arranged like an orchestra, a commanding baton-staff of light, an imposing radiant stance, amber and gold with vivid multi-color orchestration threads
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

### 4.5.1 Tier-up ผ่าน Create State (เพิ่มความเข้ม ไม่ redesign)

gen ตัวฐาน 1 ครั้ง (prompt ข้างบน) → tier สูงขึ้น = เปิด **Create State** วาง "describe the new state" สั้นๆ (เพิ่ม glow / อนุภาค / สีเข้ม) **คนเดิม ท่าเดิม** ไม่ต้องบรรยายตัวละครซ้ำ
- checkbox **"Use color palette from reference"**: **ติ๊ก** = เพิ่ม glow โทนเดิม (ไม่มีสีใหม่) · **ไม่ติ๊ก** = เพิ่ม/เข้มสีใหม่ (เช่น eclipse, glitch, daemon)
- T1 = ตัวฐานเลย (ไม่ต้อง Create State) · T2–T4 = ไล่ตามตาราง

| สาย | T2 | T3 | T4 (apex) |
|---|---|---|---|
| **Maestro** | a brighter golden glow and a few more floating glowing music-note orbs | richer ornate gold attire with a radiant aura, many swirling golden notes and light-ribbons orbiting | a blazing radiant golden aura, a full swirling orchestra of glowing instruments and notes surrounding, majestic |
| **Night Owl** | a brighter moonlight glow and a few drifting glowing stars | deeper indigo, a luminous crescent-moon halo behind, streaming stardust, the owl familiar glowing brighter | a dark eclipse aura with a glowing ringed eclipse-moon behind the head, a swirling starfield, intense cosmic indigo glow |
| **The Ascetic** | a faint serene white aura and a second floating glyph | a calm glowing halo, several softly floating glyphs orbiting, gentle light | a radiant white enlightenment aura, a full ring of glowing glyphs orbiting, levitating slightly, transcendent |
| **The Gremlin** | more electric sparks and glitchy distortion artifacts | a semi-translucent flickering form, swirling glitch artifacts and floating broken-pixel debris, eerie green glow | a chaotic storm of corrupted glitch energy, a menacing daemonic aura, glowing toxic-green eyes, larger and more monstrous |

วิธีใช้ช่อง Create State: วางข้อความใน column ของ tier นั้น เช่น Maestro T4 → วาง `a blazing radiant golden aura, a full swirling orchestra of glowing instruments and notes surrounding, majestic` (ติ๊ก use-palette เพราะยังทอง)

> **Trickster (✦ legendary)** ยังไม่มี base ใน §4.5 — ธีม jester/เป็ดลวงตา (ดู §7.3 The Jester Mirage). base แนะนำ: `a mischievous illusion jester, harlequin diamond pattern, holding fanned playing cards, mother-of-pearl rainbow palette` → escalate T3 `splitting into mirror-image duplicates, playing-card confetti` · T4 `a dazzling carnival of mirror-illusions, swirling confetti and prismatic shimmer`
> **Sir Quacks-a-lot** = cosmetic ตัวเดียว ไม่มี tier (gen ครั้งเดียวจบ)

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
**ขนาด:** mob 56×56 · บอสแดน 64×64

### 7.A Monster constants + idle/attack action descriptions

ตั้งค่าฟอร์มเหมือน §1 (**Low Top-Down · Black outline · Highly detailed**) · **Generation Mode = Humanoid** (slime/wraith/brute = bipedal/amorphous → เลือก Humanoid · Quadruped ใช้เฉพาะสัตว์ 4 ขาจริง เช่น หมา/หมี/แมว) · **ขนาด 56×56** (importer copy-only ไม่ normalize) · gen ตัวหัน **ซ้าย (west)** = หันเข้าหาฮีโร่ · ทำ 2 animation: **idle + attack**

**constants** = `not human, full body, centered, slightly stylized, clean 1px black outline` (**รวมในทุก prompt §7.1 ให้แล้ว — copy วางได้เลย**) · negative (ถ้ามีช่อง): `blurry, 3d, realistic, text, watermark, human`

**Action Description (ใช้ซ้ำทุกตัว — keep-first-frame ✓):**

- idle: `a slow idle loop, breathing and bobbing gently in place, facing left, keeping its form and colors unchanged`
- attack: `a forward attack, lunging left toward the opponent and striking then recovering, the body fully facing left the whole time, keeping its form and colors unchanged`

(ตาย = เฟดหาย, โดน = แฟลช → ทำฝั่งเกม CSS ไม่ต้อง gen)

### 7.B Scene background — prompt template

ฉากรบ = **รูปเดียวเต็ม panel** (ฟ้า+พื้นในรูป) · **ไม่มีตัวละคร/มอนในรูป**

**ขนาด/อัตราส่วน:** panel เป็น terminal dock = **กว้าง-เตี้ย ~3:1** (วัดจริง ~900×285) → gen รูป **~3:1** ไม่ใช่ 3:2 · **tier 2 → 400×128**, tier 1 → 320×104 · render `cover` anchor bottom (crop ฟ้านิดเดียว ไม่ตัดพื้น)

**องค์ประกอบ/ตำแหน่ง** (สำคัญ — ตัวละครยืน "ที่เดิม" ทุกฉาก จากโค้ด: ฮีโร่ซ้าย ~30%, มอนขวา ~13–22% เรียงลึกขึ้นไป 3 ตัว):

- **พื้นโล่งราบเต็มความกว้าง** ที่โซนล่าง (lower third) = ที่ยืน/สู้
- **ซ้าย ~30% เปิดโล่ง** = โซนฮีโร่ · **ขวา ~15–25% เปิดโล่ง + มีระยะลึก** = โซนมอน (รองรับ **3 ตัว**)
- ของตกแต่ง (ต้นไม้/กำแพง/เสา/หิน) = **ขอบซ้าย-ขวาสุด + แบ็คกราวด์เท่านั้น** — ห้ามบังโซนยืน · กลาง+foreground โล่ง
- ⚠️ **ใน prompt บรรยายโซนว่างเป็น "ภูมิประเทศ" ล้วน** (open flat ground, clear foreground) — **ห้ามเอ่ยคำว่า hero/enemies/characters/stand/fight** ไม่งั้น AI วาดตัวละครออกมา (คำ positive ชนะ negative) · ปิดท้ายด้วย `completely empty with no people, no characters, no creatures, no figures`

template (ฝัง composition แล้ว — เติม `<SCENE>`/`<decor>`/`<bg>`/`<palette + mood>`):

```
a side-view pixel-art battle background of <SCENE>, a wide open flat <ground> clearing across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, <decor> only at the far left and right edges, <background> behind, completely empty with no people, no characters, no creatures, no figures, <palette + mood>, limited palette, clean pixel art, slightly stylized
```

### 7.C Overworld guild map (top-down · PixelLab create-map)

Guild = ฉาก **Overworld** (Idle/Rest) ไม่ใช่ battle bg — render โดย `OverworldRoom` ที่ฮีโร่เดิน ambient
ทับข้างบน · gen ด้วย **create-map (Pixflux)** ไม่ใช่ create-image · import: `--as map:guild` →
`overworld/guild.png` แล้วเติม `SceneTheme.Guild` ใน `OVERWORLD_BGS` (`overworld-bg.ts`)

**ตั้งค่า:** Camera view = **Top-down** · canvas **กว้าง-เตี้ย** ให้ใกล้ panel (~3:1; เลือกขนาดใหญ่สุดที่ tier
รับได้ เช่น 400×~128–200) · render `cover`/center → ห้องควรเต็ม ไม่มีขอบสำคัญติดมุม

⚠️ เหมือน §7.B: **บรรยายแต่ห้อง/เฟอร์นิเจอร์ ห้ามเอ่ย hero/adventurer/characters** ไม่งั้น AI วาดคนลงไป

**ตั้งค่าสำคัญ:** Camera view = **Top-down** (ไม่ใช่ Sidescroller)

⚠️ **กันขอบดำ — อย่าใช้ negation เรื่อง space** (`no walls`/`no void`/`no black`/`no border`): โมเดลมัก
วาดสิ่งที่เอ่ยถึงแม้มี "no" → ยิ่งสั่งยิ่งมีขอบดำ/พื้นลอยกลาง void · แทนที่ด้วย **คำเชิงบวก**: บรรยายเป็น
**"พื้น/terrain ที่ปูเต็มทั้งภาพ edge to edge"** (ไม่ใช่ "ห้องมีกำแพง" — พอเป็นห้องมันวาดเป็นวัตถุลอยกลางจอ)
· เก็บ negation ไว้แค่ `no people/characters` ท้ายสุด

```
a seamless top-down pixel-art floor of a cozy medieval adventurers' guild hall, warm wooden planks completely covering the whole image edge to edge as the ground, thin stone walls flush along the top, left and right edges seen from straight above, a hanging dusk-purple banner, brass wall torches, arched windows and framed pictures, a long row of wooden tables, chairs and treasure chests along the top, a large ornate rug centered on the open wooden floor, warm and inviting, dusk-purple brass-gold and warm-wood palette, no people, no characters, no adventurers, limited palette, clean pixel art, slightly stylized
```

### 7.C.1 Guild NPCs (top-down characters)

NPC ยืนประดับในกิลด์ (overworld) — gen แบบ **character เดียวกับ hero**: Mode **Humanoid** · **56×56** ·
Camera **Low Top-Down** · Outline **Black outline** · Detail **Highly detailed** · **remove-bg ON**
(พื้นโปร่ง) · palette ให้เข้ากิลด์ (dusk-purple + brass-gold + warm-wood) · ใช้แค่ท่า **idle south
(หันหน้าเข้ากล้อง)** ก็พอ (NPC ยืนเฉย ๆ) — วาง prompt เป็น "character description" ตามนี้:

⚠️ **อย่า clone Mage แล้วแก้ชื่ออย่างเดียว** — ช่อง description จะยังเป็น prompt Mage อยู่ → ได้ Mage ทับ.
ให้ clone เอา **settings** (56×56 · 8-dir · low top-down) แล้ว **แทนที่ description ทั้งก้อน** ด้วย prompt
เต็มข้างล่าง. โครงร่วม (`adult character (not a child), slightly stylized proportions about 3 heads
tall, full body head-to-toe, centered, clean 1px black outline`) = ตัวคุม "มู๊ดชุดเดียวกัน" — เก็บไว้
ทุกตัว เปลี่ยนแค่คน+ชุด:

- 🧙‍♂️ **guild master** (กลาง): `an elderly guild master around 60, wise calm expression, lean build, weathered fair skin, long grey hair and a long grey beard, kind eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline — dressed in a long dusk-purple hooded robe with brass-gold trim, holding a tall plain wooden staff, limited dusk-purple and brass-gold palette`
- 🧝 **blacksmith** (ซ้าย): `a sturdy guild blacksmith around 40, gruff focused expression, broad muscular build, tan skin, short dark hair, thick beard, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline — dressed in a brown leather apron over a cream tunic with rolled sleeves and brass-gold buckles, holding a smithing hammer, limited warm-wood brown and brass-gold palette`
- 🧑‍🌾 **adventurer** (ขวา): `a young guild adventurer around 22, eager confident expression, lean athletic build, light-tan skin, short brown hair, bright eyes, adult character (not a child), slightly stylized proportions about 3 heads tall, full body head-to-toe, centered, clean 1px black outline — dressed in a teal and brown traveler's cloak with leather boots and brass-gold clasps, a quiver and bow on the back, limited teal brown and brass-gold palette`

**Idle animation — Action Description** (Direction = South / หันเข้ากล้อง · ต้องมีคำ `in place`/`almost
motionless`/`idle` เพื่อให้ importer จับเป็น idle ถูก):

- 🧙‍♂️ guild master: `standing still in place, almost motionless, leaning slightly on the wooden staff, a calm idle breathing loop`
- 🧝 blacksmith: `standing still in place, almost motionless, resting the smithing hammer on one shoulder, a steady idle breathing loop`
- 🧑‍🌾 adventurer: `standing still in place, almost motionless, a relaxed idle breathing loop, glancing around`
- (ทั่วไป ถ้าใช้ตัวเดียว): `standing still in place, almost motionless, a calm idle breathing loop, facing forward`

> **ทำแล้ว ✅** — `bun tools/import-art.ts <export> --as npc:<id>` ดึง **idle south loop** → `overworld/npc/<id>/<N>.png` · `npcFrames(id)` (`overworld-bg.ts`) + `<GuildNpc>` cycle เฟรม · ปัจจุบันมี elder/smith/ranger. เพิ่มตัวใหม่ = gen → import → เติม `NPC_ART` + `GUILD_NPCS` (overworld-room.tsx).

### 7.1 ฉากพื้น T1–T3 (ใช้ร่วมทุกสาย) — มอน + ฉาก

ทุก prompt ด้านล่าง **copy ทั้งบรรทัดวางได้เลย** (constants รวมแล้ว) · Generation Mode = **Humanoid** ทุกตัว · idle/attack วาง Action Description จาก §7.A

**T1 · `grassland` · Bug Slime** — Mode **Humanoid**

- 🟢 monster: `a small round slime creature, translucent sickly-green jelly speckled with tiny glitch pixels, two big round cartoon eyes, tiny and slightly menacing, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene (400×128): `a side-view pixel-art battle background of a grassy meadow outside a town, a wide open flat grassy clearing across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, framing trees only at the far left and right edges, distant weathered stone town walls and rolling green hills in the background, clear blue sky with a few soft clouds, completely empty with no people, no characters, no creatures, no figures, cheerful, limited palette, clean pixel art, slightly stylized`

**T2 · `forest` · Error Wraith** — Mode **Humanoid**

- 👻 monster: `a floating ghostly wraith, tattered cloak woven from fragmented red error-glyphs, hollow glowing red eyes, wispy crimson smoke trail, eerie, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene (400×128): `a side-view pixel-art battle background of a dark whispering forest, a wide open flat mossy clearing across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, tall framing trees only at the far left and right edges, deep green foliage and drifting fog in the background, dim light filtering through the canopy, completely empty with no people, no characters, no creatures, no figures, eerie, limited palette, clean pixel art, slightly stylized`

**T3 · `dungeon` · Dungeon Brute** — Mode **Humanoid**

- 👹 monster: `a hulking armored troll brute, cracked iron-grey stone skin, heavy spiked club, glowing orange eyes, imposing, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene (400×128): `a side-view pixel-art battle background of an empty abandoned deep stone dungeon chamber, a wide open flat stone-floor clearing across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, framing stone pillars only at the far left and right edges, grey brick walls with flickering torches and heavy shadows in the background, completely empty, no people, no characters, no creatures, no figures, no adventurers, no skeletons, no guards, oppressive, limited palette, clean pixel art, slightly stylized`

**idle/attack (วางเหมือนกันทุกตัว — §7.A):**

- idle: `a slow idle loop, breathing and bobbing gently in place, facing left, keeping its form and colors unchanged`
- attack: `a forward attack, lunging left toward the opponent and striking then recovering, the body fully facing left the whole time, keeping its form and colors unchanged`

> import หลัง gen: `bun tools/import-art.ts <export> --as monster:grassland` (grassland/forest/dungeon) + `--as bg:grassland` (รูปฉาก)

### 7.2 แดนลับ T4 — 4 สายหลัก × branch a/b (8 แดน + บอสประจำแดน)

> idle/attack action + ขนาด 56×56 = §7.A · scene background prompt = §7.B (เติม \<SCENE\> ตามแดน)

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

**Mage T4 — copy-paste พร้อม import** (Mode **Humanoid** · monster 56×56 หันซ้าย + idle/attack §7.A · scene 400×128 Sidescroller, remove-bg OFF)

`skyforge_aether` (T4a · Skyforge Aether)

- 🌩️ monster: `a towering storm elemental archon, body of swirling storm cloud and crackling golden lightning, ornate floating gold armor plates, a glowing violet core, majestic, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a floating skyforge isle high in a stormy sky, an open flat clearing of golden stone across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, drifting storm clouds and glowing golden runes only at the far left and right edges, distant floating islands and crackling lightning in the background, deep violet sky with warm gold light, completely empty, no people, no characters, no creatures, no figures, majestic, limited palette, clean pixel art, slightly stylized`

`circuit_catacombs` (T4b · Circuit Catacombs)

- 💀 monster: `an undead lich sorcerer fused with glowing circuit-board veins, tattered royal robes, an exposed ribcage with a pulsing toxic-green core, floating, necromantic-tech, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a deep underground catacomb, an open flat clearing of cracked dark stone across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, glowing toxic-green circuit-board veins threading the stone walls only at the far left and right edges, ancient tombs and deep purple shadows in the background, dark stone with toxic-green glow, completely empty, no people, no characters, no creatures, no figures, no skeletons, eerie, limited palette, clean pixel art, slightly stylized`

> import: `--as monster:skyforge_aether` / `--as bg:skyforge_aether` (และ `circuit_catacombs`) → wire `MONSTER_SPRITES`/`SCENE_BGS` + `.scene-<key> .sky` letterbox

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

**Ranger / Rogue / Sage T4 — copy-paste พร้อม import** (Mode **Humanoid** · monster 56×56 หันซ้าย + idle/attack §7.A · scene 400×128 Sidescroller, remove-bg OFF)

`aurora_flux` (Ranger T4a · Aurora Flux)

- ✨ monster: `a shimmering wisp tyrant made of refracted rainbow light and motion-blur trails, a semi-transparent shifting form, a glowing teal core, graceful and elusive, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a weightless aurora realm, an open flat clearing of pale translucent crystal across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, flowing ribbons of teal and rainbow aurora light only at the far left and right edges, drifting light motes and soft glows in the background, teal sky with rainbow shimmer, completely empty, no people, no characters, no creatures, no figures, ethereal, limited palette, clean pixel art, slightly stylized`

`geometric_sanctum` (Ranger T4b · Geometric Sanctum)

- 🛡️ monster: `a stoic golem guardian built from perfect geometric panels and glowing blueprint grid-lines, a crisp angular form, orderly and imposing, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a pristine geometric sanctum, an open flat clearing of clean white tile across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, tall blueprint-blue geometric pillars and glowing grid-lines only at the far left and right edges, floating angular platforms in the background, crisp teal and blueprint-blue and white palette, completely empty, no people, no characters, no creatures, no figures, orderly, limited palette, clean pixel art, slightly stylized`

`quantum_rift` (Rogue T4a · Quantum Rift)

- 🌀 monster: `an elusive glitch-creature that phases in and out, a double-exposed flickering body, a fragmented half-transparent form, unsettling, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a glitching quantum rift, an open flat clearing of fractured dark glass across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, double-exposed phase-shifting shards and coral-magenta glitch streaks only at the far left and right edges, an unstable flickering void in the background, coral and glitch-magenta palette, completely empty, no people, no characters, no creatures, no figures, unstable, limited palette, clean pixel art, slightly stylized`

`noir_crime_scene` (Rogue T4b · Noir Crime Scene)

- 🕵️ monster: `a shadowy noir culprit in a long trench coat and hat, a body of living shadow, only two glowing coral eyes visible, mysterious, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a rainy noir back-alley crime scene at night, an open flat clearing of wet dark cobblestone across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, brick walls, fire escapes and a single coral spotlight beam only at the far left and right edges, falling rain and deep black-grey shadows in the background, monochrome noir with a coral accent, completely empty, no people, no characters, no creatures, no figures, moody, limited palette, clean pixel art, slightly stylized`

`oracles_athenaeum` (Sage T4a · Oracle's Athenaeum)

- 🦁 monster: `a winged sphinx oracle carved from amber stone, a body etched with glowing runes, wise all-seeing eyes, regal, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of an ancient floating library athenaeum, an open flat clearing of warm amber stone across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, towering bookshelves, floating scrolls and glowing amber runes only at the far left and right edges, drifting tomes and soft golden light in the background, amber gold and parchment palette, completely empty, no people, no characters, no creatures, no figures, scholarly, limited palette, clean pixel art, slightly stylized`

`conductors_nexus` (Sage T4b · Conductor's Nexus)

- 🤖 monster: `a multi-armed conductor golem of gilded clockwork, each hand holding a glowing light-baton, golden threads radiating outward, commanding, not human, full body, centered, slightly stylized, clean 1px black outline`
- 🖼️ scene: `a side-view pixel-art battle background of a grand orchestration control hall, an open flat clearing of polished gold floor across the entire lower third, the foreground level, clear and unobstructed with open ground on both the left and right, gilded clockwork pillars and glowing golden light-threads only at the far left and right edges, radiating multicolored control threads in the background, amber and gold with multicolored thread accents, completely empty, no people, no characters, no creatures, no figures, commanding, limited palette, clean pixel art, slightly stylized`

> import แต่ละแดน: `--as monster:<key>` + `--as bg:<key>` → wire `MONSTER_SPRITES`/`SCENE_BGS` + `.scene-<key> .sky` letterbox

#### T4 monster idle + attack — per-creature (boss-tier, grand)

T4 มอน = บอสประจำแดน → **อลังกว่า §7.A generic**: idle/attack เขียนตามฟอร์ม+สีของแต่ละตัว. กฎเดิม — Add Animation, **Start Frame = idle + "Keep first frame" ✓**, ~9 เฟรม, **facing left** (battle side-view), ปิดท้ายด้วย "keeping … unchanged" กันฟอร์ม/สีดริฟต์.

`skyforge_aether` · **Storm Archon**

- idle: `hovering in place wreathed in slow swirling storm clouds, golden lightning crackling softly across its armor and the violet core pulsing, the body facing left, keeping its towering form, gold plates and purple-gold colors unchanged`
- attack: `rearing back then hurling both arms forward to the left, unleashing a great fork of golden lightning from the violet core, the body fully facing left the whole time, keeping its form and purple-gold colors unchanged`

`circuit_catacombs` · **The Kernel Lich**

- idle: `floating in place with tattered robes drifting, the toxic-green core in its exposed ribcage pulsing and circuit-veins flickering across its body, facing left, keeping its lich form and deep-purple and toxic-green colors unchanged`
- attack: `raising a skeletal hand and thrusting it forward to the left, casting a surge of toxic-green necrotic circuit-energy, the body fully facing left the whole time, keeping its form and deep-purple and toxic-green colors unchanged`

`aurora_flux` · **Prism Wisp**

- idle: `drifting and shimmering in place, refracted rainbow light rippling through its semi-transparent body with faint motion-blur trails behind it and the teal core glowing, facing left, keeping its elusive form and teal and rainbow colors unchanged`
- attack: `darting back then streaking forward to the left in a graceful blur, loosing a lance of refracted rainbow light from the teal core, the body facing left the whole time, keeping its form and teal and rainbow colors unchanged`

`geometric_sanctum` · **The Grid Warden**

- idle: `standing firm and immovable, its geometric panels slowly rotating in place and blueprint grid-lines pulsing with light, facing left, keeping its crisp angular form and teal, blueprint-blue and white colors unchanged`
- attack: `reassembling its geometric panels and driving a massive blueprint-blue fist forward to the left, grid-lines flaring on impact, the body fully facing left the whole time, keeping its form and teal, blueprint-blue and white colors unchanged`

`quantum_rift` · **The Heisenbug**

- idle: `flickering and phasing in and out in place, the double-exposed body splitting and re-merging unsettlingly with fragments drifting, facing left, keeping its glitch form and coral and glitch-magenta colors unchanged`
- attack: `glitching forward to the left in a stuttering teleport, splitting into overlapping copies that lash out together, the body facing left the whole time, keeping its form and coral and glitch-magenta colors unchanged`

`noir_crime_scene` · **The Phantom Culprit**

- idle: `standing in shadow with its trench coat shifting like smoke and only the two coral eyes glowing steadily, the living-shadow body seeping faintly, facing left, keeping its noir form and black-grey and coral colors unchanged`
- attack: `surging forward to the left as a streak of living shadow, the coral eyes flaring and a clawed shadow-strike lashing out, the body facing left the whole time, keeping its form and black-grey and coral colors unchanged`

`oracles_athenaeum` · **The Domain Sphinx**

- idle: `seated regally with stone wings shifting slightly, the amber runes carved across its body glowing and dimming in a slow pulse, facing left, keeping its sphinx form and amber-gold and parchment colors unchanged`
- attack: `rising and sweeping a great stone paw forward to the left, the amber runes blazing as a wave of golden rune-light bursts out, the body fully facing left the whole time, keeping its form and amber-gold and parchment colors unchanged`

`conductors_nexus` · **The Orchestration Construct**

- idle: `hovering almost still in place with its many clockwork arms lowered and folded at rest, only a slow gentle bob and the light-batons dimmed to a faint pulse, the golden threads hanging slack and motionless, facing left, keeping its construct form and amber-gold and multicolored-thread colors unchanged`
- attack: `sweeping every baton-arm forward to the left in a grand conductor's flourish, loosing a radiating burst of golden light and multicolored threads, the body facing left the whole time, keeping its form and amber-gold and multicolored colors unchanged`

### 7.3 แดนลับสายลับ (secret class — ไม่มี branch, 1 แดน/บอส ต่อสาย)

> idle/attack action + ขนาด 56×56 = §7.A · scene background prompt = §7.B (เติม \<SCENE\> ตามแดน)

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
- **3.8b** ฉาก **กิล/เมือง** (home base, โทนอุ่น) + world-transition (fade + ป้าย "Now Entering") — โค้ดใช้ `.scene-guild` + `sceneNow` (Rest/fresh session_start = กิล); ตอนนี้ gradient placeholder, art เสียบหลัง CSS seam

### 7.5 Boss per realm (boss-encounter event) — copy-paste

The random boss-encounter (`.boss`) is keyed by **realm theme** (same key as the mob/scene), so each
area's boss matches its theme and T4a/b get their own. **Real sprites are wired for 11 realms** (starter
+ T4 main lines); the 5 secret realms still fall back to the 🐉 emoji.
Each boss is a **distinct, larger creature** of that realm — NOT the mob upgraded, a different beast
that just shares the realm's palette and mood, clearly bigger and more imposing than the regular mob.

**settings:** Character Creator · **64×64** (bigger canvas than the 56×56 mobs) · **facing left** (west,
toward the hero) · idle + keep-first-frame · Mode noted per boss (Quadruped for beasts/dragons,
Humanoid for titans/colossi).

**constants** (in every boss prompt): `a colossal boss creature, far larger and more imposing than a common monster, not human, menacing and powerful, full body, centered, slightly stylized, clean 1px black outline`

Each boss has its own **idle + attack** (Add Animation, **Keep first frame ✓**, ~9 frames, facing
left), tailored to the creature — same rule as the §7.A/§7.2 anims, ending in "keeping … unchanged".

> ⚠️ Keep idle and attack clearly different (else the gen blurs them): **idle = almost still** (the
> verbs are "almost motionless / only a slow breath / at rest" — no lunging, rearing, or charging),
> **attack = a big explosive strike** (wind/rear **far back**, then **lunge/slam/blast forward to the
> left**, then recoil). The windup-then-strike contrast is what reads as an attack.

#### Starter realms (T1–T3)

`boss/grassland` · **Thornback Behemoth** (Mode Quadruped) — grassland palette (green + earth-brown)

- art: `a colossal mossy grassland behemoth boss, a massive four-legged beast covered in thick bark, moss and blooming thorned vines, great curved horns and heavy stone-like hooves, earthy and overgrown, green and earth-brown palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing almost still and planted on all fours, only a slow heavy breath lifting its mossy flanks and a faint twitch of the vines, head up and calm at rest, facing left, keeping its form and colors unchanged`
- attack: `rearing its horns far back, then violently charging and ramming forward to the left, slamming its horns down hard before recoiling back — a big forceful lunge, facing left, keeping its form and colors unchanged`

`boss/forest` · **Elder Treant** (Mode Humanoid) — forest palette (deep green, ghostly)

- art: `a towering ancient treant boss, a giant walking gnarled tree-guardian with two glowing pale-green hollows for eyes, thick root-legs and branch-arms, draped in hanging moss and drifting spirit-wisps, deep forest-green palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing rooted and almost motionless, only a faint creak and a soft slow pulse of the green eye-hollows, branch-arms hanging at rest, facing left, keeping its form and colors unchanged`
- attack: `winding a huge branch-arm far back overhead, then swinging it down and forward to the left in a violent crushing slam that cracks the ground, then drawing back, facing left, keeping its form and colors unchanged`

`boss/dungeon` · **Stone Wyrm** (Mode Quadruped) — dungeon palette (grey stone + ember)

- art: `a massive armored cave wyrm boss, a huge serpentine dragon of cracked grey stone and bone coiling up from the dungeon floor, jagged teeth, tattered stone wings and glowing ember eyes, grey stone with an ember glow, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `coiled and resting almost still, only slow breathing and a faint glow of the ember eyes, head held low and calm, facing left, keeping its form and colors unchanged`
- attack: `pulling its head far back and rearing up, then snapping forward to the left with jaws gaping and blasting a roaring jet of ember fire, then recoiling, facing left, keeping its form and colors unchanged`

#### T4 realms (per branch)

`boss/skyforge_aether` · **Tempest Leviathan** (Mode Quadruped) — purple + gold

- art: `a colossal storm leviathan boss, a vast serpentine dragon woven from thundercloud and crackling golden lightning, broad storm-cloud wings and a blazing violet storm-eye, majestic, purple and gold palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `hovering almost still, only a slow drift of the storm-cloud around it and a faint flicker of the violet eye, calm, facing left, keeping its form and colors unchanged`
- attack: `coiling and rearing its head far back, then lashing forward to the left and unleashing a violent fork of golden lightning from its maw, then snapping back, facing left, keeping its form and colors unchanged`

`boss/circuit_catacombs` · **Circuit Wyrmking** (Mode Quadruped) — deep-purple + toxic-green

- art: `a giant undead circuit-dragon boss, a massive skeletal wyrm fused with glowing toxic-green circuit-board plating, a pulsing green core in its exposed ribcage, necrotic-tech, deep-purple and toxic-green palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `coiled and floating almost still, only the toxic-green core pulsing softly in its ribcage, calm, facing left, keeping its form and colors unchanged`
- attack: `drawing its skull far back, then lunging forward to the left and blasting a violent surge of toxic-green necrotic energy from its jaws, then recoiling, facing left, keeping its form and colors unchanged`

`boss/aurora_flux` · **Aurora Leviathan** (Mode Quadruped) — teal + rainbow

- art: `a vast celestial light-whale boss, a colossal translucent leviathan of flowing teal and rainbow aurora drifting weightlessly, trailing motion-blur light-motes, ethereal, teal and rainbow palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `drifting almost motionless, only a gentle ripple of aurora along its body and a few slow trailing light-motes, calm, facing left, keeping its form and colors unchanged`
- attack: `sweeping far back, then surging powerfully forward to the left and firing a brilliant lance of refracted rainbow light, then gliding back, facing left, keeping its form and colors unchanged`

`boss/geometric_sanctum` · **Prism Colossus** (Mode Humanoid) — teal + blueprint-blue + white

- art: `a towering crystalline colossus boss, a giant angular titan of clear blueprint-blue crystal and glowing grid-lines, sharp geometric plating and a luminous core, orderly and immense, teal, blueprint-blue and white palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing immense and almost perfectly still, only a faint slow shimmer of its facets and a soft core glow, at rest, facing left, keeping its form and colors unchanged`
- attack: `cocking a huge crystalline fist far back, then driving it forward to the left in a violent shattering slam with grid-lines flaring on impact, then pulling back, facing left, keeping its form and colors unchanged`

`boss/quantum_rift` · **Rift Devourer** (Mode Quadruped) — coral + glitch-magenta

- art: `a colossal phasing void-beast boss, a huge double-exposed glitch-leviathan flickering and tearing between states, a fragmented coral-magenta maw and unstable shifting limbs, unsettling, coral and glitch-magenta palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `hovering almost still, only a faint flicker along its double-exposed edges as it holds together, calm, facing left, keeping its form and colors unchanged`
- attack: `glitch-teleporting sharply far back, then exploding forward to the left in a violent stuttering lunge with its fragmented maw tearing wide open to bite, then snapping back, facing left, keeping its form and colors unchanged`

`boss/noir_crime_scene` · **Shadow Behemoth** (Mode Quadruped) — black-grey + coral

- art: `a towering noir shadow-beast boss, a massive hulking hound made of living darkness prowling in the rain, many glowing coral eyes and dripping shadow-smoke, mysterious, monochrome black-grey with a coral glow, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing low and almost still, only a slow drip of shadow-smoke and a steady glow of the coral eyes, calm, facing left, keeping its form and colors unchanged`
- attack: `crouching and coiling far back, then pouncing explosively forward to the left with jaws snapping shut and the coral eyes flaring, then landing back, facing left, keeping its form and colors unchanged`

`boss/oracles_athenaeum` · **Rune Colossus** (Mode Humanoid) — amber-gold + parchment

- art: `a colossal amber-stone guardian boss, a giant winged statue-titan carved from glowing amber sandstone, its body blazing with golden runes, vast feathered stone wings, regal and ancient, amber-gold and parchment palette, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing vast and almost perfectly still, only a slow dim-and-brighten of its golden runes, wings folded at rest, facing left, keeping its form and colors unchanged`
- attack: `raising both massive arms high overhead, then smashing them down and forward to the left in a violent rune-blazing impact, then drawing back, facing left, keeping its form and colors unchanged`

`boss/conductors_nexus` · **Clockwork Colossus** (Mode Humanoid) — amber + gold + multicolor

- art: `a towering gilded clockwork colossus boss, a massive multi-armed brass automaton of turning gears and glowing golden threads, a radiant core in its chest, commanding, amber and gold with multicolored thread accents, not human, full body, centered, slightly stylized, clean 1px black outline`
- idle: `standing almost still, only a slow idle turn of a few gears and a soft pulse of the chest core, arms lowered at rest, facing left, keeping its form and colors unchanged`
- attack: `winding all its baton-arms far back at once, then sweeping them forcefully forward to the left and unleashing a violent radiating burst of golden light, then retracting, facing left, keeping its form and colors unchanged`

> import: `bun tools/import-art.ts <export> --as boss:<theme>` → `sprites/boss/<theme>/{idle,attack}/`
> · `bossSet(theme)` (`boss.ts`) + `<BossEncounter>` เลือกตาม `sceneInfo.theme`. **ทำแล้ว ✅ สำหรับ 11
> แดน** (starter + T4 สายหลัก); แดนลับ secret 5 แดนยังเป็น 🐉 emoji.

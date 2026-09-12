-- backend/migrations/001_create_graph_tables.sql

-- ตารางกลุ่ม "ข้อมูลกราฟ" — เขียนครั้งเดียวตอน seed แล้วอ่านอย่างเดียว

--   manuals  →  graphs  →  nodes
--   (คู่มือ)    (อาการ)    (ขั้นตอน)

-- ทุกตารางใช้ utf8mb4 เพราะข้อความในกราฟเป็นภาษาไทย
-- ถ้าใช้ utf8 (ซึ่งใน MySQL คือ utf8mb3) ตัวอักษรบางตัวจะเก็บไม่ได้

-- manuals — 1 แถวต่อคู่มือ 1 เล่ม

CREATE TABLE IF NOT EXISTS manuals (
  manual_id        VARCHAR(80)  NOT NULL,
  device_category  VARCHAR(40)  NOT NULL,
  brand            VARCHAR(40)  NOT NULL,
  model_pattern    VARCHAR(60)  NOT NULL,
  source_manual    VARCHAR(200) NOT NULL COMMENT 'ชื่อไฟล์คู่มือต้นฉบับ ใช้สร้างการอ้างอิง',
  graph_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (manual_id),
  INDEX idx_manuals_category (device_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--graphs — 1 แถวต่ออาการ 1 อาการ

CREATE TABLE IF NOT EXISTS graphs (
  graph_id           VARCHAR(120) NOT NULL,
  manual_id          VARCHAR(80)  NOT NULL,

  entry_symptom      TEXT NOT NULL COMMENT 'อาการตามคู่มือ (อังกฤษ)',
  entry_symptom_th   TEXT NULL     COMMENT 'อาการภาษาไทย ใช้แสดงผลและค้นหา',
  entry_symptom_aliases JSON NULL  COMMENT 'คำพ้องที่ผู้ใช้อาจพิมพ์ เก็บเป็น array',

  -- ที่มาของคำตอบ ใช้สร้างการอ้างอิงที่ตรวจสอบย้อนได้
  source             VARCHAR(200) NOT NULL,
  page_start         SMALLINT UNSIGNED NOT NULL,
  page_end           SMALLINT UNSIGNED NOT NULL,
  source_chunk_id    VARCHAR(200) NOT NULL,

  severity           ENUM('low','medium','high','critical') NULL,
  difficulty         ENUM('easy','medium','hard') NULL,

  -- ค่าคงที่จากคู่มือ (เช่น "ระยะท่อขั้นต่ำ 3 เมตร") เป็น provenance เฉยๆ
  config             JSON NULL,

  -- โหนดแรกที่จะเริ่มเดิน
  -- ตั้งใจไม่ใส่ FOREIGN KEY ไปที่ nodes เพราะจะเป็นวงกลม:
  --   graphs ต้องมีก่อน nodes (nodes อ้าง graph_id)
  --   แต่ graphs.entry_node ก็อ้าง nodes อีกที
  entry_node         VARCHAR(60) NOT NULL,

  schema_version     TINYINT UNSIGNED NOT NULL DEFAULT 2,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (graph_id),

  -- ลบคู่มือ = ลบกราฟของคู่มือนั้นทั้งหมด (ข้อมูลกราฟไม่มีค่าถ้าไม่มีคู่มือ)
  CONSTRAINT fk_graphs_manual
    FOREIGN KEY (manual_id) REFERENCES manuals (manual_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_graphs_manual (manual_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- nodes — 1 แถวต่อโหนด

-- โหนด 5 ประเภทมี field ไม่เหมือนกัน แต่เก็บในตารางเดียว
-- คอลัมน์ที่ประเภทนั้นไม่ใช้จะเป็น NULL

--   ประเภท        คอลัมน์ที่ใช้
--   checkpoint    text_content, on_yes, on_no
--   instruction   text_content, next_node, safety_critical, safety_warning
--   input         text_content, next_node, on_invalid, input_type,
--                 input_pattern, store_as
--   resolution    text_content, outcome_kind
--   escalation    text_content, outcome_kind

-- ทำไมรวม question / content / prompt เป็น text_content ช่องเดียว:
-- ทั้งสาม field เป็น "ข้อความที่แสดงให้ผู้ใช้เห็น" เหมือนกัน ต่างแค่ชื่อ
-- ตัว engine เองก็มีฟังก์ชัน getRawText() ที่รวมสามอันนี้อยู่แล้ว
-- ตอนอ่านออกมา repository จะแปลงกลับเป็นชื่อ field ที่ถูกต้องตาม node_type

CREATE TABLE IF NOT EXISTS nodes (
  graph_id        VARCHAR(120) NOT NULL,
  node_id         VARCHAR(60)  NOT NULL,

  node_type       ENUM('checkpoint','instruction','input','resolution','escalation') NOT NULL,
  text_content    TEXT NOT NULL COMMENT 'question / content / prompt แล้วแต่ node_type',

  -- เส้นเชื่อมออก
  on_yes          VARCHAR(60) NULL COMMENT 'checkpoint เท่านั้น',
  on_no           VARCHAR(60) NULL COMMENT 'checkpoint เท่านั้น',
  next_node       VARCHAR(60) NULL COMMENT 'instruction และ input',
  on_invalid      VARCHAR(60) NULL COMMENT 'input เท่านั้น ถ้า NULL = วนกลับโหนดเดิม',

  -- เฉพาะ input
  input_type      ENUM('error_code','model_number','number','text') NULL,
  input_pattern   VARCHAR(255) NULL COMMENT 'regex ที่คำตอบต้องผ่าน',
  store_as        VARCHAR(60)  NULL COMMENT 'key ที่เก็บค่าลง session.variables',

  -- เฉพาะโหนดจบ
  outcome_kind    ENUM('user_fixed','normal_behavior','handoff_informed','handoff_unknown') NULL,

  -- ความปลอดภัย — ใช้จริงกับ instruction เท่านั้น
  safety_critical BOOLEAN NOT NULL DEFAULT FALSE,
  safety_warning  TEXT NULL,

  has_image       BOOLEAN NOT NULL DEFAULT FALSE,
  image_url       VARCHAR(255) NULL,
  author_note     TEXT NULL COMMENT 'ระบุข้อความที่ผู้พัฒนาเพิ่มเอง ไม่ได้มาจากคู่มือ',
  external_reference JSON NULL,

  -- รักษาลำดับโหนดตามไฟล์ต้นฉบับ เพื่อให้อ่านออกมาแล้วเรียงเหมือนเดิม
  display_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- node_id ซ้ำข้ามกราฟได้ (เช่น n1 มีในทุกกราฟ) แต่ห้ามซ้ำในกราฟเดียวกัน
  PRIMARY KEY (graph_id, node_id),

  CONSTRAINT fk_nodes_graph
    FOREIGN KEY (graph_id) REFERENCES graphs (graph_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  INDEX idx_nodes_type (node_type),
  INDEX idx_nodes_safety (safety_critical)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
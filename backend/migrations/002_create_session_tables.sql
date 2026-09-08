-- backend/migrations/002_create_session_tables.sql
--
-- ตารางกลุ่ม "ข้อมูลผู้ใช้" — เขียนตลอดเวลาระหว่างที่มีคนใช้งาน
--
--   sessions  →  session_history
--   (อยู่ตรงไหน)   (เดินมายังไง)

-- ============================================================
-- sessions — สถานะปัจจุบันของการวินิจฉัย 1 ครั้ง
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
  -- MySQL ไม่มีชนิดข้อมูล uuid แบบ PostgreSQL
  -- ใช้ CHAR(36) เก็บรูปแบบมีขีด เช่น 'a1b2c3d4-...'
  -- (BINARY(16) ประหยัดกว่า แต่อ่านตอน debug ไม่ออก จึงเลือกอ่านง่ายไว้ก่อน)
  session_id       CHAR(36) NOT NULL,

  graph_id         VARCHAR(120) NOT NULL,
  current_node_id  VARCHAR(60)  NOT NULL,
  status           ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',

  -- ค่าที่ผู้ใช้กรอกจากโหนด input เช่น {"error_code": "E1"}
  -- ใช้ JSON ได้สบายใจตรงนี้ เพราะเป็นข้อมูลชั่วคราวของ session
  -- ไม่ใช่ข้อมูลหลักของระบบที่ต้อง query แยก field
  variables        JSON NOT NULL,

  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- หมดอายุ 2 ชั่วโมง เท่ากับ TTL เดิมของ SessionStore ที่เก็บใน Map
  expires_at       TIMESTAMP NOT NULL,

  PRIMARY KEY (session_id),

  -- RESTRICT ไม่ใช่ CASCADE โดยตั้งใจ:
  -- ถ้าเผลอลบกราฟที่มีคนกำลังใช้อยู่ ต้องให้ error ไม่ใช่ลบ session ของผู้ใช้ทิ้งเงียบๆ
  -- (seed script จึงใช้วิธี upsert แทนการลบทิ้งแล้วเขียนใหม่)
  CONSTRAINT fk_sessions_graph
    FOREIGN KEY (graph_id) REFERENCES graphs (graph_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  -- ใช้ตอนกวาด session หมดอายุ
  INDEX idx_sessions_expires (expires_at),
  INDEX idx_sessions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- session_history — เดินผ่านโหนดอะไร ตอบอะไรไป
-- ============================================================
--
-- SessionState.history เป็น array ของ { nodeId, action }
-- เก็บเป็นตารางแยกแทนที่จะยัดเป็น JSON เพราะข้อมูลนี้จะถูกเอาไปใช้ต่อ
-- ในหน้า Analytics และ History (นับว่าอาการไหนถูกถามบ่อย จบที่ผลลัพธ์แบบไหน)
-- ถ้าเก็บเป็น JSON ก้อนเดียวจะ query แบบนั้นไม่ได้

CREATE TABLE IF NOT EXISTS session_history (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id   CHAR(36) NOT NULL,

  -- ลำดับที่เท่าไรใน session นี้ เริ่มที่ 0
  step_order   SMALLINT UNSIGNED NOT NULL,

  node_id      VARCHAR(60) NOT NULL COMMENT 'โหนดที่ผู้ใช้อยู่ตอนส่ง action นี้',
  action_type  ENUM('answer','continue','confirm_safety','input') NOT NULL,

  -- มีค่าเฉพาะ action ที่มี value (answer และ input)
  action_value VARCHAR(255) NULL,

  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  -- ลบ session = ลบประวัติของ session นั้นด้วย (ประวัติไม่มีความหมายถ้าไม่มี session)
  CONSTRAINT fk_history_session
    FOREIGN KEY (session_id) REFERENCES sessions (session_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  -- กันบันทึกลำดับซ้ำ เช่น กรณี request ถูกส่งซ้ำสองครั้ง
  UNIQUE KEY uq_history_step (session_id, step_order),

  INDEX idx_history_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
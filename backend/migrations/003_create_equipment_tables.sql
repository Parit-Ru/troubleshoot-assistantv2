ALTER TABLE manuals
  MODIFY COLUMN device_category
    ENUM('Air Conditioner','Microwave','Refrigerator','Television','Washing Machine')
    NOT NULL;
-- equipment — แคตตาล็อกอุปกรณ์ 1 แถวต่อ 1 ชิ้น

CREATE TABLE IF NOT EXISTS equipment (
  -- ใช้ slug ที่คนอ่านออก ไม่ใช่ AUTO_INCREMENT
  equipment_id  VARCHAR(60)  NOT NULL,

  name_th       VARCHAR(100) NOT NULL,
  name_en       VARCHAR(100) NOT NULL COMMENT 'เผื่อ UI สองภาษา',

  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (equipment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เป็นความสัมพันธ์ many-to-many พร้อมข้อมูลเพิ่มบนเส้นเชื่อม
--   อุปกรณ์ 1 ชิ้น ใช้ได้หลายประเภทเครื่อง
--   ประเภท 1 อัน ใช้อุปกรณ์หลายชิ้น

CREATE TABLE IF NOT EXISTS equipment_usage (
  device_category ENUM('Air Conditioner','Microwave','Refrigerator','Television','Washing Machine') NOT NULL,
  equipment_id    VARCHAR(60) NOT NULL,
  purpose_th      TEXT NOT NULL COMMENT 'ใช้ทำอะไรกับเครื่องประเภทนี้',
  source_page     SMALLINT UNSIGNED NULL COMMENT 'เลขหน้าคู่มือ ถ้าอ้างอิงได้',
  author_note     TEXT NULL COMMENT 'กำกับเมื่อผู้พัฒนาเขียนเอง',
  display_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- อุปกรณ์ชิ้นเดียวกันใช้ได้หลายประเภท แต่ห้ามซ้ำในประเภทเดียวกัน
  PRIMARY KEY (device_category, equipment_id),

  CONSTRAINT fk_usage_equipment
    FOREIGN KEY (equipment_id) REFERENCES equipment (equipment_id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT chk_usage_provenance
    CHECK (source_page IS NOT NULL OR author_note IS NOT NULL),

  INDEX idx_usage_category (device_category, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
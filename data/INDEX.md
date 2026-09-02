# ดัชนี Troubleshooting Graph

> ไฟล์นี้สร้างอัตโนมัติด้วย `python scripts/build_index.py`
> อย่าแก้ด้วยมือ เพราะจะถูกเขียนทับ

**คู่มือ 1 เล่ม · รวม 13 graph**

## คู่มือที่มี

| manual_id | ยี่ห้อ | ประเภท | รุ่น | Graph |
|---|---|---|---|---:|
| `samsung_ac_ar70h` | Samsung | Air Conditioner | `AR70H**D1***` | 13 |

## รายการ graph ทั้งหมด

| # | อาการ (ไทย) | graph_id | Node | Safety | หน้า |
|:---:|---|---|:---:|:---:|:---:|
| 1 | น้ำหยดจากคอมเพรสเซอร์ เครื่องนอกมีน้ำหยด | `water_drips_outdoor` | 3 | - | 44-44 |
| 2 | ปรับทิศทางลมไม่ได้ บานสวิงไม่ขยับ | `cannot_change_airflow_direction` | 5 | - | 43-43 |
| 3 | ปรับอุณหภูมิไม่ได้ | `cannot_change_temperature` | 5 | - | 43-43 |
| 4 | มีหยดน้ำเกาะที่ตัวแอร์ แอร์มีฝ้า | `condensation_indoor` | 5 | - | 44-44 |
| 5 | หน้าจอแอร์ขึ้นรหัสข้อผิดพลาด ขึ้น error | `error_message` | 5 | - | 44-44 |
| 6 | ตั้งเวลาเปิดปิดไม่ได้ ตั้งแล้วไม่ทำงาน | `timer_not_working` | 5 | - | 43-43 |
| 7 | ปรับความแรงพัดลมไม่ได้ | `cannot_change_fan_speed` | 7 | - | 43-43 |
| 8 | ไฟกะพริบที่หน้าจอแอร์ ไฟกระพริบไม่หยุด | `indicator_blinking` | 7 | 2 | 43-43 |
| 9 | แอร์มีเสียงดัง เสียงผิดปกติ | `unit_generating_noise` | 7 | - | 44-44 |
| 10 | แอร์มีกลิ่นเหม็น กลิ่นอับ | `odors_from_unit` | 9 | - | 44-44 |
| 11 | แอร์ไม่ทำงาน เปิดไม่ติด | `stops_working` | 10 | 1 | 43-43 |
| 12 | รีโมทใช้ไม่ได้ กดแล้วไม่ตอบสนอง | `remote_not_working` | 11 | - | 43-43 |
| 13 | แอร์ไม่เย็น ลมออกมาไม่เย็น | `improper_airflow_temperature` | 16 | - | 43-43 |

## สรุป

| รายการ | จำนวน |
|---|---:|
| Graph | 13 |
| Node ทั้งหมด | 95 |
| Node ที่มี safety gate | 3 |

## แยกตามประเภท node

| ประเภท | จำนวน |
|---|---:|
| `checkpoint` | 41 |
| `instruction` | 24 |
| `escalation` | 17 |
| `resolution` | 12 |
| `input` | 1 |

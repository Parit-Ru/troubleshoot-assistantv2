# backend/scripts/demo-safety-gate.ps1
#
# พิสูจน์ว่าด่านความปลอดภัยถูกบังคับที่เซิร์ฟเวอร์จริง ไม่ใช่ที่หน้าเว็บ
# สคริปต์นี้ยิง HTTP เข้า backend ตรงๆ ไม่เปิดเบราว์เซอร์เลยแม้แต่ครั้งเดียว
#
# ทำไมต้องมีสคริปต์นี้ (ตามที่ Overview.md ข้อ 11 เขียนไว้):
#   ถ้าสาธิตผ่านหน้าเว็บอย่างเดียว กรรมการอาจคิดว่าหน้าเว็บเป็นคนห้าม
#   สคริปต์นี้พิสูจน์ว่าต่อให้ข้ามหน้าเว็บไปเลย เซิร์ฟเวอร์ก็ยังปฏิเสธเหมือนเดิม
#
# ก่อนรัน: เปิด backend ค้างไว้ก่อนด้วย npm run start:dev (คนละหน้าต่าง)
#
# วิธีรัน:  powershell -File backend/scripts/demo-safety-gate.ps1
#   หรือ:   .\demo-safety-gate.ps1   (ถ้าอยู่ใน backend/scripts/ แล้ว)
#
# ใช้ Invoke-RestMethod ที่มากับ Windows อยู่แล้ว ไม่ต้องลงอะไรเพิ่ม

$ErrorActionPreference = 'Stop'
$baseUrl = 'http://localhost:3000'
$graphId = 'samsung_ac_ar70h_stops_working'

function Write-Section($title) {
    Write-Host ""
    Write-Host "=== $title ===" -ForegroundColor Cyan
}

function Invoke-Api {
    <#
      ห่อ Invoke-RestMethod อีกชั้นเดียว เพราะปกติ Invoke-RestMethod จะ "throw" ทันที
      ที่เจอ HTTP status ที่ไม่ใช่ 2xx (ต่างจาก fetch ของเบราว์เซอร์ที่คืนค่าปกติ
      แล้วให้โค้ดเช็ค response.ok เอง) ฟังก์ชันนี้จับ error แล้วดึง body ของ error
      ออกมาอ่านเป็น JSON เดียวกับกรณีสำเร็จ เพื่อให้เรียกใช้ง่ายเหมือนกันทั้งสองแบบ

      $_.ErrorDetails.Message เก็บ body ของ response ไว้เหมือนกันทั้ง Windows
      PowerShell 5.1 และ PowerShell 7 จึงใช้วิธีเดียวกันได้ทั้งสองเวอร์ชัน
    #>
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )

    $uri = "$baseUrl$Path"
    try {
        if ($null -ne $Body) {
            $json = $Body | ConvertTo-Json -Compress
            return Invoke-RestMethod -Method $Method -Uri $uri -ContentType 'application/json' -Body $json
        } else {
            return Invoke-RestMethod -Method $Method -Uri $uri
        }
    } catch {
        if ($_.ErrorDetails.Message) {
            return $_.ErrorDetails.Message | ConvertFrom-Json
        }
        # ไม่มี body ของ error เลย แปลว่าต่อเซิร์ฟเวอร์ไม่ติดจริงๆ (ดับ, port ผิด ฯลฯ)
        # โยน error เดิมต่อ ให้เห็นข้อความจริงจาก .NET แทนที่จะพังตอนแปลง JSON
        throw
    }
}

Write-Section "1. เริ่ม session ใหม่: อาการแอร์ไม่ทำงาน"
$session = Invoke-Api -Method Post -Path '/traversal/sessions' -Body @{ graphId = $graphId }
Write-Host "sessionId: $($session.sessionId)"
Write-Host "โหนดแรก:   $($session.node.nodeId)"

Write-Section "2. ตอบ 'ใช่' สองครั้ง (เดินไปจนถึงสถานะที่ต้องยืนยันคำเตือนก่อน)"
$answerYes = @{ type = 'answer'; value = 'yes' }
$session = Invoke-Api -Method Post -Path "/traversal/sessions/$($session.sessionId)/actions" -Body $answerYes
$session = Invoke-Api -Method Post -Path "/traversal/sessions/$($session.sessionId)/actions" -Body $answerYes
Write-Host "ตอนนี้อยู่ที่:               $($session.node.nodeId)"
Write-Host "ต้องยืนยันคำเตือนก่อนไหม:   $($session.node.requiresSafetyConfirmation)"

if (-not $session.node.requiresSafetyConfirmation) {
    Write-Host "ผิดคาด: โหนดนี้ไม่ควรต้องยืนยันคำเตือน — ตรวจข้อมูลกราฟอีกที" -ForegroundColor Red
    exit 1
}

Write-Section "3. ** ข้อสอบหลัก ** ลองส่ง continue ข้ามคำเตือนไปเลย โดยไม่ยืนยันก่อน"
$rejected = Invoke-Api -Method Post -Path "/traversal/sessions/$($session.sessionId)/actions" -Body @{ type = 'continue' }
Write-Host "statusCode ที่เซิร์ฟเวอร์ตอบ: $($rejected.statusCode)"
Write-Host "code:                        $($rejected.code)"
Write-Host "message:                     $($rejected.message)"

if ($rejected.statusCode -eq 400 -and $rejected.code -eq 'SAFETY_CONFIRMATION_REQUIRED') {
    Write-Host "ผ่าน: เซิร์ฟเวอร์ปฏิเสธจริง ไม่ใช่หน้าเว็บเป็นคนห้าม" -ForegroundColor Green
} else {
    Write-Host "ล้มเหลว: คาดว่าจะได้ 400 SAFETY_CONFIRMATION_REQUIRED" -ForegroundColor Red
    exit 1
}

Write-Section "4. อ่านสถานะซ้ำ — ต้องยังอยู่โหนดเดิม ไม่ขยับไปไหน"
$after = Invoke-Api -Method Get -Path "/traversal/sessions/$($session.sessionId)"
Write-Host "โหนดปัจจุบัน: $($after.node.nodeId)"

if ($after.node.nodeId -eq $session.node.nodeId) {
    Write-Host "ผ่าน: สถานะไม่ขยับแม้แต่ก้าวเดียว" -ForegroundColor Green
} else {
    Write-Host "ล้มเหลว: สถานะขยับไปแล้ว ทั้งที่ควรถูกปฏิเสธ" -ForegroundColor Red
    exit 1
}

Write-Section "5. เก็บกวาด: ลบ session ทดสอบนี้ทิ้ง"
Invoke-Api -Method Delete -Path "/traversal/sessions/$($session.sessionId)" | Out-Null
Write-Host "ลบ session ทดสอบเรียบร้อย"

Write-Host ""
Write-Host "สรุป: ด่านความปลอดภัยถูกบังคับที่เซิร์ฟเวอร์จริง พิสูจน์ผ่าน HTTP ตรงๆ โดยไม่เปิดเบราว์เซอร์เลย" -ForegroundColor Green
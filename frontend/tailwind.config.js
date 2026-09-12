/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0F1A",
        panel: "#0E1422",
        line: "#1E293B",
        accent: "#F59E0B",

        ink: {
          DEFAULT: "#F1F5F9",
          soft: "#94A3B8",
          faint: "#64748B",
        },

        success: "#4ADE80",
        info: "#60A5FA",
        danger: "#F87171",
      },

      fontFamily: {
        // ใช้ฟอนต์ที่ติดมากับเครื่องเท่านั้น ไล่ตามระบบปฏิบัติการ
        // Windows → Leelawadee UI, Android → Noto Sans Thai, iOS และ macOS → Thonburi
        sans: ['"Leelawadee UI"', '"Noto Sans Thai"', "Thonburi", "Tahoma", "sans-serif"],
        // ใช้กับรหัสซึ่งเป็นตัวละตินล้วน จึงไม่ต้องมีฟอนต์ไทยในลำดับ
        mono: ["Consolas", '"Courier New"', "monospace"],
      },
    },
  },
  plugins: [],
}
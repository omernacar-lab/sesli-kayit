import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { konum, bebekYasi, gorevler, maas, ekBilgi } = await req.json();

    // Ana metin oluştur
    const lines: string[] = [];
    if (konum) lines.push(`📍 Location: ${konum}`);
    if (bebekYasi) lines.push(`👶 Child: ${bebekYasi}`);
    if (gorevler) lines.push(`✅ Duties: ${gorevler}`);
    if (maas) lines.push(`💰 Salary: ${maas}`);
    if (ekBilgi) lines.push(`ℹ️ Notes: ${ekBilgi}`);

    const image = new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(145deg, #B8926A 0%, #A07850 50%, #8B6540 100%)",
            padding: "60px",
            fontFamily: "sans-serif",
          }}
        >
          {/* Logo / Başlık */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "40px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: "16px",
              padding: "12px 32px",
            }}
          >
            <span style={{ fontSize: 28, color: "white", fontWeight: 700 }}>
              🏠 Nanny & Cleaning Services
            </span>
          </div>

          {/* İçerik Kartı */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "24px",
              width: "100%",
            }}
          >
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: i === 3 ? 42 : 32,
                  color: "white",
                  fontWeight: i === 3 ? 800 : 600,
                  textAlign: "center",
                  lineHeight: 1.4,
                  textShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                {line}
              </div>
            ))}
          </div>

          {/* Alt Bilgi */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "48px",
              fontSize: 20,
              color: "rgba(255,255,255,0.7)",
              borderTop: "1px solid rgba(255,255,255,0.3)",
              paddingTop: "20px",
              width: "80%",
            }}
          >
            📞 Send a DM to get in touch
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1080,
      }
    );

    return image;
  } catch (error: any) {
    console.error("İlan görsel hatası:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

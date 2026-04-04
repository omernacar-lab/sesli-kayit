import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const today = new Date().toLocaleDateString("tr-TR");

    // Sütun sırası: Excel'deki sırayla eşleşiyor
    // Müşteri Kodu | Tarih | Ad Soyad | Telefon | Şehir | Kaynak | Talep Türü | Bütçe | Durum | Son Görüşme | Sonraki Aksiyon | Notlar
    const row = [
      data.musteriKodu || "",
      today,
      data.adSoyad || "",
      data.telefon || "",
      data.sehir || "",
      data.kaynak || "",
      data.talepTuru || "",
      data.butce || "",
      data.durum || "",
      data.sonGorusme || "",
      data.sonrakiAksiyon || "",
      data.notlar || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "müşteri Takip!A:L",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    return NextResponse.json({ success: true, row });
  } catch (error: any) {
    console.error("Sheets hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Sheet'ten mevcut kayıtları oku
export async function GET() {
  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "müşteri Takip!A:L",
    });

    const rows = response.data.values || [];
    return NextResponse.json({ rows });
  } catch (error: any) {
    console.error("Sheets okuma hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PARSE_PROMPT = `Sen bir müşteri bilgisi çıkarma asistanısın. Bakıcı ve temizlik hizmeti veren bir ajans için çalışıyorsun.

Sana bir ses kaydının transkripsiyonu verilecek. Bu metinden aşağıdaki bilgileri JSON formatında çıkar:

{
  "adSoyad": "müşterinin adı soyadı",
  "telefon": "telefon numarası (varsa)",
  "sehir": "şehir",
  "kaynak": "müşteri nereden geldi (Instagram, Referans, vs.)",
  "talepTuru": "ne tür hizmet istiyor (Bakıcı, Temizlik, Bakıcı + Temizlik, vs.)",
  "butce": "bütçe bilgisi",
  "durum": "İlk Görüşme / Anlaşıldı / Denemede / Beklemede / İptal",
  "sonGorusme": "görüşmede konuşulan önemli detaylar",
  "sonrakiAksiyon": "yapılması gereken sonraki adım",
  "notlar": "ek notlar (çocuk yaşları, özel durumlar vs.)"
}

Eğer bir bilgi metinde yoksa boş string "" koy. Sadece JSON döndür, başka bir şey yazma.`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "Metin bulunamadı" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "user", content: `${PARSE_PROMPT}\n\nTranskripsiyon:\n${text}` },
      ],
    });

    const content = completion.choices[0].message.content || "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const num = String(Math.floor(Math.random() * 9000) + 1000);
    parsed.musteriKodu = `N-${num}`;

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Parse hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
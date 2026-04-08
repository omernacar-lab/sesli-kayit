import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PARSE_PROMPT = `Sen bir iş ilanı bilgisi çıkarma asistanısın. Bakıcı ve temizlik hizmeti veren bir ajans için çalışıyorsun.

Sana bir ses kaydının transkripsiyonu verilecek. Bu metinden aşağıdaki bilgileri JSON formatında çıkar:

{
  "konum": "şehir ve ilçe bilgisi (örn: Sapanca, Sakarya)",
  "bebekYasi": "bebek/çocuk yaş bilgisi (örn: 9 aylık bebek)",
  "gorevler": "yapılacak işlerin listesi (örn: Bebek bakımı, günlük 15 dk köpek gezdirme, ev temizliği)",
  "maas": "maaş bilgisi (örn: 33.000TL + 300TL)",
  "ekBilgi": "varsa ek bilgi (örn: yatılı, gündüzlü, acil, vb.)"
}

Görevleri kısa ve net yaz, virgülle ayır. Eğer bir bilgi metinde yoksa boş string "" koy. Sadece JSON döndür, başka bir şey yazma.`;

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "Metin bulunamadı" }, { status: 400 });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: `${PARSE_PROMPT}\n\nTranskripsiyon:\n${text}` },
      ],
    });

    const content = completion.choices[0].message.content || "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("İlan parse hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

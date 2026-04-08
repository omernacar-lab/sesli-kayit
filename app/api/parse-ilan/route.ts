import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PARSE_PROMPT = `Sen bir iş ilanı bilgisi çıkarma asistanısın. Bakıcı ve temizlik hizmeti veren bir ajans için çalışıyorsun.

Sana Türkçe bir ses kaydının transkripsiyonu verilecek. Bu metinden bilgileri çıkar ve TÜM DEĞERLERİ İNGİLİZCE olarak JSON formatında döndür:

{
  "konum": "city and district in English (e.g., Sapanca, Sakarya)",
  "bebekYasi": "baby/child age info in English (e.g., 9-month-old baby)",
  "gorevler": "list of tasks in English (e.g., Baby care, 15 min daily dog walking, house cleaning)",
  "maas": "salary info in English (e.g., 33,000 TL + 300 TL)",
  "ekBilgi": "extra info in English if any (e.g., live-in, daytime, urgent, etc.)"
}

Görevleri kısa ve net yaz, virgülle ayır. Eğer bir bilgi metinde yoksa boş string "" koy. TÜM DEĞERLER İNGİLİZCE OLMALI. Sadece JSON döndür, başka bir şey yazma.`;

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

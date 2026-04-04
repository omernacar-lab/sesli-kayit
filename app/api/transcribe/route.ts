import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "Ses dosyası bulunamadı" }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "tr",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error("Whisper hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

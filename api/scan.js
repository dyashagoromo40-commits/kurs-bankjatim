export default async function handler(req, res) {
  // Mengatur CORS agar Frontend dari GitHub Pages bisa mengakses backend ini
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Menangani preflight request untuk CORS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metode tidak diizinkan. Gunakan POST.' });
  }

  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY; // Mengambil API Key rahasia dari environment variable

  if (!apiKey) {
    return res.status(500).json({ error: 'Server Error: API Key tidak dikonfigurasi di server.' });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const promptText = `Extract currency exchange rates (Kurs Valas) from this image. Look for buying (Beli) and selling (Jual) rates for Bank Notes (BN) and Telegraphic Transfer (TT / TRF). 
Target currencies: USD, AUD, GBP, SGD, JPY, HKD, EUR, CNY, MYR.
Return a STRICT JSON object without any markdown wrapping (NO backticks, NO \`\`\`json). The JSON must map exactly to this schema:
{
  "USD": {"bn_b": "digits", "bn_j": "digits", "tt_b": "digits", "tt_j": "digits"},
  ...
}
Important: Extract ONLY numeric numbers as string values without separators like dots or commas (e.g., "15325" instead of "15.325" or "15,325"). If a particular rate or currency is missing in the image, provide an empty string "".`;

  try {
    const geminiResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return res.status(geminiResponse.status).json({ error: errText });
    }

    const resData = await geminiResponse.json();
    const jsonText = resData.candidates[0].content.parts[0].text;
    const ratesData = JSON.parse(jsonText);

    return res.status(200).json(ratesData);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

import fetch from 'node-fetch';

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const body = JSON.parse(event.body);
    const messages = body.messages;

    if (!messages || !Array.isArray(messages)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nenhuma mensagem enviada.' }) };
    }

    const hfToken = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_TOKEN;
    const geminiToken = process.env.GEMINI_API_KEY;

    // Detect if any message contains an image (Base64)
    // Structure expected: { role: 'user', content: '...', image: 'data:image/jpeg;base64,...' }
    const hasImage = messages.some(m => m.image);

    if (hasImage) {
      if (!geminiToken) {
        throw new Error("Para enviar imagens, o administrador precisa configurar a GEMINI_API_KEY (Gratuita do Google AI Studio) no Netlify.");
      }

      // -------------------------------------------------------------
      // ROTA MULTIMODAL (GOOGLE GEMINI 1.5)
      // -------------------------------------------------------------
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiToken}`;
      
      const geminiContents = await Promise.all(messages.filter(m => m.role !== 'system').map(async m => {
        const parts = [{ text: m.content || "Segue a imagem em anexo:" }];
        
        if (m.image) {
          try {
            if (m.image.startsWith('http')) {
              // Fetch image from URL (Cloudinary) and convert to base64
              const imgRes = await fetch(m.image);
              const arrayBuffer = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
              
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: buffer.toString('base64')
                }
              });
            } else {
              // Already Base64
              const match = m.image.match(/^data:(image\/\w+);base64,(.+)$/);
              if (match) {
                parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
              }
            }
          } catch(e) {
            console.error("Falha ao processar imagem:", e);
          }
        }
        
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: parts
        };
      }));

      // System Prompt no Gemini vai num objeto 'systemInstruction' separado
      const systemInstruction = {
        parts: [{ text: "Você é Zane IA, a inteligência artificial premium, sábia e empática residente na comunidade UndoinG. Responda sempre em pt-BR. Use markdown extensamente (negritos, tabelas, blocos de código). Forneça respostas completas, profundas e extremamente inteligentes." }]
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: geminiContents, system_instruction: systemInstruction })
      });

      if (!response.ok) {
         const err = await response.text();
         throw new Error(`Falha Gemini: ${response.status} - ${err}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!reply) throw new Error("A IA devolveu uma resposta em branco.");

      return { statusCode: 200, headers, body: JSON.stringify({ reply }) };

    } else {
      // -------------------------------------------------------------
      // ROTA DE TEXTO (HUGGING FACE - LLAMA 3.3 70B)
      // -------------------------------------------------------------
      if (!hfToken) throw new Error("Token Hugging Face ausente.");
      
      const MODEL_ID = "meta-llama/Llama-3.3-70B-Instruct"; 
      const API_URL = `https://router.huggingface.co/v1/chat/completions`;

      const formattedMessages = [
        {
          role: "system",
          content: "Você é Zane IA, a inteligência artificial premium da comunidade UndoinG. Você opera no mais alto grau de excelência lógica, raciocina passo a passo para cálculos, formata as respostas impecavelmente em Markdown detalhado, usa analogias brilhantes e tem um tom corporativo mas altamente acessível. Sinta-se livre para estruturar suas conclusões em listas, tabelas ou código quando necessário."
        },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ];

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages: formattedMessages,
          max_tokens: 2500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Falha Llama 3.3 (HuggingFace): ${response.status}`);
      }

      const data = await response.json();
      
      if (data.choices && data.choices.length > 0) {
        return { statusCode: 200, headers, body: JSON.stringify({ reply: data.choices[0].message.content }) };
      } else {
        throw new Error("Resposta falha do LLM.");
      }
    }

  } catch (error) {
    console.error('❌ Falha na Zane IA:', error.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

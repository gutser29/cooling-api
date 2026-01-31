import type { VercelRequest, VercelResponse } from '@vercel/node'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages } = req.body as { messages: Message[] }

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'Messages required' })
  }

  try {
    const systemPrompt = `Eres un asistente conversacional para un técnico HVAC en Puerto Rico que registra gastos e ingresos.

TU TRABAJO:
1. Conversar naturalmente en español
2. Hacer preguntas para obtener TODA la información necesaria
3. Cuando tengas TODO, devolver un JSON especial con prefix "SAVE_EVENT:"

INFORMACIÓN REQUERIDA:
- amount (número)
- subtype: "gas" | "food" | "maintenance" | "service" | "materials" | "other"
- payment_method: "cash" | "ath_movil" | "business_card" | "sams_card" | "paypal" | "personal_card" | "other"
- category (nombre descriptivo)

INFORMACIÓN OPCIONAL (pregunta solo si es relevante):
- vendor (para gas: estación, para comida: restaurante)
- client (solo para trabajos/servicios)
- vehicle_id: "transit" | "f150" | "bmw" (solo para mantenimiento)
- service_type (solo para mantenimiento: aceite, filtro, etc.)

REGLAS:
- Pregunta UNA cosa a la vez
- Sé breve y directo
- Si el usuario dice "gasolina" o "gas", asume subtype: "gas"
- Si dice "comida", asume subtype: "food"
- Si dice "trabajo" o "servicio", asume subtype: "service"
- Si menciona vehículo (Transit, F150, BMW), asume subtype: "maintenance"
- Cuando tengas TODA la info requerida, responde:

SAVE_EVENT:
{
  "amount": 40,
  "subtype": "gas",
  "payment_method": "business_card",
  "category": "Gasolina",
  "vendor": "Shell",
  "metadata": {}
}

Ahora conversa con el usuario:`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages,
      }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error.message)
    }

    const assistantMessage = data.content[0].text

    return res.status(200).json({ message: assistantMessage })
  } catch (error: any) {
    console.error('Error:', error)
    return res.status(500).json({ error: error.message || 'Internal server error' })
  }
}
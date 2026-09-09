// @ts-ignore
import { GoogleGenAI, Type, Schema } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

// Инициализация клиента Google Generative AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ParseExpenseOptions {
    categories: string[];
    defaultCurrency?: "RUB" | "USD";
    currentDate?: Date;
}

export interface ParsedExpense {
    amount: number;
    currency: "RUB" | "USD";
    category: string;
    comment: string;
    date: string;
}

export async function parseExpenseMessage(text: string, options: ParseExpenseOptions): Promise<ParsedExpense | null> {
    const { categories, defaultCurrency = "USD", currentDate = new Date() } = options;

    // Формируем системный промпт
    const prompt = `Анализируй текст и извлеки данные о расходе.
Текст сообщения: "${text}"

Параметры окружения для анализа:
Текущая дата: ${currentDate.toISOString().split('T')[0]} (используй для расчета дат)
Валюта по умолчанию: '${defaultCurrency}'
Доступные категории: ${categories.join(', ')}

Правила:
1. Если сообщение не является финансовой тратой (например вопрос, бессмысленный текст), верни isExpense = false.
2. Сумма (amount) должна быть положительным числом. Корректно обрабатывай дробные числа: если число написано с запятой (например, 4,5), оно должно парситься как дробное число с точкой (4.5).
3. ВАЖНО: Если пользователь явно не указал валюту в сообщении, ВСЕГДА используй валюту по умолчанию: '${defaultCurrency}'.
4. Default currency is USD if not specified by user.
5. Дата (date) должна быть в формате YYYY-MM-DD.
6. Категория должна строго совпадать с одной из предложенного списка.
7. Комментарий (comment) - краткое описание покупки на основе текста.`;

    // Определяем строгую схему (Structured Outputs)
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            isExpense: {
                type: Type.BOOLEAN,
                description: "True если это финансовая транзакция/трата, False если просто текст/команда"
            },
            expense: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                    amount: { type: Type.NUMBER, description: "Сумма (положительное число)" },
                    currency: { type: Type.STRING, enum: ["RUB", "USD"], description: "RUB или USD" },
                    category: { type: Type.STRING, enum: categories, description: "Категория из предложенного списка" },
                    comment: { type: Type.STRING, description: "Краткий комментарий (на что потрачено)" },
                    date: { type: Type.STRING, description: "Дата расхода в формате YYYY-MM-DD" },
                },
                required: ["amount", "currency", "category", "comment", "date"]
            }
        },
        required: ["isExpense"]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
            config: {
                // responseMimeType: 'application/json' (SDK сам обрабатывает это при наличии responseSchema)
                responseSchema: schema,
                temperature: 0.1, // Низкая температура для более предсказуемого парсинга
            }
        });

        if (response.text) {
            const result = JSON.parse(response.text);
            if (!result.isExpense || !result.expense) {
                return null;
            }
            return result.expense as ParsedExpense;
        }
        return null;
    } catch (error) {
        console.error("Ошибка при парсинге сообщения через Gemini API:", error);
        throw error;
    }
}

export function fallbackParse(text: string, categories: string[], defaultCurrency: "RUB" | "USD" = "USD"): ParsedExpense | null {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 1) return null;

    const amountStr = parts[0].replace(',', '.').replace(/[^\d.]/g, '');
    const amount = parseFloat(amountStr);

    if (isNaN(amount) || amount <= 0) return null;

    let parsedCurrency: "RUB" | "USD" = "USD";
    if (/\b(руб|rub|рублей|рубля|₽)\b/i.test(text)) {
        parsedCurrency = 'RUB';
    } else if (/\b(usd|дол|доллар|долларов|\$)\b/i.test(text)) {
        parsedCurrency = 'USD';
    }

    let categoryInput = parts.length > 1 ? parts[1].toLowerCase() : '';
    let comment = parts.slice(1).join(' '); // text after amount

    let categoryMatch = categories.find(c => c.toLowerCase() === categoryInput);

    if (!categoryMatch && comment) {
        const productKeywords = ['яйца', 'хлеб', 'молоко', 'мясо', 'сыр', 'еда', 'супермаркет', 'чипсы', 'вода'];
        const entertainmentKeywords = ['кино', 'фильм', 'билеты', 'игра', 'клуб'];
        const cafeKeywords = ['кофе', 'чай', 'обед', 'ужин', 'пицца', 'бургер', 'кафе', 'ресторан'];
        const transportKeywords = ['проезд', 'такси', 'автобус', 'бензин', 'транспорт', 'метро'];

        const cLower = comment.toLowerCase();
        if (productKeywords.some(k => cLower.includes(k))) {
            categoryMatch = categories.find(c => c.toLowerCase() === 'продукты' || c.toLowerCase() === 'супермаркет');
        } else if (entertainmentKeywords.some(k => cLower.includes(k))) {
            categoryMatch = categories.find(c => c.toLowerCase() === 'развлечения');
        } else if (cafeKeywords.some(k => cLower.includes(k))) {
            categoryMatch = categories.find(c => c.toLowerCase() === 'кафе');
        } else if (transportKeywords.some(k => cLower.includes(k))) {
            categoryMatch = categories.find(c => c.toLowerCase() === 'транспорт' || c.toLowerCase() === 'авто');
        }
    }

    if (!categoryMatch) {
        categoryMatch = categories.find(c => c.toLowerCase() === 'другое') || categories[0];
    }

    // Только если после суммы ничего вообще нет - подставляем категорию
    if (!comment) {
        comment = categoryMatch;
    }

    return {
        amount,
        currency: parsedCurrency,
        category: categoryMatch,
        comment,
        date: new Date().toISOString().split('T')[0]
    };
}

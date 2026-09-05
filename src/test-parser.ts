import { parseExpenseMessage } from './services/aiParser';

async function runTests() {
    const categories = ['Продукты', 'Кафе', 'Транспорт', 'Жилье', 'Развлечения', 'Здоровье', 'Покупки', 'Другое'];

    const tests = [
        "500 кофе",
        "вчера 20$ такси",
        "кроссовки 4500р 15 августа",
        "просто какой-то текст без смысла"
    ];

    const options = {
        categories,
        defaultCurrency: "RUB" as const,
        currentDate: new Date('2024-10-20') // фиксируем для теста, чтобы "вчера" всегда было 19 октября
    };

    console.log(`Текущая дата в тесте: ${options.currentDate.toISOString().split('T')[0]}`);
    console.log(`Доступные категории: ${categories.join(', ')}\n`);

    for (const text of tests) {
        console.log(`--- Тест: "${text}" ---`);
        // Добавляем паузу 2 секунды, чтобы избежать Rate Limit / 403 ошибок от Google из-за быстрых запросов
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            const result = await parseExpenseMessage(text, options);
            if (result) {
                console.log("✅ Распознано:", result);
            } else {
                console.log("❌ Не распознано как трата (результат null)");
            }
        } catch (error) {
            console.log("❌ Ошибка парсинга:", error);
        }
        console.log("------------------------\n");
    }
}

runTests();

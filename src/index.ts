import { bot } from './bot';
import express from 'express';
import cors from 'cors';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/transactions/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userId },
            orderBy: { date: 'desc' },
            // include: { category: true } // можно включить, если фронтенду нужна информация о категории
        });
        res.json(transactions);
    } catch (e) {
        console.error("API error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const PORT = process.env.PORT || 3000;

function start() {
    console.log("Запуск API сервера и Telegram бота...");

    // Запускаем Express сервер до (или параллельно) бота
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`🌐 API сервер запущен на 0.0.0.0:${PORT}`);
    });

    // Запуск Telegram бота
    bot.launch()
        .then(() => console.log("🚀 Telegram бот успешно запущен и готов к работе!"))
        .catch(e => console.error("❌ Ошибка при запуске бота:", e));
}

start();

// Обработка корректного завершения (Graceful stop)
process.once('SIGINT', () => {
    console.log('Остановка бота (SIGINT)...');
    bot.stop('SIGINT');
    process.exit(0);
});
process.once('SIGTERM', () => {
    console.log('Остановка бота (SIGTERM)...');
    bot.stop('SIGTERM');
    process.exit(0);
});

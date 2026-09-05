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

async function start() {
    console.log("Запуск Telegram бота и API сервера...");
    try {
        await bot.launch();
        console.log("🚀 Telegram бот успешно запущен и готов к работе!");

        app.listen(PORT, () => {
            console.log(`🌐 API сервер запущен на порту ${PORT}`);
        });
    } catch (e) {
        console.error("❌ Ошибка при запуске:", e);
    }
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

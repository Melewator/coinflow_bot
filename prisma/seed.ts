import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const defaultCategories = [
        { name: 'Продукты', icon: '🛒', isDefault: true },
        { name: 'Кафе', icon: '☕', isDefault: true },
        { name: 'Транспорт', icon: '🚌', isDefault: true },
        { name: 'Жилье', icon: '🏠', isDefault: true },
        { name: 'Развлечения', icon: '🎉', isDefault: true },
        { name: 'Здоровье', icon: '💊', isDefault: true },
        { name: 'Покупки', icon: '🛍️', isDefault: true },
        { name: 'Другое', icon: '📦', isDefault: true },
    ];

    console.log('Начинаем сидинг дефолтных категорий...');

    for (const category of defaultCategories) {
        const created = await prisma.category.create({
            data: category,
        });
        console.log(`Категория создана: ${created.name} ${created.icon}`);
    }

    console.log('Сидинг завершен!');
}

main()
    .catch((e) => {
        console.error('Ошибка при сидинге БД:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
